# Análise: Relação entre Feedbacks e Emoções Recebidas

## Processamento de Emoções

### Pipeline de Dados
1. **Ingestão**: `FeedbackIngestionEvent` contém `prosody.emotions` (Record<string, number>)
2. **Armazenamento**: Cada `Sample` armazena `emotions` diretamente do evento
3. **Agregação**: EMA (Exponential Moving Average) com `alpha = 0.3` aplicado a cada emoção individual
4. **Estado**: `state.ema.emotions` é um `Map<string, number>` com scores EMA por emoção

### Características do EMA
- **Alpha = 0.3**: Dá peso de 30% ao valor novo, 70% ao histórico
- **Efeito**: Suaviza variações rápidas, mantém tendências de médio prazo
- **Problema**: Pode atrasar detecção de mudanças emocionais súbitas

---

## Mapeamento Emoção → Feedback

### 1. HOSTILIDADE (`hostilidade`)
**Emoções usadas**: `anger`, `disgust`, `distress`
- **Lógica**: `Math.max(anger, disgust, distress) > 0.05`
- **Threshold**: 0.05 (5%)
- **Janela**: 10s (longWindowMs)
- **Cooldown**: 30s
- **Severity**: `warning`
- **Gate**: Requer `state.ema.emotions.size > 0` (sem fallback)

**Análise**:
- ✅ Usa 3 emoções relacionadas (cobertura ampla)
- ⚠️ Threshold baixo (0.05) pode gerar falsos positivos
- ⚠️ Não considera intensidade relativa entre as 3 emoções
- ⚠️ Log apenas quando > 0.03, mas threshold é 0.05 (gap de diagnóstico)

---

### 2. TÉDIO (`tedio`)
**Emoções usadas**: `boredom`, `tiredness`, `interest` (negativo)
- **Lógica**: `(boredom > 0.05 || tiredness > 0.08) && interest < 0.05`
- **Thresholds**: 
  - Boredom: 0.05
  - Tiredness: 0.08 (mais tolerante)
  - Interest: < 0.05 (deve ser baixo)
- **Janela**: 10s
- **Cooldown**: 25s
- **Severity**: `info`
- **Gate**: Requer emoções no EMA

**Análise**:
- ✅ Lógica combinatória (AND) reduz falsos positivos
- ⚠️ Thresholds assimétricos (0.05 vs 0.08) podem ser inconsistentes
- ⚠️ Interest baixo é necessário, mas não verifica se houve interesse antes
- ✅ Log diagnóstico quando próximo do threshold

---

### 3. FRUSTRAÇÃO (`frustracao_crescente`)
**Emoções usadas**: `frustration` (direto)
- **Lógica**: `frustration > 0.05`
- **Threshold**: 0.05
- **Janela**: 10s
- **Cooldown**: 25s
- **Severity**: `warning`
- **Gate**: Requer emoções no EMA

**Fallback** (quando `state.ema.emotions.size === 0`):
- Usa tendência de `arousal` e `valence` em 20s
- `arousalDelta >= 0.25 && valenceDelta <= -0.2`
- Mesmo `type` mas lógica diferente

**Análise**:
- ✅ Detecção direta da emoção específica
- ⚠️ Fallback usa métricas diferentes (pode gerar inconsistências)
- ⚠️ Dois caminhos para mesmo feedback podem confundir análise
- ✅ Log quando > 0.03 para diagnóstico

---

### 4. CONFUSÃO (`confusao`)
**Emoções usadas**: `confusion`, `doubt`
- **Lógica**: `Math.max(confusion, doubt) > 0.05`
- **Threshold**: 0.05
- **Janela**: 10s
- **Cooldown**: 20s
- **Severity**: `info`
- **Gate**: Requer emoções no EMA

**Análise**:
- ✅ Usa 2 emoções relacionadas
- ⚠️ Threshold único (0.05) pode não capturar nuances
- ⚠️ Não diferencia entre confusion e doubt (mesmo tratamento)
- ✅ Log diagnóstico implementado

---

