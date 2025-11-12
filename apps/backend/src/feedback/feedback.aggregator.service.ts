import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FeedbackDeliveryService } from './feedback.delivery.service';
import { FeedbackEventPayload, FeedbackIngestionEvent } from './feedback.types';
import { ParticipantIndexService } from '../livekit/participant-index.service';

type Sample = {
  ts: number;
  speech: boolean;
  valence?: number;
  arousal?: number;
  rmsDbfs?: number;
};

type ParticipantState = {
  samples: Sample[]; // pruned to last 65s
  ema: {
    valence?: number;
    arousal?: number;
    rms?: number;
  };
  cooldownUntilByType: Map<string, number>;
};

@Injectable()
export class FeedbackAggregatorService {
  private readonly logger = new Logger(FeedbackAggregatorService.name);
  private readonly byKey = new Map<string, ParticipantState>(); // key = meetingId:participantId
  private readonly shortWindowMs = 3000;
  private readonly longWindowMs = 10000;
  private readonly pruneHorizonMs = 65000;
  private readonly emaAlpha = 0.3;

  constructor(
    private readonly delivery: FeedbackDeliveryService,
    private readonly index: ParticipantIndexService,
  ) {}

  @OnEvent('feedback.ingestion', { async: true })
  handleIngestion(evt: FeedbackIngestionEvent): void {
    const participantId = evt.participantId ?? '';
    if (!participantId) return;
    const includeHost = (process.env.FEEDBACK_INCLUDE_HOST || 'false') === 'true';
    if (evt.participantRole === 'host' && !includeHost) {
      // Não gerar feedback sobre o anfitrião
      return;
    }
    const key = this.key(evt.meetingId, participantId);
    const state = this.byKey.get(key) ?? this.initState();
    const sample: Sample = {
      ts: evt.ts,
      speech: evt.prosody.speechDetected,
      valence: evt.prosody.valence,
      arousal: evt.prosody.arousal,
      rmsDbfs: evt.signal?.rmsDbfs,
    };
    state.samples.push(sample);
    this.pruneOld(state, evt.ts);
    this.updateEma(state, sample);
    this.byKey.set(key, state);

    // Avaliar regras básicas v1
    this.evaluateSilenceProlongado(evt.meetingId, participantId, state, evt.ts);
    // Volume baixo/alto usando RMS (EMA + média de janela curta)
    this.evaluateVolume(evt.meetingId, participantId, state, evt.ts);
    // Overlap de fala (heurística simples por cobertura na janela longa)
    this.evaluateOverlapFala(evt.meetingId, participantId, evt.ts);
    // Monólogo prolongado (60s)
    this.evaluateMonologoProlongado(evt.meetingId, evt.ts);
  }

