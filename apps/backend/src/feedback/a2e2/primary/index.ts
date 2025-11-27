export { detectHostility } from './detect-hostility';
export { detectFrustration } from './detect-frustration';
export { detectBoredom } from './detect-boredom';
export { detectConfusion } from './detect-confusion';
export { detectEngagement } from './detect-engagement';

import { FeedbackEventPayload } from '../../feedback.types';
import { ParticipantState, DetectionContext } from '../types';
import { detectHostility } from './detect-hostility';
import { detectFrustration } from './detect-frustration';
import { detectBoredom } from './detect-boredom';
import { detectConfusion } from './detect-confusion';
import { detectEngagement } from './detect-engagement';

/**
 * Executa todas as heurísticas de emoções primárias na ordem de prioridade.
 * 
 * Ordem de execução:
 * 1. Hostilidade
 * 2. Frustração
 * 3. Tédio
 * 4. Confusão
 * 5. Engajamento
 * 
 * Retorna o primeiro feedback encontrado ou null se nenhum for detectado.
 */
export function run(
  state: ParticipantState,
  ctx: DetectionContext,
): FeedbackEventPayload | null {
  return (
    detectHostility(state, ctx) ??
    detectFrustration(state, ctx) ??
    detectBoredom(state, ctx) ??
    detectConfusion(state, ctx) ??
    detectEngagement(state, ctx) ??
    null
  );
}