### 5. ENGAJAMENTO POSITIVO (`entusiasmo_alto`)
**Emoções usadas**: `interest`, `joy`, `determination`
- **Lógica**: `Math.max(interest, joy, determination) > 0.05`
- **Threshold**: 0.05
- **Janela**: 10s
- **Cooldown**: 60s (mais longo para evitar spam de elogios)
- **Severity**: `info`
- **Gate**: Requer emoções no EMA

**Fallback** (quando emoções não disponíveis):
- Usa `arousal EMA >= 0.5` com `speechCoverage >= 0.5`
- Mesmo `type` mas lógica diferente

**Análise**:
- ✅ Cooldown longo (60s) evita spam de feedback positivo
- ⚠️ Threshold baixo (0.05) pode gerar muitos feedbacks
- ⚠️ Fallback usa arousal puro (menos preciso que emoções específicas)
- ⚠️ Conflito potencial: pode disparar junto com fallback de arousal

---

## Retornos dos Feedbacks

### 1. HOSTILIDADE (`hostilidade`)
**Payload retornado:**
```typescript
{
  type: 'hostilidade',
  severity: 'warning',
  message: `${name}: a conversa esquentou. Considere validar o ponto do outro antes de prosseguir.`,
  tips: [
    'Respire fundo',
    'Use frases como "Entendo seu ponto..."',
    'Evite interrupções agora'
  ],
  metadata: {
    valenceEMA: state.ema.valence
  },
  window: { start: now - 10000, end: now }
}
```

---

### 2. TÉDIO (`tedio`)
**Payload retornado:**
```typescript
{
  type: 'tedio',
  severity: 'info',
  message: `${name}: energia baixa detectada. Que tal trazer um novo ponto de vista?`,
  tips: [
    'Mude a entonação',
    'Faça uma pergunta aberta ao grupo'
  ],
  metadata: {
    arousalEMA: state.ema.arousal
  },
  window: { start: now - 10000, end: now }
}
```

---

### 3. FRUSTRAÇÃO (`frustracao_crescente`)
**Payload retornado (versão emoção direta):**
```typescript
{
  type: 'frustracao_crescente',
  severity: 'warning',
  message: `${name}: parece haver um bloqueio ou frustração.`,
  tips: [
    'Reconheça a dificuldade',
    'Pergunte: "O que está impedindo nosso progresso?"'
  ],
  metadata: {
    valenceEMA: state.ema.valence
  },
  window: { start: now - 10000, end: now }
}
```

**Payload retornado (versão fallback por tendência):**
```typescript
{
  type: 'frustracao_crescente',
  severity: 'warning',
  message: `${name}: indícios de frustração crescente.`,
  tips: [
    'Reduza o ritmo e cheque entendimento',
    'Valide objeções antes de avançar'
  ],
  metadata: {
    arousalEMA: state.ema.arousal,
    valenceEMA: state.ema.valence
  },
  window: { start: now - 20000, end: now }
}
```

---

### 4. CONFUSÃO (`confusao`)
**Payload retornado:**
```typescript
{
  type: 'confusao',
  severity: 'info',
  message: `${name}: pontos de dúvida detectados. Seria bom checar o entendimento.`,
  tips: [
    'Pergunte: "Isso faz sentido?"',
    'Ofereça um exemplo prático'
  ],
  metadata: {},
  window: { start: now - 10000, end: now }
}
```

---

### 5. ENGAJAMENTO POSITIVO (`entusiasmo_alto`)
**Payload retornado (versão emoção direta):**
```typescript
{
  type: 'entusiasmo_alto',
  severity: 'info',
  message: `${name}: ótima energia e clareza! O grupo parece engajado.`,
  tips: [
    'Mantenha esse tom',
    'Aproveite para definir próximos passos'
  ],
  metadata: {},
  window: { start: now - 10000, end: now }
}
```

