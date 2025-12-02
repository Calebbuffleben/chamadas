# Contagem de Emoções Tratadas no Sistema A2E2

## Emoções Tratadas Diretamente nos Detectores Primários

### **Total: 11 emoções únicas**

### 1. **Hostilidade** (`detect-hostility.ts`)
- `anger`
- `disgust`
- `distress`

### 2. **Confusão** (`detect-confusion.ts`)
- `confusion`
- `doubt`

### 3. **Frustração** (`detect-frustration.ts`)
- `frustration`

### 4. **Tédio** (`detect-boredom.ts`)
- `boredom`
- `tiredness`
- `interest` (usado para verificar se está baixo - confirma tédio)

### 5. **Engajamento** (`detect-engagement.ts`)
- `interest` (usado para detectar engajamento)
- `joy`
- `determination`

---

## Lista Completa (Emoções Únicas)

| # | Emoção | Uso Principal | Uso Secundário |
|---|--------|---------------|----------------|
| 1 | `anger` | Hostilidade | Validação contextual em Engajamento (bloqueio) |
| 2 | `disgust` | Hostilidade | Validação contextual em Engajamento (bloqueio) |
| 3 | `distress` | Hostilidade | Validação contextual em Engajamento (bloqueio) |
| 4 | `confusion` | Confusão | - |
| 5 | `doubt` | Confusão | - |
| 6 | `frustration` | Frustração | Validação contextual em Tédio (bloqueio) |
| 7 | `boredom` | Tédio | - |
| 8 | `tiredness` | Tédio | - |
| 9 | `interest` | Engajamento | Validação contextual em Tédio (verificar se está baixo) |
| 10 | `joy` | Engajamento | - |
| 11 | `determination` | Engajamento | - |

---

## Emoções por Detector

### Detector: Hostilidade
- **3 emoções**: anger, disgust, distress
- **Método**: `Math.max(anger, disgust, distress)` - usa a maior entre as 3

### Detector: Confusão
- **2 emoções**: confusion, doubt
- **Método**: `Math.max(confusion, doubt)` - usa a maior entre as 2

### Detector: Frustração
- **1 emoção**: frustration
- **Método**: valor direto de `frustration`

### Detector: Tédio
- **3 emoções**: boredom, tiredness, interest
- **Método**: 
  - `boredom > threshold` OU `tiredness > threshold`
  - E `interest < threshold` (verificação complementar)

### Detector: Engajamento
- **3 emoções**: interest, joy, determination
- **Método**: `Math.max(interest, joy, determination)` - usa a maior entre as 3

---

## Emoções Usadas em Validações Contextuais

### Em `detect-engagement.ts`:
- `anger`, `disgust`, `distress` → **bloqueiam** Engajamento se qualquer uma > 0.05

### Em `detect-boredom.ts`:
- `frustration` → **bloqueia** Tédio se > 0.05

### Em `detect-hostility.ts`:
- Não usa outras emoções (apenas `arousal` como validação contextual)

### Em `detect-confusion.ts`:
- Não usa outras emoções (apenas `valence` como validação contextual)

### Em `detect-frustration.ts`:
- Não usa outras emoções (sem validações contextuais de emoções)

---

## Resumo Estatístico

- **Total de emoções únicas**: **11**
- **Detectores primários**: **5**
- **Emoções com uso duplo**: **1** (`interest` - usado em Engajamento e Tédio)
- **Emoções usadas apenas para bloqueio**: **4** (anger, disgust, distress, frustration - quando usadas em validações contextuais)

---

## Distribuição de Emoções

| Categoria | Emoções | Quantidade |
|-----------|---------|------------|
| **Negativas/Hostis** | anger, disgust, distress | 3 |
| **Confusão/Dúvida** | confusion, doubt | 2 |
| **Frustração** | frustration | 1 |
| **Baixa Energia** | boredom, tiredness | 2 |
| **Positivas** | interest, joy, determination | 3 |

---

## Notas Importantes

1. **`interest` tem uso duplo**:
   - Em **Engajamento**: valores altos indicam engajamento positivo
   - Em **Tédio**: valores baixos confirmam tédio

2. **Emoções usadas apenas para bloqueio**:
   - `anger`, `disgust`, `distress` bloqueiam Engajamento
   - `frustration` bloqueia Tédio

3. **O sistema armazena TODAS as emoções** da Hume API no EMA, mas apenas **11 são utilizadas ativamente** nos detectores primários.

4. **A Hume API retorna aproximadamente 48 emoções**, então o sistema está utilizando cerca de **23% das emoções disponíveis**.

---

**Documento gerado em**: Análise de contagem de emoções
**Baseado em**: Código dos 5 detectores primários em `apps/backend/src/feedback/a2e2/primary/`

