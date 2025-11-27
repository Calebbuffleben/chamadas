import { FeedbackEventPayload } from '../../feedback.types';
import { A2E2_THRESHOLDS } from '../thresholds/thresholds';
import { ParticipantState, DetectionContext } from '../types';

/**
 * Detecta tédio através de emoções primárias.
 * 
 * Regras A2E2:
 * - Detecta boredom > 0.05 OU tiredness > 0.08
 * - E interest < 0.05 (baixo interesse confirma tédio)
 * - Requer speech coverage >= 15%
 * - Cooldown de 25s
 * 
 * @param state Estado do participante com samples e EMA
 * @param ctx Contexto de detecção (meetingId, participantId, now, helpers)
 * @returns FeedbackEventPayload se tédio detectado, null caso contrário
 */
export function detectBoredom(
  state: ParticipantState,
  ctx: DetectionContext,
): FeedbackEventPayload | null {
  const { meetingId, participantId, now } = ctx;
  const longWindowMs = A2E2_THRESHOLDS.windows.long;
  const minSpeechPrimary = A2E2_THRESHOLDS.gates.minSpeechPrimary;

  // Validações básicas
  const w = ctx.window(state, now, longWindowMs);
  // ETAPA 1: Mínimo ajustado de 10 para 6 amostras (janela de 10s, taxa ~1 amostra/s)
  // 6 amostras = 60% da janela esperada, permite detecção precoce de emoções primárias
  if (w.samplesCount < 6) return null;
  if (state.ema.emotions.size === 0) return null;

  // Verifica speech coverage
  const speechCoverage = w.samplesCount > 0 ? w.speechCount / w.samplesCount : 0;
  if (speechCoverage < minSpeechPrimary) return null;

  // ETAPA 5: Verificação contextual relaxada com gradação de severidade
  // Tédio pode coexistir com pequena frustração, mas frustração significativa prevalece
  const frustration = state.ema.emotions.get('frustration') ?? 0;
  if (frustration > 0.05) {
    return null; // Frustração significativa prevalece sobre tédio
  }

  // Obtém valores de emoções
  const boredom = state.ema.emotions.get('boredom') ?? 0;
  const tiredness = state.ema.emotions.get('tiredness') ?? 0;
  const interest = state.ema.emotions.get('interest') ?? 0;

  // Verifica thresholds
  const t = A2E2_THRESHOLDS.primary.boredom;
  const hasBoredomOrTiredness = boredom > t.boredom || tiredness > t.tiredness;
  const hasLowInterest = interest < t.interestLow;

  if (!hasBoredomOrTiredness || !hasLowInterest) return null;

  // Verifica cooldowns
  const type = 'tedio';
  if (ctx.inCooldown(state, type, now) || ctx.inGlobalCooldown(state, now)) {
    return null;
  }

  // ETAPA 5: Gradação de severidade baseada em frustração
  // Se frustração está entre 0.03-0.05, permite mas com severidade menor
  const severity: 'info' | 'warning' = frustration > 0.03 ? 'info' : 'warning';

  // Define cooldown
  ctx.setCooldown(state, type, now, A2E2_THRESHOLDS.cooldowns.primaryEmotion.boredom);

  // Gera feedback
  const name = ctx.getParticipantName(meetingId, participantId) ?? participantId;
  return {
    id: ctx.makeId(),
    type,
    severity,
    ts: now,
    meetingId,
    participantId,
    window: { start: w.start, end: w.end },
    message: `${name}: energia baixa detectada. Que tal trazer um novo ponto de vista?`,
    tips: ['Mude a entonação', 'Faça uma pergunta aberta ao grupo'],
    metadata: {
      arousalEMA: state.ema.arousal,
      speechCoverage,
    },
  };
}