**Payload retornado (versão fallback arousal):**
```typescript
{
  type: 'entusiasmo_alto',
  severity: arousal >= 0.7 ? 'warning' : 'info',
  message: arousal >= 0.7
    ? `${name}: energia muito alta; canalize em próximos passos.`
    : `${name}: entusiasmo alto; ótimo momento para direcionar ações.`,
  tips: [
    'Direcione para decisões e próximos passos'
  ],
  metadata: {
    arousalEMA: arousal,
    speechCoverage: speechCoverage
  },
  window: { start: now - 10000, end: now }
}
```

---

### 6. TENDÊNCIA EMOCIONAL NEGATIVA (`tendencia_emocional_negativa`)
**Payload retornado:**
```typescript
{
  type: 'tendencia_emocional_negativa',
  severity: valence <= -0.6 ? 'warning' : 'info',
  message: valence <= -0.6
    ? `${name}: tom negativo perceptível. Considere suavizar a comunicação.`
    : `${name}: tendência emocional negativa. Tente um tom mais positivo.`,
  tips: [
    'Mostre concordância antes de divergir',
    'Evite frases muito secas'
  ],
  metadata: {
    valenceEMA: valence,
    speechCoverage: speechCoverage
  },
  window: { start: now - 10000, end: now }
}
```

---

### 7. ENGAJAMENTO BAIXO (`engajamento_baixo`)
**Payload retornado:**
```typescript
{
  type: 'engajamento_baixo',
  severity: arousal <= -0.4 ? 'warning' : 'info',
  message: arousal <= -0.4
    ? `${name}: engajamento baixo (tom desanimado).`
    : `${name}: energia baixa. Um pouco mais de ênfase pode ajudar.`,
  tips: [
    'Fale com mais variação de tom',
    'Projete a voz mais próxima do microfone'
  ],
  metadata: {
    arousalEMA: arousal,
    speechCoverage: speechCoverage
  },
  window: { start: now - 10000, end: now }
}
```

---

### 8. MONOTONIA PROSÓDICA (`monotonia_prosodica`)
**Payload retornado:**
```typescript
{
  type: 'monotonia_prosodica',
  severity: stdev < 0.06 ? 'warning' : 'info',
  message: stdev < 0.06
    ? `${name}: fala monótona; varie entonação e pausas.`
    : `${name}: pouca variação de entonação.`,
  tips: [
    'Use pausas e ênfases para destacar pontos'
  ],
  metadata: {
    arousalEMA: state.ema.arousal
  },
  window: { start: now - 10000, end: now }
}
```

---

### 9. ENERGIA GRUPO BAIXA (`energia_grupo_baixa`)
**Payload retornado:**
```typescript
{
  type: 'energia_grupo_baixa',
  participantId: 'group',
  severity: mean <= -0.5 ? 'warning' : 'info',
  message: mean <= -0.5
    ? `Energia do grupo baixa. Considere perguntas diretas ou mudança de dinâmica.`
    : `Energia do grupo em queda. Estimule participação.`,
  tips: [
    'Convide pessoas específicas a opinar',
    'Introduza uma pergunta aberta'
  ],
  metadata: {
    arousalEMA: mean
  },
  window: { start: now - 10000, end: now }
}
```

---

### 10. INTERRUPÇÕES FREQUENTES (`interrupcoes_frequentes`)
**Payload retornado:**
```typescript
{
  type: 'interrupcoes_frequentes',
  participantId: 'group',
  severity: 'warning',
  message: `Interrupções frequentes nos últimos 60s${who}. Combine turnos de fala.`,
  tips: [
    'Use levantar a mão',
    'Defina ordem de fala'
  ],
  metadata: {},
  window: { start: now - 60000, end: now }
}
```
*Nota: `who` contém nomes dos 2 participantes que mais falaram*

---

### 11. POLARIZAÇÃO EMOCIONAL (`polarizacao_emocional`)
**Payload retornado:**
```typescript
{
  type: 'polarizacao_emocional',
  participantId: 'group',
  severity: 'warning',
  message: `Polarização emocional no grupo (opiniões muito divergentes).`,
  tips: [
    'Reconheça pontos de ambos os lados',
    'Estabeleça objetivos comuns antes de decidir'
  ],
  metadata: {
    valenceEMA: Number(((posMean + negMean) / 2).toFixed(3))
  },
  window: { start: now - 10000, end: now }
}
```

