import { FeedbackEventPayload } from '../../feedback.types';
import { A2E2_THRESHOLDS } from '../thresholds/thresholds';
import { ParticipantState, DetectionContext } from '../types';

/**
 * Detecta hostilidade através de emoções primárias.
 * 
 * Regras A2E2:
 * - Detecta anger, disgust ou distress acima do threshold (0.05)
 * - Usa o maior valor entre as três emoções
 * - Requer speech coverage >= 20%
 * - Cooldown de 30s
 * 
 * @param state Estado do participante com samples e EMA
 * @param ctx Contexto de detecção (meetingId, participantId, now, helpers)
 * @returns FeedbackEventPayload se hostilidade detectada, null caso contrário
 */
export function detectHostility(
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
  // Hostilidade requer energia moderada, mas permite detecção com severidade menor se arousal está baixo
  const arousal = state.ema.arousal;
  if (typeof arousal === 'number' && arousal < 0.2) {
    return null; // Hostilidade sem energia mínima é falso positivo
  }

  // Obtém valores de emoções de hostilidade
  const anger = state.ema.emotions.get('anger') ?? 0;
  const disgust = state.ema.emotions.get('disgust') ?? 0;
  const distress = state.ema.emotions.get('distress') ?? 0;
  const hostilityScore = Math.max(anger, disgust, distress);

  // Verifica threshold
  const t = A2E2_THRESHOLDS.primary.hostility;
  if (hostilityScore <= t.anger) return null;

  // Verifica cooldowns
  const type = 'hostilidade';
  if (ctx.inCooldown(state, type, now) || ctx.inGlobalCooldown(state, now)) {
    return null;
  }

  // ETAPA 5: Gradação de severidade baseada em arousal
  // Se arousal está entre 0.2-0.3, permite mas com severidade menor
  const severity: 'info' | 'warning' =
    typeof arousal === 'number' && arousal >= 0.3 ? 'warning' : 'info';

  // Define cooldown
  ctx.setCooldown(state, type, now, A2E2_THRESHOLDS.cooldowns.primaryEmotion.hostility);

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
    message: `${name}: a conversa esquentou. Considere validar o ponto do outro antes de prosseguir.`,
    tips: ['Respire fundo', 'Use frases como "Entendo seu ponto..."', 'Evite interrupções agora'],
    metadata: {
      valenceEMA: state.ema.valence,
      speechCoverage,
    },
  };
}
