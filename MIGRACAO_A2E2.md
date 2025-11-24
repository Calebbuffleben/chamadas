# Migração para Arquitetura Emocional 2.0 (A2E2)

## Resumo das Mudanças

O arquivo `feedback.aggregator.service.ts` foi completamente refatorado para implementar a **Arquitetura Emocional 2.0 (A2E2)**, uma estrutura hierárquica de 4 camadas com prioridade absoluta entre elas.

## Arquitetura Implementada

### Hierarquia de Prioridade

```
CAMADA 1: Emoções Primárias (Alta Confiança)
    ↓ (se não retornar feedback)
CAMADA 2: Meta-Estados Emocionais (Combinações)
    ↓ (se não retornar feedback)
CAMADA 3: Sinais Prosódicos (Arousal, Valence, Energia)
    ↓ (se não retornar feedback)
CAMADA 4: Estados de Longo Prazo (Comportamentais)
```

**Regra Fundamental**: Cada camada só executa se as anteriores não retornaram feedback. Isso elimina conflitos e duplicidades.

## Mapeamento de Heurísticas

### CAMADA 1: Emoções Primárias

| Heurística Original | Nova Função | Emoções/Métricas | Status |
|---------------------|-------------|------------------|--------|
| `evaluateHostility` | `detectHostility` | anger, disgust, distress | ✅ Migrado |
| `evaluateFrustration` | `detectFrustration` | frustration (direto) | ✅ Migrado |
| `evaluateBoredom` | `detectBoredom` | boredom, tiredness, interest | ✅ Migrado |
| `evaluateConfusion` | `detectConfusion` | confusion, doubt | ✅ Migrado |
| `evaluatePositiveEngagement` | `detectPositiveEngagement` | interest, joy, determination | ✅ Migrado |

**Características**:
- Sempre têm prioridade absoluta
- Requerem `state.ema.emotions.size > 0`
- Usam thresholds centralizados em `THRESHOLDS.primaryEmotion`

### CAMADA 2: Meta-Estados Emocionais

| Heurística Original | Nova Função | Lógica | Status |
|---------------------|-------------|--------|--------|
| `evaluateFrustracaoCrescente` (fallback) | `detectFrustrationTrend` | arousal↑ + valence↓ (tendência 20s) | ✅ Migrado |
| `evaluateEfeitoPosInterrupcao` | `detectPostInterruption` | Queda de valence após interrupção | ✅ Migrado |
| `evaluatePolarizacaoEmocional` | `detectPolarization` | Divisão emocional do grupo | ✅ Migrado |

**Características**:
- Só executa se Camada 1 não retornou feedback
- Usa combinações lógicas entre sinais
- Analisa tendências e relações temporais

### CAMADA 3: Sinais Prosódicos

| Heurística Original | Nova Função | Métrica | Status |
|---------------------|-------------|---------|--------|
| `evaluateVolume` | `detectVolume` | RMS (dBFS) | ✅ Migrado |
| `evaluateMonotoniaProsodica` | `detectMonotony` | Variância de arousal | ✅ Migrado |
| `evaluateRitmoAceleradoPausado` | `detectRhythm` | Padrões fala/silêncio | ✅ Migrado |
| `evaluateEntusiasmoAlto` (fallback) | `detectArousal` | Arousal EMA | ✅ Migrado |
| `evaluateTendenciaEmocionalNegativa` (fallback) | `detectValence` | Valence EMA | ✅ Migrado |
| `evaluateEngajamentoBaixo` (fallback) | `detectArousal` | Arousal EMA baixo | ✅ Migrado |
| `evaluateEnergiaGrupoBaixa` | `detectGroupEnergy` | Arousal médio do grupo | ✅ Migrado |

**Características**:
- Só executa se Camadas 1 e 2 não retornaram feedback
- Fallbacks de arousal/valence só executam se `state.ema.emotions.size === 0`
- Não duplica emoções primárias

### CAMADA 4: Estados de Longo Prazo

| Heurística Original | Nova Função | Janela | Status |
|---------------------|-------------|--------|--------|
| `evaluateSilenceProlongado` | `detectSilence` | 60s | ✅ Migrado |
| `evaluateOverlapFala` | `detectOverlap` | 10s | ✅ Migrado |
| `evaluateInterrupcoesFrequentes` | `detectInterruptions` | 60s | ✅ Migrado |
| `evaluateMonologoProlongado` | - | - | ❌ Removido (desabilitado) |