---

### 12. EFEITO PÓS-INTERRUPÇÃO (`efeito_pos_interrupcao`)
**Payload retornado:**
```typescript
{
  type: 'efeito_pos_interrupcao',
  severity: 'warning',
  message: `${name}: queda de ânimo após interrupção.`,
  tips: [
    'Convide a concluir a ideia interrompida',
    'Garanta espaço de fala'
  ],
  metadata: {
    valenceEMA: st.ema.valence
  },
  window: { start: interruptionTimestamp, end: now }
}
```

---

### 13. RITMO ACELERADO (`ritmo_acelerado`)
**Payload retornado:**
```typescript
{
  type: 'ritmo_acelerado',
  severity: switchesPerSec >= 1.5 ? 'warning' : 'info',
  message: switchesPerSec >= 1.5
    ? `${name}: ritmo acelerado; desacelere para melhor entendimento.`
    : `${name}: ritmo rápido; considere pausas curtas.`,
  tips: [
    'Faça pausas para respiração',
    'Enuncie com clareza'
  ],
  metadata: {
    speechCoverage: speechCoverage
  },
  window: { start: now - 10000, end: now }
}
```

---

### 14. RITMO PAUSADO (`ritmo_pausado`)
**Payload retornado:**
```typescript
{
  type: 'ritmo_pausado',
  severity: longestSilence >= 7.0 ? 'warning' : 'info',
  message: longestSilence >= 7.0
    ? `${name}: pausas muito longas (≥7s); tente manter um ritmo mais constante.`
    : `${name}: ritmo lento; considere reduzir pausas longas.`,
  tips: [
    'Reduza pausas longas',
    'Mantenha frases mais curtas'
  ],
  metadata: {
    speechCoverage: speechCoverage
  },
  window: { start: now - 10000, end: now }
}
```

---

### 15. VOLUME BAIXO (`volume_baixo`)
**Payload retornado:**
```typescript
{
  type: 'volume_baixo',
  severity: level <= -34 ? 'critical' : 'warning',
  message: level <= -34
    ? `${name}: quase inaudível; aumente o ganho imediatamente.`
    : `${name}: volume baixo; aproxime-se do microfone.`,
  tips: level <= -34
    ? ['Aumente o ganho de entrada', 'Aproxime-se do microfone']
    : ['Verifique entrada de áudio', 'Desative redução agressiva de ruído'],
  metadata: {
    rmsDbfs: level,
    speechCoverage: speechCoverage
  },
  window: { start: now - 3000, end: now }
}
```

---

### 16. VOLUME ALTO (`volume_alto`)
**Payload retornado:**
```typescript
{
  type: 'volume_alto',
  severity: level >= -6 ? 'critical' : 'warning',
  message: level >= -6
    ? `${name}: áudio clipando; reduza o ganho.`
    : `${name}: volume alto; afaste-se um pouco.`,
  tips: [
    'Reduza sensibilidade do microfone'
  ],
  metadata: {
    rmsDbfs: level,
    speechCoverage: speechCoverage
  },
  window: { start: now - 3000, end: now }
}
```

---

### 17. SILÊNCIO PROLONGADO (`silencio_prolongado`)
**Payload retornado:**
```typescript
{
  type: 'silencio_prolongado',
  severity: 'warning',
  message: `${name}: sem áudio há 60s; microfone pode estar desconectado.`,
  tips: [
    'Verifique se o microfone está conectado',
    'Cheque as permissões de áudio'
  ],
  metadata: {
    speechCoverage: speechCoverage,
    rmsDbfs: rms
  },
  window: { start: now - 60000, end: now }
}
```

---

### 18. OVERLAP DE FALA (`overlap_fala`)
**Payload retornado:**
```typescript
{
  type: 'overlap_fala',
  severity: 'warning',
  message: `${name} e outra pessoa falando ao mesmo tempo com frequência.`,
  tips: [
    'Combine turnos de fala',
    'Use levantar a mão'
  ],
  metadata: {
    speechCoverage: coverage
  },
  window: { start: now - 10000, end: now }
}
```

