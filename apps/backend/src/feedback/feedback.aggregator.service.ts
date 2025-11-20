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
    emotions?: Record<string, number>;
  };

  type ParticipantState = {
    samples: Sample[]; // pruned to last 65s
    ema: {
      valence?: number;
      arousal?: number;
      rms?: number;
      emotions: Map<string, number>; // EMA per specific emotion
    };
    cooldownUntilByType: Map<string, number>;
    lastFeedbackAt?: number; // Global cooldown to prevent spam
  };

@Injectable()
export class FeedbackAggregatorService {
  private readonly logger = new Logger(FeedbackAggregatorService.name);
  private readonly byKey = new Map<string, ParticipantState>(); // key = meetingId:participantId
  private readonly shortWindowMs = 3000;
  private readonly longWindowMs = 10000;
  private readonly trendWindowMs = 20000;
  private readonly pruneHorizonMs = 65000;
  private readonly emaAlpha = 0.3;
  // Meeting-level tracking for interruptions and cooldowns
  private readonly overlapHistoryByMeeting = new Map<string, number[]>(); // timestamps for overlap detections
  private readonly lastOverlapSampleAtByMeeting = new Map<string, number>(); // throttle overlap sampling
  private readonly meetingCooldownByType = new Map<string, number>(); // key=`${meetingId}:${type}` -> until timestamp
  private readonly lastSpeakerByMeeting = new Map<string, string>(); // meetingId -> participantId
  private readonly postInterruptionCandidatesByMeeting = new Map<
    string,
    Array<{ ts: number; interruptedId: string; valenceBefore?: number }>
  >();

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
      emotions: evt.prosody.emotions,
    };
    state.samples.push(sample);
    this.pruneOld(state, evt.ts);
    this.updateEma(state, sample);
    this.byKey.set(key, state);

    // DEBUG: Log emotion EMA state periodically
    if (state.samples.length % 20 === 0 && state.ema.emotions.size > 0) {
      const top3 = Array.from(state.ema.emotions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, score]) => `${name}:${score.toFixed(2)}`)
        .join(', ');
      this.logger.debug(`[EMA] ${participantId}: ${state.ema.emotions.size} emotions tracked. Top 3: ${top3}`);
    }

    // Avaliar regras básicas v1
    this.evaluateSilenceProlongado(evt.meetingId, participantId, state, evt.ts);
    // Volume baixo/alto usando RMS (EMA + média de janela curta)
    this.evaluateVolume(evt.meetingId, participantId, state, evt.ts);
    // Hostilidade/Raiva (substitui tendência emocional negativa)
    this.evaluateHostility(evt.meetingId, participantId, state, evt.ts);
    // Tédio/Desinteresse (substitui engajamento baixo)
    this.evaluateBoredom(evt.meetingId, participantId, state, evt.ts);
    // Frustração (modelo direto)
    this.evaluateFrustration(evt.meetingId, participantId, state, evt.ts);
    // Confusão (nova heurística)
    this.evaluateConfusion(evt.meetingId, participantId, state, evt.ts);
    // Engajamento Positivo (nova heurística)
    this.evaluatePositiveEngagement(evt.meetingId, participantId, state, evt.ts);
    // Entusiasmo alto sustentado (arousal alto estável)
    this.evaluateEntusiasmoAlto(evt.meetingId, participantId, state, evt.ts);
    // Monotonia prosódica (baixa variância de arousal)
    this.evaluateMonotoniaProsodica(evt.meetingId, participantId, state, evt.ts);
    // Ritmo acelerado/pausado por alternância de VAD
    this.evaluateRitmoAceleradoPausado(evt.meetingId, participantId, state, evt.ts);
    // Queda de energia do grupo (arousal médio baixo entre convidados)
    this.evaluateEnergiaGrupoBaixa(evt.meetingId, evt.ts);
    // Polarização emocional do grupo
    this.evaluatePolarizacaoEmocional(evt.meetingId, evt.ts);
    // Atualiza rastreamento de último orador (para efeito pós-interrupção)
    this.updateSpeakerTracking(evt.meetingId, evt.ts);
    // Interrupções frequentes (contagem de overlaps por minuto)
    this.evaluateInterrupcoesFrequentes(evt.meetingId, participantId, evt.ts);
    // Efeito pós-interrupção (queda de valence do interrompido)
    this.evaluateEfeitoPosInterrupcao(evt.meetingId, evt.ts);
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
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
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

    // Mutex: only trigger ONE volume feedback (prioritize extremes)
    const isLow = level <= -28;
    const isHigh = level >= -10;

    if (isLow && isHigh) {
      // Impossible conflict, skip
      return;
    }

    // volume_baixo thresholds
    if (isLow) {
      const type = 'volume_baixo';
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
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
      return;
    }

    // volume_alto thresholds
    if (isHigh) {
      const type = 'volume_alto';
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
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

  private evaluateHostility(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    // Gate: Ensure significant speech activity
    const w = this.window(state, now, this.longWindowMs);
    if (w.samplesCount < 5 || (w.speechCount / w.samplesCount) < 0.2) return;

    const anger = state.ema.emotions.get('anger') ?? 0;
    const disgust = state.ema.emotions.get('disgust') ?? 0;
    const distress = state.ema.emotions.get('distress') ?? 0;
    const hostilityScore = Math.max(anger, disgust, distress);

    if (hostilityScore > 0.6) {
      const type = 'hostilidade';
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
      this.setCooldown(state, type, now, 30000);
      
      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'warning',
        ts: now,
        meetingId,
        participantId,
        window: { start: now - this.longWindowMs, end: now },
        message: `${name}: a conversa esquentou. Considere validar o ponto do outro antes de prosseguir.`,
        tips: ['Respire fundo', 'Use frases como "Entendo seu ponto..."', 'Evite interrupções agora'],
        metadata: {
          valenceEMA: state.ema.valence,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateBoredom(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    // Gate: Ensure significant speech activity (or lack thereof, but we need samples)
    const w = this.window(state, now, this.longWindowMs);
    if (w.samplesCount < 5) return;
    // For boredom, speech coverage might be low, but we check if present samples indicate boredom
    
    const boredom = state.ema.emotions.get('boredom') ?? 0;
    const tiredness = state.ema.emotions.get('tiredness') ?? 0;
    const interest = state.ema.emotions.get('interest') ?? 0;
    
    // High boredom/tiredness AND low interest
    if ((boredom > 0.5 || tiredness > 0.6) && interest < 0.2) {
      const type = 'tedio';
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
      this.setCooldown(state, type, now, 25000);

      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'info',
        ts: now,
        meetingId,
        participantId,
        window: { start: now - this.longWindowMs, end: now },
        message: `${name}: energia baixa detectada. Que tal trazer um novo ponto de vista?`,
        tips: ['Mude a entonação', 'Faça uma pergunta aberta ao grupo'],
        metadata: {
          arousalEMA: state.ema.arousal,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateFrustration(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    // Gate: Ensure significant speech activity
    const w = this.window(state, now, this.longWindowMs);
    if (w.samplesCount < 5 || (w.speechCount / w.samplesCount) < 0.2) return;

    // Direct frustration detection from Hume model
    const frustration = state.ema.emotions.get('frustration') ?? 0;
    
    if (frustration > 0.6) {
      const type = 'frustracao_crescente';
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
      this.setCooldown(state, type, now, 25000);

      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'warning',
        ts: now,
        meetingId,
        participantId,
        window: { start: now - this.longWindowMs, end: now },
        message: `${name}: parece haver um bloqueio ou frustração.`,
        tips: ['Reconheça a dificuldade', 'Pergunte: "O que está impedindo nosso progresso?"'],
        metadata: {
          valenceEMA: state.ema.valence,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateConfusion(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    // Gate: Ensure significant speech activity
    const w = this.window(state, now, this.longWindowMs);
    if (w.samplesCount < 5 || (w.speechCount / w.samplesCount) < 0.2) return;

    const confusion = state.ema.emotions.get('confusion') ?? 0;
    const doubt = state.ema.emotions.get('doubt') ?? 0;
    const score = Math.max(confusion, doubt);

    if (score > 0.55) {
      const type = 'confusao';
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
      this.setCooldown(state, type, now, 20000);

      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'info',
        ts: now,
        meetingId,
        participantId,
        window: { start: now - this.longWindowMs, end: now },
        message: `${name}: pontos de dúvida detectados. Seria bom checar o entendimento.`,
        tips: ['Pergunte: "Isso faz sentido?"', 'Ofereça um exemplo prático'],
        metadata: {},
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluatePositiveEngagement(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    // Gate: Ensure significant speech activity
    const w = this.window(state, now, this.longWindowMs);
    if (w.samplesCount < 5 || (w.speechCount / w.samplesCount) < 0.3) return;

    const interest = state.ema.emotions.get('interest') ?? 0;
    const joy = state.ema.emotions.get('joy') ?? 0;
    const determination = state.ema.emotions.get('determination') ?? 0;
    const score = Math.max(interest, joy, determination);

    if (score > 0.7) {
      const type = 'entusiasmo_alto'; // Reuse existing type
      // Longer cooldown to not spam praise
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
      this.setCooldown(state, type, now, 60000);

      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'info',
        ts: now,
        meetingId,
        participantId,
        window: { start: now - this.longWindowMs, end: now },
        message: `${name}: ótima energia e clareza! O grupo parece engajado.`,
        tips: ['Mantenha esse tom', 'Aproveite para definir próximos passos'],
        metadata: {},
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  // Novas heurísticas baseadas em sentimento/arousal
  // (Mantidas como fallback ou removidas se totalmente substituídas)
  private evaluateTendenciaEmocionalNegativa(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    // Deprecated by evaluateHostility
    // Keeping logic active only if emotions map is empty (fallback mode)
    if (state.ema.emotions.size > 0) return;

    const val = state.ema.valence;
    if (typeof val !== 'number') return;
    // Requer fala razoável na janela longa
    const w = this.window(state, now, this.longWindowMs);
    if (w.samplesCount < 5) return;
    const speechCoverage = w.speechCount / w.samplesCount;
    if (speechCoverage < 0.4) return;
    // Thresholds para valence em [-1,1]
    const type = 'tendencia_emocional_negativa';
    if (val <= -0.6 || val <= -0.35) {
      if (this.inCooldown(state, type, now)) return;
      const severe = val <= -0.6;
      this.setCooldown(state, type, now, severe ? 25000 : 20000);
      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: severe ? 'warning' : 'info',
        ts: now,
        meetingId,
        participantId,
        window: { start: now - this.longWindowMs, end: now },
        message: severe
          ? `${name}: tom negativo perceptível. Considere suavizar a comunicação.`
          : `${name}: tendência emocional negativa. Tente um tom mais positivo.`,
        tips: ['Mostre concordância antes de divergir', 'Evite frases muito secas'],
        metadata: {
          valenceEMA: val,
          speechCoverage,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateEngajamentoBaixo(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    // Deprecated by evaluateBoredom
    if (state.ema.emotions.size > 0) return;

    const ar = state.ema.arousal;
    if (typeof ar !== 'number') return;
    // Requer fala moderada na janela longa
    const w = this.window(state, now, this.longWindowMs);
    if (w.samplesCount < 5) return;
    const speechCoverage = w.speechCount / w.samplesCount;
    if (speechCoverage < 0.3) return;
    // Thresholds para arousal em [-1,1]
    const type = 'engajamento_baixo';
    if (ar <= -0.4 || ar <= -0.2) {
      if (this.inCooldown(state, type, now)) return;
      const warn = ar <= -0.4;
      this.setCooldown(state, type, now, warn ? 20000 : 15000);
      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: warn ? 'warning' : 'info',
        ts: now,
        meetingId,
        participantId,
        window: { start: now - this.longWindowMs, end: now },
        message: warn
          ? `${name}: engajamento baixo (tom desanimado).`
          : `${name}: energia baixa. Um pouco mais de ênfase pode ajudar.`,
        tips: ['Fale com mais variação de tom', 'Projete a voz mais próxima do microfone'],
        metadata: {
          arousalEMA: ar,
          speechCoverage,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateFrustracaoCrescente(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    // Deprecated by evaluateFrustration
    if (state.ema.emotions.size > 0) return;

    const start = now - this.trendWindowMs;
    let arousalEarlySum = 0;
    let arousalEarlyN = 0;
    let arousalLateSum = 0;
    let arousalLateN = 0;
    let valenceEarlySum = 0;
    let valenceEarlyN = 0;
    let valenceLateSum = 0;
    let valenceLateN = 0;
    let speechN = 0;
    for (let i = state.samples.length - 1; i >= 0; i--) {
      const s = state.samples[i];
      if (s.ts < start) break;
      if (s.speech) speechN++;
      if (s.ts < now - this.trendWindowMs / 2) {
        if (typeof s.arousal === 'number') {
          arousalEarlySum += s.arousal;
          arousalEarlyN++;
        }
        if (typeof s.valence === 'number') {
          valenceEarlySum += s.valence;
          valenceEarlyN++;
        }
      } else {
        if (typeof s.arousal === 'number') {
          arousalLateSum += s.arousal;
          arousalLateN++;
        }
        if (typeof s.valence === 'number') {
          valenceLateSum += s.valence;
          valenceLateN++;
        }
      }
    }
    const totalN = arousalEarlyN + arousalLateN + valenceEarlyN + valenceLateN;
    if (speechN < 5 || totalN < 8) return;
    const arousalEarly = arousalEarlyN > 0 ? arousalEarlySum / arousalEarlyN : undefined;
    const arousalLate = arousalLateN > 0 ? arousalLateSum / arousalLateN : undefined;
    const valenceEarly = valenceEarlyN > 0 ? valenceEarlySum / valenceEarlyN : undefined;
    const valenceLate = valenceLateN > 0 ? valenceLateSum / valenceLateN : undefined;
    if (typeof arousalEarly !== 'number' || typeof arousalLate !== 'number') return;
    if (typeof valenceEarly !== 'number' || typeof valenceLate !== 'number') return;
    const arousalDelta = arousalLate - arousalEarly;
    const valenceDelta = valenceLate - valenceEarly;
    if (arousalDelta >= 0.25 && valenceDelta <= -0.2) {
      const type = 'frustracao_crescente';
      if (this.inCooldown(state, type, now)) return;
      this.setCooldown(state, type, now, 25000);
      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'warning',
        ts: now,
        meetingId,
        participantId,
        window: { start, end: now },
        message: `${name}: indícios de frustração crescente.`,
        tips: ['Reduza o ritmo e cheque entendimento', 'Valide objeções antes de avançar'],
        metadata: {
          arousalEMA: state.ema.arousal,
          valenceEMA: state.ema.valence,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateEntusiasmoAlto(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    const ar = state.ema.arousal;
    if (typeof ar !== 'number') return;
    const w = this.window(state, now, this.longWindowMs);
    if (w.samplesCount < 5) return;
    const speechCoverage = w.speechCount / w.samplesCount;
    if (speechCoverage < 0.5) return;
    if (ar >= 0.5) {
      const type = 'entusiasmo_alto';
      if (this.inCooldown(state, type, now)) return;
      const severity: 'info' | 'warning' = ar >= 0.7 ? 'warning' : 'info';
      this.setCooldown(state, type, now, severity === 'warning' ? 20000 : 15000);
      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity,
        ts: now,
        meetingId,
        participantId,
        window: { start: now - this.longWindowMs, end: now },
        message:
          severity === 'warning'
            ? `${name}: energia muito alta; canalize em próximos passos.`
            : `${name}: entusiasmo alto; ótimo momento para direcionar ações.`,
        tips: ['Direcione para decisões e próximos passos'],
        metadata: {
          arousalEMA: ar,
          speechCoverage,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateMonotoniaProsodica(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    const start = now - this.longWindowMs;
    const values: number[] = [];
    let speechN = 0;
    for (let i = state.samples.length - 1; i >= 0; i--) {
      const s = state.samples[i];
      if (s.ts < start) break;
      if (s.speech) speechN++;
      if (typeof s.arousal === 'number') values.push(s.arousal);
    }
    if (speechN < 5 || values.length < 5) return;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
    const stdev = Math.sqrt(variance);
    const type = 'monotonia_prosodica';
    if (stdev < 0.1) {
      if (this.inCooldown(state, type, now)) return;
      const severity: 'info' | 'warning' = stdev < 0.06 ? 'warning' : 'info';
      this.setCooldown(state, type, now, 20000);
      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity,
        ts: now,
        meetingId,
        participantId,
        window: { start, end: now },
        message:
          severity === 'warning'
            ? `${name}: fala monótona; varie entonação e pausas.`
            : `${name}: pouca variação de entonação.`,
        tips: ['Use pausas e ênfases para destacar pontos'],
        metadata: {
          arousalEMA: state.ema.arousal,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateEnergiaGrupoBaixa(meetingId: string, now: number): void {
    const participants = this.participantsForMeeting(meetingId);
    if (participants.length === 0) return;
    let sum = 0;
    let n = 0;
    for (const [pid, st] of participants) {
      // ignore host if role is host
      const role = this.index.getParticipantRole(meetingId, pid);
      if (role === 'host') continue;
      const w = this.window(st, now, this.longWindowMs);
      if (w.samplesCount === 0) continue;
      const coverage = w.speechCount / w.samplesCount;
      if (coverage < 0.3) continue;
      if (typeof st.ema.arousal === 'number') {
        sum += st.ema.arousal;
        n++;
      }
    }
    if (n === 0) return;
    const mean = sum / n;
    if (mean <= -0.3) {
      const type = 'energia_grupo_baixa';
      if (this.inCooldownMeeting(meetingId, type, now)) return;
      const severity: 'info' | 'warning' = mean <= -0.5 ? 'warning' : 'info';
      this.setCooldownMeeting(meetingId, type, now, 30000);
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity,
        ts: now,
        meetingId,
        participantId: 'group',
        window: { start: now - this.longWindowMs, end: now },
        message:
          severity === 'warning'
            ? `Energia do grupo baixa. Considere perguntas diretas ou mudança de dinâmica.`
            : `Energia do grupo em queda. Estimule participação.`,
        tips: ['Convide pessoas específicas a opinar', 'Introduza uma pergunta aberta'],
        metadata: {
          arousalEMA: mean,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private evaluateInterrupcoesFrequentes(meetingId: string, participantId: string, now: number): void {
    const participants = this.participantsForMeeting(meetingId);
    if (participants.length < 2) return;
    // Determine if there is overlap in the short window
    let speakingCount = 0;
    const covers: Array<{ id: string; coverage: number }> = [];
    for (const [pid, st] of participants) {
      const w = this.window(st, now, this.shortWindowMs);
      if (w.samplesCount === 0) continue;
      const coverage = w.speechCount / w.samplesCount;
      covers.push({ id: pid, coverage });
      if (coverage >= 0.2) speakingCount++;
    }
    const keyThrottle = meetingId;
    if (speakingCount >= 2) {
      const lastAt = this.lastOverlapSampleAtByMeeting.get(keyThrottle) ?? 0;
      if (now - lastAt >= 2000) {
        this.lastOverlapSampleAtByMeeting.set(keyThrottle, now);
        const arr = this.overlapHistoryByMeeting.get(meetingId) ?? [];
        arr.push(now);
        // prune older than 60s
        const cutoff = now - 60000;
        while (arr.length > 0 && arr[0] < cutoff) arr.shift();
        this.overlapHistoryByMeeting.set(meetingId, arr);
        // Capturar candidato a pós-interrupção: se novo orador começou sobre o último orador
        const lastSpeaker = this.lastSpeakerByMeeting.get(meetingId);
        if (lastSpeaker) {
          const someoneElseSpeaking = covers.some((c) => c.id !== lastSpeaker && c.coverage >= 0.2);
          if (someoneElseSpeaking) {
            const st = this.byKey.get(this.key(meetingId, lastSpeaker));
            const before = st?.ema.valence;
            const list = this.postInterruptionCandidatesByMeeting.get(meetingId) ?? [];
            list.push({ ts: now, interruptedId: lastSpeaker, valenceBefore: before });
            // manter no máximo 10 registros
            while (list.length > 10) list.shift();
            this.postInterruptionCandidatesByMeeting.set(meetingId, list);
          }
        }
      }
    }
    const arr = this.overlapHistoryByMeeting.get(meetingId) ?? [];
    if (arr.length >= 5) {
      const type = 'interrupcoes_frequentes';
      if (this.inCooldownMeeting(meetingId, type, now)) return;
      this.setCooldownMeeting(meetingId, type, now, 30000);
      // identify top two speakers in long window to reference
      const longCovers = covers
        .map((c) => {
          const st = participants.find(([pid]) => pid === c.id)?.[1];
          if (!st) return { id: c.id, coverage: 0 };
          const w = this.window(st, now, this.longWindowMs);
          const cov = w.samplesCount > 0 ? w.speechCount / w.samplesCount : 0;
          return { id: c.id, coverage: cov };
        })
        .sort((a, b) => b.coverage - a.coverage)
        .slice(0, 2);
      const names = longCovers
        .map((x) => this.index.getParticipantName(meetingId, x.id) ?? x.id)
        .filter(Boolean);
      const who = names.length > 0 ? ` (${names.join(' , ')})` : '';
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'warning',
        ts: now,
        meetingId,
        participantId: 'group',
        window: { start: now - 60000, end: now },
        message: `Interrupções frequentes nos últimos 60s${who}. Combine turnos de fala.`,
        tips: ['Use levantar a mão', 'Defina ordem de fala'],
        metadata: {},
      };
      this.delivery.publishToHosts(meetingId, payload);
      // reset history after firing to avoid immediate re-triggers
      this.overlapHistoryByMeeting.set(meetingId, []);
    }
  }

  private evaluatePolarizacaoEmocional(meetingId: string, now: number): void {
    const participants = this.participantsForMeeting(meetingId);
    if (participants.length < 3) return;
    const negVals: number[] = [];
    const posVals: number[] = [];
    for (const [pid, st] of participants) {
      if (this.index.getParticipantRole(meetingId, pid) === 'host') continue;
      const w = this.window(st, now, this.longWindowMs);
      if (w.samplesCount === 0) continue;
      const coverage = w.speechCount / w.samplesCount;
      if (coverage < 0.3) continue;
      const v = st.ema.valence;
      if (typeof v !== 'number') continue;
      if (v <= -0.2) negVals.push(v);
      if (v >= 0.2) posVals.push(v);
    }
    if (negVals.length === 0 || posVals.length === 0) return;
    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const negMean = mean(negVals);
    const posMean = mean(posVals);
    if (posMean - negMean >= 0.5) {
      const type = 'polarizacao_emocional';
      if (this.inCooldownMeeting(meetingId, type, now)) return;
      this.setCooldownMeeting(meetingId, type, now, 45000);
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity: 'warning',
        ts: now,
        meetingId,
        participantId: 'group',
        window: { start: now - this.longWindowMs, end: now },
        message: `Polarização emocional no grupo (opiniões muito divergentes).`,
        tips: ['Reconheça pontos de ambos os lados', 'Estabeleça objetivos comuns antes de decidir'],
        metadata: {
          valenceEMA: Number(((posMean + negMean) / 2).toFixed(3)),
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
    }
  }

  private updateSpeakerTracking(meetingId: string, now: number): void {
    const participants = this.participantsForMeeting(meetingId);
    if (participants.length === 0) return;
    let topId: string | undefined;
    let topCov = 0;
    let secondCov = 0;
    for (const [pid, st] of participants) {
      const w = this.window(st, now, this.shortWindowMs);
      if (w.samplesCount === 0) continue;
      const cov = w.speechCount / w.samplesCount;
      if (cov > topCov) {
        secondCov = topCov;
        topCov = cov;
        topId = pid;
      } else if (cov > secondCov) {
        secondCov = cov;
      }
    }
    if (topId && topCov >= 0.5 && secondCov < 0.2) {
      this.lastSpeakerByMeeting.set(meetingId, topId);
    }
  }

  private evaluateEfeitoPosInterrupcao(meetingId: string, now: number): void {
    const list = this.postInterruptionCandidatesByMeeting.get(meetingId);
    if (!list || list.length === 0) return;
    const remaining: Array<{ ts: number; interruptedId: string; valenceBefore?: number }> = [];
    for (const rec of list) {
      const age = now - rec.ts;
      if (age < 6000) {
        // wait more time to observe effect
        remaining.push(rec);
        continue;
      }
      if (age > 30000) {
        // expired
        continue;
      }
      const st = this.byKey.get(this.key(meetingId, rec.interruptedId));
      if (!st || typeof st.ema.valence !== 'number' || typeof rec.valenceBefore !== 'number') {
        remaining.push(rec);
        continue;
      }
      const delta = st.ema.valence - rec.valenceBefore;
      const w = this.window(st, now, this.longWindowMs);
      const coverage = w.samplesCount > 0 ? w.speechCount / w.samplesCount : 0;
      if (delta <= -0.2 && coverage >= 0.2) {
        const type = 'efeito_pos_interrupcao';
        if (!this.inCooldown(st, type, now)) {
          this.setCooldown(st, type, now, 25000);
          const name = this.index.getParticipantName(meetingId, rec.interruptedId) ?? rec.interruptedId;
          const payload: FeedbackEventPayload = {
            id: this.makeId(),
            type,
            severity: 'warning',
            ts: now,
            meetingId,
            participantId: rec.interruptedId,
            window: { start: rec.ts, end: now },
            message: `${name}: queda de ânimo após interrupção.`,
            tips: ['Convide a concluir a ideia interrompida', 'Garanta espaço de fala'],
            metadata: {
              valenceEMA: st.ema.valence,
            },
          };
          this.delivery.publishToHosts(meetingId, payload);
        }
        // do not keep this record further after evaluation
      } else {
        remaining.push(rec);
      }
    }
    this.postInterruptionCandidatesByMeeting.set(meetingId, remaining);
  }

  private evaluateRitmoAceleradoPausado(
    meetingId: string,
    participantId: string,
    state: ParticipantState,
    now: number,
  ): void {
    const start = now - this.longWindowMs;
    const samples = state.samples.filter((s) => s.ts >= start);
    if (samples.length < 6) return;
    // compute transitions and segment durations
    let switches = 0;
    let speechSegments = 0;
    let silenceSegments = 0;
    let longestSilence = 0;
    let currentIsSpeech: boolean | undefined = undefined;
    let currentStart = start;
    let lastTs = start;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const segDur = (s.ts - lastTs) / 1000;
      if (typeof currentIsSpeech === 'boolean') {
        if (currentIsSpeech) {
          // speech segment
        } else {
          // silence segment
          if (segDur > longestSilence) longestSilence = segDur;
        }
      }
      if (typeof currentIsSpeech !== 'boolean') {
        currentIsSpeech = s.speech;
        currentStart = s.ts;
        lastTs = s.ts;
        continue;
      }
      if (s.speech !== currentIsSpeech) {
        switches++;
        // finalize segment
        const dur = (s.ts - currentStart) / 1000;
        if (currentIsSpeech) speechSegments++;
        else {
          silenceSegments++;
          if (dur > longestSilence) longestSilence = dur;
        }
        currentIsSpeech = s.speech;
        currentStart = s.ts;
      }
      lastTs = s.ts;
    }
    // finalize last segment until now
    const tailDur = (now - currentStart) / 1000;
    if (currentIsSpeech) speechSegments++;
    else {
      silenceSegments++;
      if (tailDur > longestSilence) longestSilence = tailDur;
    }
    const windowSec = this.longWindowMs / 1000;
    const switchesPerSec = switches / windowSec;
    const w = this.window(state, now, this.longWindowMs);
    const speechCoverage = w.samplesCount > 0 ? w.speechCount / w.samplesCount : 0;

    // Mutex: only evaluate ONE of these (prioritize acelerado if both conditions met)
    const isAccelerated = switchesPerSec >= 1.0 && speechSegments >= 6;
    const isPaused = longestSilence >= 3.0 || speechCoverage < 0.15;

    if (isAccelerated && isPaused) {
      // Conflito detectado: ignorar ambos
      return;
    }

    // ritmo acelerado
    if (isAccelerated) {
      const type = 'ritmo_acelerado';
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
      this.setCooldown(state, type, now, 20000);
      const severity: 'info' | 'warning' = switchesPerSec >= 1.5 ? 'warning' : 'info';
      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity,
        ts: now,
        meetingId,
        participantId,
        window: { start, end: now },
        message:
          severity === 'warning'
            ? `${name}: ritmo acelerado; desacelere para melhor entendimento.`
            : `${name}: ritmo rápido; considere pausas curtas.`,
        tips: ['Faça pausas para respiração', 'Enuncie com clareza'],
        metadata: {
          speechCoverage,
        },
      };
      this.delivery.publishToHosts(meetingId, payload);
      return;
    }

    // ritmo pausado
    if (isPaused) {
      const type = 'ritmo_pausado';
      if (this.inCooldown(state, type, now) || this.inGlobalCooldown(state, now)) return;
      this.setCooldown(state, type, now, 20000);
      const severity: 'info' | 'warning' = longestSilence >= 5.0 ? 'warning' : 'info';
      const name = this.index.getParticipantName(meetingId, participantId) ?? participantId;
      const payload: FeedbackEventPayload = {
        id: this.makeId(),
        type,
        severity,
        ts: now,
        meetingId,
        participantId,
        window: { start, end: now },
        message:
          severity === 'warning'
            ? `${name}: ritmo pausado; evite pausas longas.`
            : `${name}: ritmo lento; aumente um pouco a cadência.`,
        tips: ['Reduza pausas longas', 'Mantenha frases mais curtas'],
        metadata: {
          speechCoverage,
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
    // Update EMAs for specific emotions
    if (s.emotions) {
      for (const [name, score] of Object.entries(s.emotions)) {
        const key = name.toLowerCase();
        const prev = state.ema.emotions.get(key);
        const next = typeof prev === 'number' ? a * score + (1 - a) * prev : score;
        state.ema.emotions.set(key, next);
      }
    }
  }

  private inCooldown(state: ParticipantState, type: string, now: number): boolean {
    const until = state.cooldownUntilByType.get(type);
    return typeof until === 'number' && until > now;
  }

  private setCooldown(state: ParticipantState, type: string, now: number, ms: number): void {
    state.cooldownUntilByType.set(type, now + ms);
    state.lastFeedbackAt = now;
  }

  private inGlobalCooldown(state: ParticipantState, now: number, minGapMs = 5000): boolean {
    return typeof state.lastFeedbackAt === 'number' && now - state.lastFeedbackAt < minGapMs;
  }

  private initState(): ParticipantState {
    return {
      samples: [],
      ema: {
        emotions: new Map(),
      },
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

  private inCooldownMeeting(meetingId: string, type: string, now: number): boolean {
    const key = `${meetingId}:${type}`;
    const until = this.meetingCooldownByType.get(key);
    return typeof until === 'number' && until > now;
  }

  private setCooldownMeeting(meetingId: string, type: string, now: number, ms: number): void {
    const key = `${meetingId}:${type}`;
    this.meetingCooldownByType.set(key, now + ms);
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