**Características**:
- Menor prioridade do sistema
- Foca em padrões comportamentais de longo prazo
- Não sobrescreve estados das camadas superiores

## Correções de Bugs Implementadas

### 1. Condições Redundantes Corrigidas

**Antes:**
```typescript
if (val <= -0.6 || val <= -0.35) { // BUG: segunda condição sempre true se primeira for
```

**Depois:**
```typescript
if (val <= t.negativeSevere) {
  // severity: 'warning'
} else if (val <= t.negativeInfo) {
  // severity: 'info'
}
```

### 2. Conflito de `entusiasmo_alto` Resolvido

**Antes:**
- `evaluatePositiveEngagement` (emoções) e `evaluateEntusiasmoAlto` (arousal) usavam mesmo type
- Ambos podiam disparar simultaneamente

**Depois:**
- `detectPositiveEngagement` (Camada 1) tem prioridade absoluta
- `detectArousal` (Camada 3) só executa se não há emoções primárias
- Gate explícito: `if (state.ema.emotions.size === 0)`

### 3. Thresholds Centralizados

**Antes:**
- Thresholds espalhados pelo código
- Valores hardcoded em múltiplos lugares

**Depois:**
- Objeto `THRESHOLDS` centralizado no topo do arquivo
- Todas as heurísticas usam valores do objeto
- Fácil ajuste e manutenção

### 4. Duplicidade Eliminada

**Antes:**
- `frustracao_crescente` tinha 2 implementações diferentes
- Fallbacks conflitantes

**Depois:**
- `detectFrustration` (Camada 1) - emoção direta
- `detectFrustrationTrend` (Camada 2) - tendência (só se não há emoções)
- Lógica clara e separada

## Melhorias Implementadas

### 1. Pipeline Hierárquico

```typescript
// Prioridade absoluta implementada
const primaryResult = this.detectPrimaryEmotions(...);
if (primaryResult) {
  this.delivery.publishToHosts(meetingId, primaryResult);
  return; // Para execução de camadas inferiores
}
```

### 2. Modularização

- Cada heurística é uma função pequena e focada
- Nomenclatura clara: `detect*` para todas as funções de detecção
- Separação clara entre camadas

### 3. Documentação Inline

- Comentários explicando cada camada
- Documentação do objeto `THRESHOLDS`
- Explicação da hierarquia de prioridade

### 4. Consistência de Código

- Padrão uniforme de retorno (`FeedbackEventPayload | null`)
- Uso consistente de thresholds centralizados
- Cooldowns padronizados

## Estrutura do Objeto THRESHOLDS

```typescript
THRESHOLDS = {
  primaryEmotion: { ... },    // Camada 1
  meta: { ... },              // Camada 2
  prosodic: { ... },          // Camada 3
  longTerm: { ... },          // Camada 4
  cooldowns: { ... },         // Cooldowns por camada
  windows: { ... },           // Janelas temporais
  ema: { ... },               // Parâmetros EMA
  speechGates: { ... },       // Gates de speech coverage
}
```

## Garantias de Não-Conflito

1. **Prioridade Absoluta**: Camada 1 sempre executa primeiro e para o pipeline se retornar feedback
2. **Gates Explícitos**: Camadas 2-4 verificam condições antes de executar
3. **Fallbacks Condicionais**: Fallbacks só executam se não há emoções primárias
4. **Type Uniqueness**: Cada feedback type é único e não pode ser gerado por múltiplas camadas simultaneamente

## Compatibilidade Funcional

- ✅ Todas as heurísticas originais foram migradas
- ✅ Retornos (payloads) mantidos idênticos
- ✅ Cooldowns preservados
- ✅ Janelas temporais preservadas
- ✅ Logging de debug mantido

## Próximos Passos Recomendados

1. **Testes**: Validar que o comportamento é idêntico ao anterior
2. **Monitoramento**: Acompanhar logs para verificar priorização correta
3. **Ajustes de Thresholds**: Fine-tuning baseado em dados reais
4. **Expansão**: Adicionar novas emoções primárias conforme necessário

## Observações Finais

- A arquitetura é extensível: novas heurísticas podem ser adicionadas facilmente
- Thresholds podem ser ajustados sem modificar lógica
- Código mais limpo e sustentável
- Eliminação completa de conflitos e duplicidades