---

### 19. MONÓLOGO PROLONGADO (`monologo_prolongado`)
**Payload retornado:**
```typescript
{
  type: 'monologo_prolongado',
  severity: 'warning',
  message: `${name}: fala dominante (≥80% nos últimos 60s).`,
  tips: [
    'Convide outras pessoas a opinar'
  ],
  metadata: {
    speechCoverage: ratio
  },
  window: { start: now - 60000, end: now }
}
```
*Nota: Esta heurística está desabilitada no código (comentada na linha 130)*

---

## Heurísticas Baseadas em Valence/Arousal (Fallback)

### 6. TENDÊNCIA EMOCIONAL NEGATIVA (`tendencia_emocional_negativa`)
**Métrica**: `valence EMA`
- **Lógica**: `valence <= -0.6 || valence <= -0.35` (bug: segunda condição sempre true se primeira for)
- **Thresholds**: -0.6 (severe), -0.35 (info)
- **Gate**: Só executa se `state.ema.emotions.size === 0`
- **Requer**: `speechCoverage >= 0.4`

**Análise**:
- ⚠️ **BUG**: Condição `val <= -0.6 || val <= -0.35` é redundante (se <= -0.6, sempre <= -0.35)
- ✅ Fallback útil quando emoções não disponíveis
- ⚠️ Substituída por `hostilidade` quando emoções disponíveis

---

### 7. ENGAJAMENTO BAIXO (`engajamento_baixo`)
**Métrica**: `arousal EMA`
- **Lógica**: `arousal <= -0.4 || arousal <= -0.2` (mesmo bug de condição)
- **Thresholds**: -0.4 (warning), -0.2 (info)
- **Gate**: Só executa se `state.ema.emotions.size === 0`
- **Requer**: `speechCoverage >= 0.3`

**Análise**:
- ⚠️ **BUG**: Mesma redundância de condição
- ✅ Substituída por `tedio` quando emoções disponíveis
- ⚠️ Thresholds podem ser muito sensíveis para arousal

---

### 8. FRUSTRAÇÃO CRESCENTE (Fallback)
**Métricas**: Tendência de `arousal` e `valence` em 20s
- **Lógica**: `arousalDelta >= 0.25 && valenceDelta <= -0.2`
- **Janela**: 20s (trendWindowMs)
- **Gate**: Só executa se `state.ema.emotions.size === 0`

**Análise**:
- ✅ Detecta padrão temporal (crescimento de arousal + queda de valence)
- ⚠️ Requer muitos samples (speechN >= 5, totalN >= 8)
- ⚠️ Pode não capturar frustração estável (só detecta "crescente")

---

## Heurísticas Híbridas (Emoções + Valence/Arousal)

### 9. ENTUASIASMO ALTO (Fallback Arousal)
**Métrica**: `arousal EMA`
- **Lógica**: `arousal >= 0.5` com `speechCoverage >= 0.5`
- **Threshold**: 0.5
- **Severity**: `arousal >= 0.7` → warning, senão info
- **Gate**: Não verifica se emoções existem (sempre executa)

**Análise**:
- ⚠️ **CONFLITO**: Pode disparar junto com `evaluatePositiveEngagement` (mesmo type)
- ⚠️ Não tem gate de emoções (sempre executa, mesmo com emoções disponíveis)
- ⚠️ Pode gerar feedbacks duplicados ou conflitantes

---

### 10. MONOTONIA PROSÓDICA (`monotonia_prosodica`)
**Métrica**: Variância de `arousal` (não EMA, valores brutos)
- **Lógica**: `stdev(arousal) < 0.1` em janela de 10s
- **Threshold**: stdev < 0.1 (info), < 0.06 (warning)
- **Requer**: `speechN >= 5 && values.length >= 5`

**Análise**:
- ✅ Usa variância (medida de variação, não nível absoluto)
- ⚠️ Não usa EMA, usa valores brutos (pode ser mais ruidoso)
- ⚠️ Não relacionado diretamente a emoções específicas
- ✅ Detecta padrão prosódico (variação de entonação)

