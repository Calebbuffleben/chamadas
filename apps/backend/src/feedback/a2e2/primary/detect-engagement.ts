import { FeedbackEventPayload } from '../../feedback.types';
import { A2E2_THRESHOLDS } from '../thresholds/thresholds';
import { ParticipantState, DetectionContext } from '../types';

/**
 * Detecta engajamento positivo através de emoções primárias.
 * 
 * Regras A2E2:
 * - Detecta interest, joy OU determination acima do threshold (0.05)
 * - Usa o maior valor entre as três emoções
 * - Requer speech coverage >= 30%
 * - Cooldown de 60s (mais longo para evitar spam de elogios)
 * 
 * @param state Estado do participante com samples e EMA
 * @param ctx Contexto de detecção (meetingId, participantId, now, helpers)
 * @returns FeedbackEventPayload se engajamento detectado, null caso contrário
 */
export function detectEngagement(
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

  // ETAPA 5: Verificações contextuais relaxadas com gradação de severidade
  // Engajamento requer tom positivo e energia moderada, mas permite casos limítrofes com severidade menor
  const valence = state.ema.valence;
  const arousal = state.ema.arousal;
  const anger = state.ema.emotions.get('anger') ?? 0;
  const disgust = state.ema.emotions.get('disgust') ?? 0;
  const distress = state.ema.emotions.get('distress') ?? 0;

  // Bloqueios absolutos (contradições lógicas claras)
  if (typeof valence === 'number' && valence <= -0.3) {
    return null; // Engajamento com tom muito negativo é contraditório
  }
  if (typeof arousal === 'number' && arousal < 0.1) {
    return null; // Engajamento sem energia mínima é contraditório
  }
  if (anger > 0.05 || disgust > 0.05 || distress > 0.05) {
    return null; // Engajamento com hostilidade significativa é contraditório
  }

  // Obtém valores de emoções
  const interest = state.ema.emotions.get('interest') ?? 0;
  const joy = state.ema.emotions.get('joy') ?? 0;
  const determination = state.ema.emotions.get('determination') ?? 0;
  const score = Math.max(interest, joy, determination);

  // Verifica threshold
  const t = A2E2_THRESHOLDS.primary.engagement;
  if (score <= t.interest) return null;

  // Verifica cooldowns
  const type = 'entusiasmo_alto';
  if (ctx.inCooldown(state, type, now) || ctx.inGlobalCooldown(state, now)) {
    return null;
  }

  // ETAPA 5: Gradação de severidade para casos limítrofes
  let severity: 'info' | 'warning' = 'warning';
  if (typeof valence === 'number' && valence <= -0.1) {
    severity = 'info'; // Tom ligeiramente negativo
  }
  if (typeof arousal === 'number' && arousal < 0.2) {
    severity = 'info'; // Energia baixa
  }
  if (anger > 0.03 || disgust > 0.03 || distress > 0.03) {
    severity = 'info'; // Pequenas emoções negativas
  }

  // Define cooldown (mais longo para evitar spam)
  ctx.setCooldown(state, type, now, A2E2_THRESHOLDS.cooldowns.primaryEmotion.positiveEngagement);

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
    message: `${name}: ótima energia e clareza! O grupo parece engajado.`,
    tips: ['Mantenha esse tom', 'Aproveite para definir próximos passos'],
    metadata: {
      speechCoverage,
    },
  };
}
