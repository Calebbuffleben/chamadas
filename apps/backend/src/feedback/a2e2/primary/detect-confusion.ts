import { FeedbackEventPayload } from '../../feedback.types';
import { A2E2_THRESHOLDS } from '../thresholds/thresholds';
import { ParticipantState, DetectionContext } from '../types';

/**
 * Detecta confusão através de emoções primárias.
 * 
 * Regras A2E2:
 * - Detecta confusion OU doubt acima do threshold (0.05)
 * - Usa o maior valor entre as duas emoções
 * - Requer speech coverage >= 20%
 * - Cooldown de 20s
 * 
 * @param state Estado do participante com samples e EMA
 * @param ctx Contexto de detecção (meetingId, participantId, now, helpers)
 * @returns FeedbackEventPayload se confusão detectada, null caso contrário
 */
export function detectConfusion(
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
  // Confusão geralmente tem tom neutro/negativo, mas permite detecção com severidade menor se tom está ligeiramente positivo
  const valence = state.ema.valence;
  if (typeof valence === 'number' && valence > 0.2) {
    return null; // Confusão com tom muito positivo é contraditório
  }

  // Obtém valores de emoções
  const confusion = state.ema.emotions.get('confusion') ?? 0;
  const doubt = state.ema.emotions.get('doubt') ?? 0;
  const score = Math.max(confusion, doubt);

  // Verifica threshold
  const t = A2E2_THRESHOLDS.primary.confusion;
  if (score <= t.confusion) return null;

  // Verifica cooldowns
  const type = 'confusao';
  if (ctx.inCooldown(state, type, now) || ctx.inGlobalCooldown(state, now)) {
    return null;
  }

  // ETAPA 5: Gradação de severidade baseada em valence
  // Se valence está entre 0.1-0.2, permite mas com severidade menor
  const severity: 'info' | 'warning' =
    typeof valence === 'number' && valence <= 0.0 ? 'warning' : 'info';

  // Define cooldown
  ctx.setCooldown(state, type, now, A2E2_THRESHOLDS.cooldowns.primaryEmotion.confusion);

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
    message: `${name}: pontos de dúvida detectados. Seria bom checar o entendimento.`,
    tips: ['Pergunte: "Isso faz sentido?"', 'Ofereça um exemplo prático'],
    metadata: {
      speechCoverage,
    },
  };
}