---

### 11. ENERGIA GRUPO BAIXA (`energia_grupo_baixa`)
**Métrica**: Média de `arousal EMA` entre convidados
- **Lógica**: `mean(arousal) <= -0.3` (warning se <= -0.5)
- **Requer**: `coverage >= 0.3` por participante
- **Nível**: Grupo (não individual)

**Análise**:
- ✅ Agregação de nível de grupo
- ⚠️ Não usa emoções específicas (só arousal agregado)
- ⚠️ Pode não capturar nuances emocionais do grupo
- ✅ Ignora host (foco em convidados)

---

### 12. POLARIZAÇÃO EMOCIONAL (`polarizacao_emocional`)
**Métrica**: `valence EMA` por participante
- **Lógica**: Separa participantes em `valence <= -0.2` (neg) e `valence >= 0.2` (pos)
- **Condição**: `posMean - negMean >= 0.5`
- **Requer**: Pelo menos 3 participantes, coverage >= 0.3

**Análise**:
- ✅ Detecta divisão emocional no grupo
- ⚠️ Usa apenas valence (não emoções específicas)
- ⚠️ Threshold de 0.5 de diferença pode ser muito alto
- ✅ Requer múltiplos participantes (evita falsos positivos)

---

### 13. EFEITO PÓS-INTERRUPÇÃO (`efeito_pos_interrupcao`)
**Métrica**: Mudança de `valence EMA` após interrupção
- **Lógica**: `valenceDelta <= -0.2` após 6-30s da interrupção
- **Requer**: `coverage >= 0.2` após interrupção
- **Tracking**: Captura `valenceBefore` no momento da interrupção

**Análise**:
- ✅ Detecta efeito temporal (causa → efeito)
- ⚠️ Depende de tracking de interrupções (pode perder casos)
- ⚠️ Janela de 6-30s pode ser muito restritiva
- ✅ Usa valence (proxy para estado emocional)

---

## Heurísticas Não-Emocionais (Áudio/Ritmo)

### 14-19. Volume, Silêncio, Overlap, Ritmo
- **Não usam emoções diretamente**
- Dependem de `speechDetected`, `rmsDbfs`, padrões temporais
- **Observação**: Mesmo sem emoções, essas heurísticas funcionam

---

## Problemas Identificados

### 1. **Conflito de Type: `entusiasmo_alto`**
- `evaluatePositiveEngagement` (emoções) e `evaluateEntusiasmoAlto` (arousal) usam mesmo type
- Ambos podem disparar simultaneamente
- **Solução**: Adicionar gate em `evaluateEntusiasmoAlto` para não executar quando emoções disponíveis

### 2. **Bugs de Condição Redundante**
- `tendencia_emocional_negativa`: `val <= -0.6 || val <= -0.35` (sempre true se primeira for)
- `engajamento_baixo`: `ar <= -0.4 || ar <= -0.2` (mesmo problema)
- **Solução**: Usar `if/else` ou remover condição redundante

### 3. **Thresholds Inconsistentes**
- Maioria usa 0.05 para emoções, mas `tiredness` usa 0.08
- `arousal` usa 0.5, mas emoções usam 0.05
- **Solução**: Padronizar ou documentar razão das diferenças

### 4. **Dependência de EMA**
- EMA com alpha=0.3 pode atrasar detecção
- Não há detecção de picos súbitos (só tendências)
- **Solução**: Considerar detecção de picos além de EMA

### 5. **Gaps de Diagnóstico**
- Logs apenas quando próximo do threshold (0.03), mas threshold é 0.05
- Falta logging quando emoções não chegam (silêncio)
- **Solução**: Melhorar logging para diagnóstico completo

### 6. **Fallbacks Conflitantes**
- Múltiplos caminhos para mesmo feedback podem gerar inconsistências
- `frustracao_crescente` tem 2 implementações diferentes
- **Solução**: Unificar lógica ou separar types

---

## Recomendações