  private evaluateSilenceProlongado(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    const window = this.window(state, now, this.longWindowMs);
    if (window.samplesCount < 5) return;
    const speechCoverage = window.speechCount / window.samplesCount;
    if (speechCoverage < 0.1) {
      const type = 'silencio_prolongado';
      if (this.inCooldown(state, type, now)) return;
      this.setCooldown(state, type, now, 15000); // 15s
      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'warning',
        ts: now,
        meetingId,
        participantId,
        window: { start: now - this.longWindowMs, end: now },
        message: `${name}: silêncio prolongado; tudo certo?`,
        tips: ['Cheque se o microfone está mutado/desconectado'],
        metadata: {
          speechCoverage,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateVolume(meetingId: string, participantId: string, state: ParticipantState, now: number): void {
    const w = this.window(state, now, this.shortWindowMs);
    if (w.samplesCount < 1) return;
    const speechCoverage = w.speechCount / w.samplesCount;
    if (speechCoverage < 0.5) return; // gate por fala
    const mean = w.meanRmsDbfs;
    const ema = state.ema.rms;
    const level = typeof mean === 'number' ? mean : typeof ema === 'number' ? ema : undefined;
    if (typeof level !== 'number') return;

    // volume_baixo thresholds
    if (level <= -28) {
      const type = 'volume_baixo';
      if (!this.inCooldown(state, type, now)) {
        const severity = level <= -34 ? 'critical' : 'warning';
        this.setCooldown(state, type, now, 10000); // 10s
        const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
        const payload: FeedbackEventPayload = {
          id: this.makeId(),
          type,
          severity,
          ts: now,
          meetingId,
          participantId,
          window: { start: now - this.shortWindowMs, end: now },
          message:
            severity === 'critical'
              ? `${name}: quase inaudível; aumente o ganho imediatamente.`
              : `${name}: volume baixo; aproxime-se do microfone.`,
          tips: severity === 'critical' ? ['Aumente o ganho de entrada', 'Aproxime-se do microfone'] : ['Verifique entrada de áudio', 'Desative redução agressiva de ruído'],
          metadata: {
            rmsDbfs: level,
            speechCoverage,
          },
        };
        this.delivery.publishToHosts(meetingId, payload);
      }
    }

    // volume_alto thresholds
    if (level >= -10) {
      const type = 'volume_alto';
      if (!this.inCooldown(state, type, now)) {
        const severity = level >= -6 ? 'critical' : 'warning';
        this.setCooldown(state, type, now, 10000); // 10s
        const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
        const payload: FeedbackEventPayload = {
          id: this.makeId(),
          type,
          severity,
          ts: now,
          meetingId,
          participantId,
          window: { start: now - this.shortWindowMs, end: now },
          message:
            severity === 'critical'
              ? `${name}: áudio clipando; reduza o ganho.`
              : `${name}: volume alto; afaste-se um pouco.`,
          tips: ['Reduza sensibilidade do microfone'],
          metadata: {
            rmsDbfs: level,
            speechCoverage,
          },
        };
        this.delivery.publishToHosts(meetingId, payload);
      }
    }
  }

  private evaluateOverlapFala(meetingId: string, participantId: string, now: number): void {
    const participants = this.participantsForMeeting(meetingId);
    if (participants.length < 2) return;
    // Cobertura de fala por participante na janela longa (10s)
    const speaking: Array<{ id: string; coverage: number; state: ParticipantState }> = [];
    for (const [pid, st] of participants) {
      const w = this.window(st, now, this.longWindowMs);
      if (w.samplesCount === 0) continue;
      const coverage = w.speechCount / w.samplesCount;
      if (coverage >= 0.2) {
        speaking.push({ id: pid, coverage, state: st });
      }
    }
    if (speaking.length >= 2) {
      // Dispara no contexto do participante atual (se estiver entre os que falam), senão no mais recente dos que falam
      const target =
        speaking.find((s) => s.id === participantId) ?? speaking.sort((a, b) => b.coverage - a.coverage)[0];
      const type = 'overlap_fala';
      if (this.inCooldown(target.state, type, now)) return;
      this.setCooldown(target.state, type, now, 15000); // 15s
      const name = this.index.getParticipantName(meetingId, target.id) ?? target.id;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'warning',
        ts: now,
        meetingId,
        participantId: target.id,
        window: { start: now - this.longWindowMs, end: now },
        message: `${name} e outra pessoa falando ao mesmo tempo com frequência.`,
        tips: ['Combine turnos de fala', 'Use levantar a mão'],
        metadata: {
          speechCoverage: speaking.find((s) => s.id === target.id)?.coverage,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateMonologoProlongado(meetingId: string, now: number): void {
    const participants = this.participantsForMeeting(meetingId);
    if (participants.length === 0) return;
    const horizonMs = 60000;
    // Contagem de fala por participante nos últimos 60s
    let totalSpeech = 0;
    const counts: Array<{ id: string; speech: number; state: ParticipantState }> = [];
    for (const [pid, st] of participants) {
      let speech = 0;
      const start = now - horizonMs;
      for (let i = st.samples.length - 1; i >= 0; i--) {
        const s = st.samples[i];
        if (s.ts < start) break;
        if (s.speech) {
          speech++;
          totalSpeech++;
        }
      }
      counts.push({ id: pid, speech, state: st });
    }
    if (totalSpeech < 10) return; // poucos eventos, ignora
    counts.sort((a, b) => b.speech - a.speech);
    const top = counts[0];
    if (!top || top.speech === 0) return;
    const ratio = top.speech / totalSpeech;
    if (ratio >= 0.8) {
      const type = 'monologo_prolongado';
      if (this.inCooldown(top.state, type, now)) return;
      this.setCooldown(top.state, type, now, 30000); // 30s
      const name = this.index.getParticipantName(meetingId, top.id) ?? top.id;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'warning',
        ts: now,
        meetingId,
        participantId: top.id,
        window: { start: now - horizonMs, end: now },
        message: `${name}: fala dominante (≥80% nos últimos 60s).`,
        tips: ['Convide outras pessoas a opinar'],
        metadata: {
          speechCoverage: ratio,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  // Helpers
  private window(
    state: ParticipantState,
    now: number,
    ms: number,
  ): {
    start: number;
    end: number;
    samplesCount: number;
    speechCount: number;
    meanRmsDbfs?: number;
  } {
    const start = now - ms;
    let samplesCount = 0;
    let speechCount = 0;
    let rmsSum = 0;
    let rmsN = 0;
    for (let i = state.samples.length - 1; i >= 0; i--) {
      const s = state.samples[i];
      if (s.ts < start) break;
      samplesCount++;
      if (s.speech) speechCount++;
      if (typeof s.rmsDbfs === 'number') {
        rmsSum += s.rmsDbfs;
        rmsN++;
      }
    }
    const meanRmsDbfs = rmsN > 0 ? rmsSum / rmsN : undefined;
    return { start, end: now, samplesCount, speechCount, meanRmsDbfs };
  }

  private pruneOld(state: ParticipantState, now: number): void {
    const minTs = now - this.pruneHorizonMs;
    while (state.samples.length > 0 && state.samples[0].ts < minTs) {
      state.samples.shift();
    }
  }

  private updateEma(state: ParticipantState, s: Sample): void {
    const a = this.emaAlpha;
    if (typeof s.valence === 'number') {
      state.ema.valence =
        typeof state.ema.valence === 'number'
          ? a * s.valence + (1 - a) * state.ema.valence
          : s.valence;
    }
    if (typeof s.arousal === 'number') {
      state.ema.arousal =
        typeof state.ema.arousal === 'number'
          ? a * s.arousal + (1 - a) * state.ema.arousal
          : s.arousal;
    }
    if (typeof s.rmsDbfs === 'number') {
      state.ema.rms =
        typeof state.ema.rms === 'number' ? a * s.rmsDbfs + (1 - a) * state.ema.rms : s.rmsDbfs;
    }
  }

  private inCooldown(state: ParticipantState, type: string, now: number): boolean {
    const until = state.cooldownUntilByType.get(type);
    return typeof until === 'number' && until > now;
  }

  private setCooldown(state: ParticipantState, type: string, now: number, ms: number): void {
    state.cooldownUntilByType.set(type, now + ms);
  }

  private initState(): ParticipantState {
    return {
      samples: [],
      ema: {},
      cooldownUntilByType: new Map<string, number>(),
    };
  }

  private key(meetingId: string, participantId: string): string {
    return `${meetingId}:${participantId}`;
  }

  private makeId(): string {
    const rnd = Math.floor(Math.random() * 1e9).toString(36);
    return `${Date.now().toString(36)}-${rnd}`;
  }

  private participantsForMeeting(meetingId: string): Array<[string, ParticipantState]> {
    const out: Array<[string, ParticipantState]> = [];
    const prefix = `${meetingId}:`;
    for (const [k, st] of this.byKey.entries()) {
      if (k.startsWith(prefix)) {
        const pid = k.slice(prefix.length);
        out.push([pid, st]);
      }
    }
    return out;
  }

  // Debug/introspection
  getMeetingDebug(meetingId: string): {
    meetingId: string;
    participants: Array<{
      participantId: string;
      name?: string;
      speechCoverage10s: number;
      rmsMean3s?: number;
      emaRms?: number;
      samples: number;
    }>;
  } {
    const now = Date.now();
    const participants: Array<{
      participantId: string;
      name?: string;
      speechCoverage10s: number;
      rmsMean3s?: number;
      emaRms?: number;
      samples: number;
    }> = [];
    for (const [pid, st] of this.participantsForMeeting(meetingId)) {
      const w10 = this.window(st, now, this.longWindowMs);
      const w3 = this.window(st, now, this.shortWindowMs);
      const speechCoverage10s = w10.samplesCount > 0 ? w10.speechCount / w10.samplesCount : 0;
      participants.push({
        participantId: pid,
        name: this.index.getParticipantName(meetingId, pid) ?? undefined,
        speechCoverage10s,
        rmsMean3s: w3.meanRmsDbfs,
        emaRms: st.ema.rms,
        samples: st.samples.length,
      });
    }
    return { meetingId, participants };
  }
}
