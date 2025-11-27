import { FeedbackEventPayload } from '../../feedback.types';
import { A2E2_THRESHOLDS } from '../thresholds/thresholds';

/**
 * Tipo para estado do participante
 */
type ParticipantState = {
  samples: Array<{ ts: number; speech: boolean }>;
  ema: {
    emotions: Map<string, number>;
    valence?: number;
  };
  cooldownUntilByType: Map<string, number>;
  lastFeedbackAt?: number;
};

/**
 * Tipo para contexto de detecção
 */
type DetectionContext = {
  meetingId: string;
  participantId: string;
  now: number;
  getParticipantName: (meetingId: string, participantId: string) => string | undefined;
  inCooldown: (state: ParticipantState, type: string, now: number) => boolean;
  inGlobalCooldown: (state: ParticipantState, now: number) => boolean;
  setCooldown: (state: ParticipantState, type: string, now: number, cooldownMs: number) => void;
  makeId: () => string;
  window: (state: ParticipantState, now: number, windowMs: number) => {
    start: number;
    end: number;
    samplesCount: number;
    speechCount: number;
  };
};

/**
 * Detecta frustração através de emoção primária (PRIMARY).
 * 
 * Esta é a detecção primária de frustração. Se não houver emoções primárias,
 * o sistema usa detectFrustrationTrend() como fallback.
 * 
 * Hierarquia de detecção de frustração:
 * 1. PRIMARY: detectFrustration() - detecta frustração direta via emoção primária
 *    - Só executa se state.ema.emotions.size > 0
 *    - Detecta quando frustration > 0.05
 * 2. FALLBACK: detectFrustrationTrend() - detecta frustração via tendência prosódica
 *    - Só executa se state.ema.emotions.size === 0 (sem emoções primárias)
 *    - Detecta quando arousal aumenta E valence diminui
 * 
 * Regras A2E2:
 * - Detecta frustration acima do threshold (0.05)
 * - Requer speech coverage >= 20%
 * - Cooldown de 25s
 * - Só executa se há emoções primárias detectadas
 * 
 * Nota: Ambos usam o mesmo type 'frustracao_crescente' para compartilhar cooldown.
 * 
 * @param state Estado do participante com samples e EMA
 * @param ctx Contexto de detecção (meetingId, participantId, now, helpers)
 * @returns FeedbackEventPayload se frustração detectada, null caso contrário
 */
export function detectFrustration(
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

  // Obtém valor de frustração
  const frustration = state.ema.emotions.get('frustration') ?? 0;

  // Verifica threshold
  const t = A2E2_THRESHOLDS.primary.frustration;
  if (frustration <= t.frustration) return null;

  // Verifica cooldowns
  const type = 'frustracao_crescente';
  if (ctx.inCooldown(state, type, now) || ctx.inGlobalCooldown(state, now)) {
    return null;
  }

  // Define cooldown
  ctx.setCooldown(state, type, now, A2E2_THRESHOLDS.cooldowns.primaryEmotion.frustration);

  // Gera feedback
  const name = ctx.getParticipantName(meetingId, participantId) ?? participantId;
  return {
    id: ctx.makeId(),
    type,
    severity: 'warning',
    ts: now,
    meetingId,
    participantId,
    window: { start: w.start, end: w.end },
    message: `${name}: parece haver um bloqueio ou frustração.`,
    tips: ['Reconheça a dificuldade', 'Pergunte: "O que está impedindo nosso progresso?"'],
    metadata: {
      valenceEMA: state.ema.valence,
      speechCoverage,
    },
  };
}