1. **Padronizar thresholds** ou documentar razões das diferenças
2. **Adicionar gates** para evitar conflitos entre heurísticas baseadas em emoções vs. arousal
3. **Corrigir bugs** de condições redundantes
4. **Melhorar logging** para diagnóstico completo do pipeline emocional
5. **Considerar detecção de picos** além de EMA para capturar mudanças súbitas
6. **Unificar fallbacks** ou separar types para evitar confusão

---

## Estatísticas de Uso de Emoções

### Emoções Usadas Diretamente:
- `anger`, `disgust`, `distress` → hostilidade
- `boredom`, `tiredness`, `interest` → tedio
- `frustration` → frustracao_crescente
- `confusion`, `doubt` → confusao
- `interest`, `joy`, `determination` → entusiasmo_alto

### Emoções NÃO Usadas (mas podem estar disponíveis):
- Qualquer outra emoção do modelo Hume (48 emoções possíveis)
- **Gap**: Sistema não aproveita todas as emoções disponíveis

### Métricas Agregadas Usadas:
- `valence` → tendencia_emocional_negativa, polarizacao_emocional, efeito_pos_interrupcao
- `arousal` → engajamento_baixo, entusiasmo_alto, monotonia_prosodica, energia_grupo_baixa

---

## Padrões de Retorno e Relação com Emoções

### Severidades por Tipo de Feedback

**Critical:**
- `volume_baixo` (quando RMS <= -34 dBFS)
- `volume_alto` (quando RMS >= -6 dBFS)

**Warning:**
- `hostilidade` (sempre)
- `frustracao_crescente` (sempre)
- `tendencia_emocional_negativa` (quando valence <= -0.6)
- `engajamento_baixo` (quando arousal <= -0.4)
- `entusiasmo_alto` (quando arousal >= 0.7 - versão fallback)
- `monotonia_prosodica` (quando stdev < 0.06)
- `energia_grupo_baixa` (quando mean <= -0.5)
- `interrupcoes_frequentes` (sempre)
- `polarizacao_emocional` (sempre)
- `efeito_pos_interrupcao` (sempre)
- `ritmo_acelerado` (quando switchesPerSec >= 1.5)
- `ritmo_pausado` (quando longestSilence >= 7.0)
- `silencio_prolongado` (sempre)
- `overlap_fala` (sempre)
- `monologo_prolongado` (sempre)

**Info:**
- `tedio` (sempre)
- `confusao` (sempre)
- `entusiasmo_alto` (quando emoções > 0.05 ou arousal < 0.7)
- `tendencia_emocional_negativa` (quando -0.6 < valence <= -0.35)
- `engajamento_baixo` (quando -0.4 < arousal <= -0.2)
- `monotonia_prosodica` (quando 0.06 <= stdev < 0.1)
- `energia_grupo_baixa` (quando -0.5 < mean <= -0.3)
- `ritmo_acelerado` (quando 1.0 <= switchesPerSec < 1.5)
- `ritmo_pausado` (quando 5.0 <= longestSilence < 7.0)

### Relação Emoção → Mensagem

**Emoções Negativas:**
- `anger`, `disgust`, `distress` → "a conversa esquentou"
- `frustration` → "parece haver um bloqueio ou frustração"
- `confusion`, `doubt` → "pontos de dúvida detectados"
- `boredom`, `tiredness` + `interest` baixo → "energia baixa detectada"

**Emoções Positivas:**
- `interest`, `joy`, `determination` → "ótima energia e clareza! O grupo parece engajado"

**Valence/Arousal (Fallback):**
- `valence` muito negativo → "tom negativo perceptível" / "tendência emocional negativa"
- `arousal` muito baixo → "engajamento baixo (tom desanimado)" / "energia baixa"
- `arousal` muito alto → "energia muito alta" / "entusiasmo alto"

### Padrões de Metadata

**Metadata com Valence:**
- `hostilidade`: `{ valenceEMA }`
- `frustracao_crescente`: `{ valenceEMA }` (versão emoção) ou `{ arousalEMA, valenceEMA }` (versão fallback)
- `tendencia_emocional_negativa`: `{ valenceEMA, speechCoverage }`
- `polarizacao_emocional`: `{ valenceEMA }` (média)
- `efeito_pos_interrupcao`: `{ valenceEMA }`

