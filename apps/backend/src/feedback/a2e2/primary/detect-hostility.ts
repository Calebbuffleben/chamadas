import { FeedbackEventPayload } from '../../feedback.types';
import { A2E2_THRESHOLDS } from '../thresholds/thresholds';
import { ParticipantState, DetectionContext } from '../types';
import { calculateTensionLevel, getHostilityThreshold, getThreatThreshold, getThresholdByTrend, hasConsistentTrend, hasRecentOverlap, calculateEmotionTrend } from '../context/context-adjustments';

/**
 * Detecta hostilidade através de emoções primárias.
 * 
 * FASE 2: Expandido para detectar múltiplas emoções de hostilidade e ameaça.
 * FASE 9: Padronizada lógica de detecção de emoção dominante.
 * FASE 10.2: Validações baseadas em subcategorias (ativa vs medo/ameaça).
 * FASE 10.3.1: Thresholds dinâmicos baseados em tensão emocional.
 * 
 * Regras A2E2:
 * - Detecta emoções de hostilidade ativa OU medo/ameaça acima dos thresholds
 * - Usa subcategorias:
 *   - Hostilidade Ativa: anger, disgust, distress, rage, contempt
 *   - Medo/Ameaça: fear, horror, terror, anxiety
 * - Usa Math.max() por subcategoria, depois Math.max() entre subcategorias
 * - Requer speech coverage >= 18%
 * - Cooldown de 30s
 * 
 * Validações contextuais:
 * - Hostilidade ativa: arousal >= 0.2, valence negativo
 * - Medo/Ameaça: arousal >= 0.15 (mais baixo, medo pode ter menos energia)
 * 
 * Severidade:
 * - Terror/Horror/Rage: sempre 'warning'
 * - Fear/Anxiety: 'warning' se > 0.10, senão 'info'
 * - Outras: baseado em arousal (>= 0.3 = 'warning')
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

  // FASE 2: Obtém valores de emoções por subcategoria
  // Hostilidade Ativa: anger, disgust, distress, rage, contempt
  const anger = state.ema.emotions.get('anger') ?? 0;
  const disgust = state.ema.emotions.get('disgust') ?? 0;
  const distress = state.ema.emotions.get('distress') ?? 0;
  const rage = state.ema.emotions.get('rage') ?? 0;
  const contempt = state.ema.emotions.get('contempt') ?? 0;
  const activeHostilityScore = Math.max(anger, disgust, distress, rage, contempt);

  // Medo/Ameaça: fear, horror, terror, anxiety
  const fear = state.ema.emotions.get('fear') ?? 0;
  const horror = state.ema.emotions.get('horror') ?? 0;
  const terror = state.ema.emotions.get('terror') ?? 0;
  const anxiety = state.ema.emotions.get('anxiety') ?? 0;
  const threatScore = Math.max(fear, horror, terror, anxiety);

  // Usa o maior score entre as duas subcategorias
  const hostilityScore = Math.max(activeHostilityScore, threatScore);

  // FASE 2: Obtém arousal e valence para cálculos
  const arousal = state.ema.arousal;
  const valence = state.ema.valence;

  // FASE 10.3.1: Calcula nível de tensão e ajusta thresholds dinamicamente
  const tensionLevel = ctx.getTensionLevel ? ctx.getTensionLevel(state) : calculateTensionLevel(arousal, valence);
  
  // FASE 10.3.1: Calcula tendência temporal para cada emoção principal
  const getEmotionTrendValue = (emotionName: string): 'increasing' | 'decreasing' | 'stable' => {
    if (ctx.getEmotionTrend) {
      return ctx.getEmotionTrend(state, emotionName, 10_000, now);
    }
    // Fallback: calcula tendência baseada no histórico de emoções
    if (ctx.getRecentEmotions) {
      const recentEmotions = ctx.getRecentEmotions(state, 10_000, now);
      return calculateEmotionTrend(recentEmotions, emotionName, 10_000, now);
    }
    return 'stable';
  };
  
  // Verifica thresholds por subcategoria com ajustes dinâmicos
  // Verifica se qualquer emoção na subcategoria está acima do seu threshold específico
  const t = A2E2_THRESHOLDS.primary.hostility;
  
  // Aplica ajustes por tensão primeiro, depois por tendência temporal
  const tAdjusted = {
    // Hostilidade ativa: ajusta thresholds em alta tensão + tendência temporal
    anger: getThresholdByTrend(getHostilityThreshold(t.anger, tensionLevel), getEmotionTrendValue('anger'), 'negative'),
    disgust: getThresholdByTrend(getHostilityThreshold(t.disgust, tensionLevel), getEmotionTrendValue('disgust'), 'negative'),
    distress: getThresholdByTrend(getHostilityThreshold(t.distress, tensionLevel), getEmotionTrendValue('distress'), 'negative'),
    rage: getThresholdByTrend(getHostilityThreshold(t.rage, tensionLevel), getEmotionTrendValue('rage'), 'negative'),
    contempt: getThresholdByTrend(getHostilityThreshold(t.contempt, tensionLevel), getEmotionTrendValue('contempt'), 'negative'),
    // Medo/Ameaça: ajusta thresholds em alta tensão (redução menor) + tendência temporal
    fear: getThresholdByTrend(getThreatThreshold(t.fear, tensionLevel), getEmotionTrendValue('fear'), 'negative'),
    horror: getThresholdByTrend(getThreatThreshold(t.horror, tensionLevel), getEmotionTrendValue('horror'), 'negative'),
    terror: getThresholdByTrend(getThreatThreshold(t.terror, tensionLevel), getEmotionTrendValue('terror'), 'negative'),
    anxiety: getThresholdByTrend(getThreatThreshold(t.anxiety, tensionLevel), getEmotionTrendValue('anxiety'), 'negative'),
  };
  
  const hasActiveHostility = 
    anger > tAdjusted.anger ||
    disgust > tAdjusted.disgust ||
    distress > tAdjusted.distress ||
    rage > tAdjusted.rage ||
    contempt > tAdjusted.contempt;
  const hasThreat = 
    fear > tAdjusted.fear ||
    horror > tAdjusted.horror ||
    terror > tAdjusted.terror ||
    anxiety > tAdjusted.anxiety;

  // Precisa ter pelo menos uma subcategoria acima do threshold
  if (!hasActiveHostility && !hasThreat) {
    return null;
  }

  // FASE 10.3.1: Bloqueio por oscilação rápida
  // Se hostilidade foi detectada 3+ vezes nos últimos 30s, bloqueia para evitar spam
  if (ctx.getRecentEmotions) {
    const recentEmotions = ctx.getRecentEmotions(state, 30_000, now);
    const recentHostilityCount = recentEmotions.filter((e) => e.type === 'hostilidade').length;
    if (recentHostilityCount >= 3) {
      return null; // Oscilação rápida detectada, bloqueia para evitar spam
    }
    
    // FASE 10.3.1: Bloqueio por sobreposição recente
    // Se hostilidade similar foi detectada nos últimos 20s e score atual não é > 20% maior, bloqueia
    if (hasRecentOverlap(recentEmotions, 'hostilidade', hostilityScore, 20_000, now)) {
      return null; // Sobreposição recente detectada, bloqueia para evitar spam
    }
    
    // FASE 10.3.1: Validação por tendência consistente
    // Se hostilidade está aumentando consistentemente (3+ detecções consecutivas), reduz threshold adicional
    if (hasConsistentTrend(recentEmotions, 'hostilidade', 30_000, now)) {
      // Aplica redução adicional de 10% para detecção precoce
      Object.keys(tAdjusted).forEach((key) => {
        const k = key as keyof typeof tAdjusted;
        tAdjusted[k] = tAdjusted[k] * 0.9;
      });
    }
  }

  // FASE 2: Validações contextuais por subcategoria
  // (arousal e valence já obtidos acima)

  // Hostilidade ativa requer energia moderada (arousal >= 0.2)
  if (hasActiveHostility && typeof arousal === 'number' && arousal < 0.2) {
    return null; // Hostilidade ativa sem energia mínima é falso positivo
  }

  // Medo/Ameaça requer energia mínima menor (arousal >= 0.15)
  // Medo pode ter menos energia que hostilidade ativa
  if (hasThreat && typeof arousal === 'number' && arousal < 0.15) {
    return null; // Medo sem energia mínima é falso positivo
  }

  // Hostilidade ativa geralmente tem valence negativo
  // Mas não bloqueamos se for medo (medo pode ter valence variado)
  if (hasActiveHostility && !hasThreat && typeof valence === 'number' && valence > 0.1) {
    return null; // Hostilidade ativa com tom muito positivo é contraditório
  }

  // Verifica cooldowns
  const type = 'hostilidade';
  if (ctx.inCooldown(state, type, now) || ctx.inGlobalCooldown(state, now)) {
    return null;
  }

  // FASE 2: Gradação de severidade baseada em emoção e arousal
  let severity: 'info' | 'warning' = 'info';

  // Terror, Horror e Rage são sempre 'warning' (emoções extremas)
  if (terror > tAdjusted.terror || horror > tAdjusted.horror || rage > tAdjusted.rage) {
    severity = 'warning';
  }
  // Fear e Anxiety: 'warning' se > 0.10, senão 'info'
  else if (fear > 0.10 || anxiety > 0.10) {
    severity = 'warning';
  }
  // Outras emoções: baseado em arousal (>= 0.3 = 'warning')
  else if (typeof arousal === 'number' && arousal >= 0.3) {
    severity = 'warning';
  }

  // Define cooldown
  ctx.setCooldown(state, type, now, A2E2_THRESHOLDS.cooldowns.primaryEmotion.hostility);

  // FASE 2: Gera feedback baseado na subcategoria dominante
  const name = ctx.getParticipantName(meetingId, participantId) ?? participantId;
  
  let message = `${name}: a conversa esquentou. Considere validar o ponto do outro antes de prosseguir.`;
  let tips: string[] = ['Respire fundo', 'Use frases como "Entendo seu ponto..."', 'Evite interrupções agora'];

  // FASE 9: Mensagens específicas baseadas na emoção dominante (padronizado)
  // Padrão: emoção > threshold && emoção === score && emoção > outras na mesma categoria
  if (threatScore > activeHostilityScore) {
    // Medo/Ameaça é dominante
    const isTerrorDominant = terror > tAdjusted.terror && terror === threatScore && terror > Math.max(fear, horror, anxiety);
    const isHorrorDominant = horror > tAdjusted.horror && horror === threatScore && horror > Math.max(fear, terror, anxiety);
    const isFearDominant = fear > tAdjusted.fear && fear === threatScore && fear > Math.max(horror, terror, anxiety);
    const isAnxietyDominant = anxiety > tAdjusted.anxiety && anxiety === threatScore && anxiety > Math.max(fear, horror, terror);
    
    if (isTerrorDominant) {
      message = `${name}: pânico extremo detectado. Priorize acalmar o ambiente.`;
      tips = ['Crie um espaço seguro', 'Valide o medo expresso', 'Reduza a pressão imediatamente'];
    } else if (isHorrorDominant) {
      message = `${name}: horror detectado. Ambiente precisa de acalmação urgente.`;
      tips = ['Crie um espaço seguro', 'Valide o sentimento', 'Considere fazer uma pausa'];
    } else if (isFearDominant) {
      message = `${name}: medo detectado. Considere criar um ambiente mais seguro.`;
      tips = ['Valide o medo expresso', 'Crie um espaço seguro', 'Reduza a pressão'];
    } else if (isAnxietyDominant) {
      message = `${name}: ansiedade detectada. Considere reduzir a pressão.`;
      tips = ['Valide a ansiedade', 'Reduza a pressão', 'Crie um ambiente mais acolhedor'];
    }
  } else {
    // Hostilidade ativa é dominante
    const isRageDominant = rage > t.rage && rage === activeHostilityScore && rage > Math.max(anger, disgust, distress, contempt);
    const isContemptDominant = contempt > tAdjusted.contempt && contempt === activeHostilityScore && contempt > Math.max(anger, disgust, distress, rage);
    
    if (isRageDominant) {
      message = `${name}: raiva explosiva detectada. Priorize desescalar a situação.`;
      tips = ['Não reaja com raiva', 'Respire fundo', 'Considere fazer uma pausa'];
    } else if (isContemptDominant) {
      message = `${name}: desprezo detectado. Considere validar o ponto do outro.`;
      tips = ['Evite julgamentos', 'Valide diferentes perspectivas', 'Mantenha respeito'];
    }
  }

  return {
    id: ctx.makeId(),
    type,
    severity,
    ts: now,
    meetingId,
    participantId,
    window: { start: w.start, end: w.end },
    message,
    tips,
    metadata: {
      valenceEMA: state.ema.valence,
      arousalEMA: state.ema.arousal,
      speechCoverage,
    },
  };
}