**Metadata com Arousal:**
- `tedio`: `{ arousalEMA }`
- `engajamento_baixo`: `{ arousalEMA, speechCoverage }`
- `entusiasmo_alto`: `{ arousalEMA, speechCoverage }` (versão fallback) ou `{}` (versão emoção)
- `monotonia_prosodica`: `{ arousalEMA }`
- `energia_grupo_baixa`: `{ arousalEMA }` (média)

**Metadata com RMS:**
- `volume_baixo`: `{ rmsDbfs, speechCoverage }`
- `volume_alto`: `{ rmsDbfs, speechCoverage }`
- `silencio_prolongado`: `{ speechCoverage, rmsDbfs }`

**Metadata com Speech Coverage:**
- `overlap_fala`: `{ speechCoverage }`
- `monologo_prolongado`: `{ speechCoverage }` (ratio)
- `ritmo_acelerado`: `{ speechCoverage }`
- `ritmo_pausado`: `{ speechCoverage }`

**Sem Metadata:**
- `confusao`: `{}`
- `entusiasmo_alto` (versão emoção): `{}`
- `interrupcoes_frequentes`: `{}`
- `polarizacao_emocional`: `{ valenceEMA }` (mas pode ser vazio em alguns casos)

### Janelas Temporais

**3 segundos (shortWindowMs):**
- `volume_baixo`
- `volume_alto`

**10 segundos (longWindowMs):**
- `hostilidade`
- `tedio`
- `frustracao_crescente` (versão emoção)
- `confusao`
- `entusiasmo_alto`
- `tendencia_emocional_negativa`
- `engajamento_baixo`
- `monotonia_prosodica`
- `energia_grupo_baixa`
- `polarizacao_emocional`
- `ritmo_acelerado`
- `ritmo_pausado`
- `overlap_fala`

**20 segundos (trendWindowMs):**
- `frustracao_crescente` (versão fallback)

**60 segundos:**
- `silencio_prolongado`
- `interrupcoes_frequentes`
- `monologo_prolongado`

**Dinâmica (6-30s após evento):**
- `efeito_pos_interrupcao`

### Cooldowns

**Mais curtos (10-15s):**
- `volume_baixo`: 10s
- `volume_alto`: 10s
- `overlap_fala`: 15s

**Médios (20-30s):**
- `confusao`: 20s
- `monotonia_prosodica`: 20s
- `ritmo_acelerado`: 20s
- `tedio`: 25s
- `frustracao_crescente`: 25s
- `efeito_pos_interrupcao`: 25s
- `hostilidade`: 30s
- `silencio_prolongado`: 30s
- `energia_grupo_baixa`: 30s
- `interrupcoes_frequentes`: 30s

**Longos (45-60s):**
- `polarizacao_emocional`: 45s
- `entusiasmo_alto` (versão emoção): 60s
- `ritmo_pausado`: 60s

### Observações sobre Retornos

1. **Feedback de Grupo vs Individual:**
   - `energia_grupo_baixa`, `interrupcoes_frequentes`, `polarizacao_emocional` → `participantId: 'group'`
   - Demais → `participantId` específico

2. **Mensagens Dinâmicas:**
   - Maioria usa template com `${name}` (nome do participante)
   - Severidade altera mensagem em: `volume_baixo`, `volume_alto`, `tendencia_emocional_negativa`, `engajamento_baixo`, `entusiasmo_alto` (fallback), `monotonia_prosodica`, `energia_grupo_baixa`, `ritmo_acelerado`, `ritmo_pausado`

3. **Tips Consistentes:**
   - Feedbacks emocionais negativos sugerem validação e suavização
   - Feedbacks de ritmo sugerem pausas e clareza
   - Feedbacks de grupo sugerem participação e organização

4. **Gaps de Metadata:**
   - `confusao` e `entusiasmo_alto` (emoção) não incluem metadata
   - Poderia incluir scores das emoções detectadas para diagnóstico

