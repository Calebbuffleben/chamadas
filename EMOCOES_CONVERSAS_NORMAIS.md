# Emoções e Feedbacks Mais Frequentes em Conversas Normais

## Análise Baseada em Thresholds, Cooldowns e Validações

---

## 🟢 Emoções Mais Frequentes (Thresholds Baixos + Cooldowns Curtos)

### 1. **Engajamento Positivo** ⭐⭐⭐⭐⭐
**Probabilidade: MUITO ALTA**

**Thresholds mais baixos:**
- `interest`: **0.06** (mais baixo de todos!)
- `joy`: **0.06**
- `determination`: **0.06**
- `enthusiasm`: **0.06**
- `excitement`: **0.06**
- `amusement`: **0.07**
- `entrancement`: **0.07**

**Cooldown:** 60s (moderado, mas não muito restritivo)

**Por que é frequente:**
- Thresholds muito baixos (0.06-0.07) = detecta engajamento leve
- Emoções positivas são comuns em conversas normais
- `interest` é especialmente comum (threshold 0.06)
- Validações contextuais permitem detecção mesmo com emoções negativas baixas

**Feedback esperado:** `entusiasmo_alto`

---

### 2. **Estado Mental (Subcategorias com Thresholds Baixos)** ⭐⭐⭐⭐
**Probabilidade: ALTA**

**Thresholds mais baixos:**
- `realization`: **0.07** (insight - muito comum em conversas)
- `awkwardness`: **0.08** (desconforto social leve)
- `envy`: **0.08**
- `pride`: **0.09**
- `curiosity`: **0.09**
- `anticipation`: **0.09**
- `relief`: **0.08**
- `satisfaction`: **0.08**
- `calmness`: **0.08**
- `contentment`: **0.08**
- `confusion`: **0.08** (no estado mental)
- `doubt`: **0.08**

**Cooldown:** 60s

**Por que é frequente:**
- Múltiplas emoções com thresholds baixos (0.07-0.09)
- Estados neutros/contextuais são comuns em conversas
- `realization` (0.07) é muito comum quando pessoas entendem algo
- `curiosity` e `anticipation` são naturais em diálogos

**Feedback esperado:** `estado_mental`

---

### 3. **Conexão Social** ⭐⭐⭐⭐
**Probabilidade: ALTA**

**Thresholds:**
- `affection`: **0.07**
- `emphatic pain`: **0.07**
- `love`: **0.07**
- `sympathy`: **0.07**

**Cooldown:** 75s (moderado)

**Por que é frequente:**
- Thresholds baixos (0.07) = detecta conexão leve
- Em conversas normais, há sempre algum nível de empatia/simpatia
- `sympathy` e `affection` são comuns em interações humanas

**Feedback esperado:** `conexao`

---

### 4. **Serenidade** ⭐⭐⭐
**Probabilidade: MODERADA-ALTA**

**Thresholds:**
- `calmness`: **0.08**
- `contentment`: **0.08**
- `relief`: **0.08**
- `satisfaction`: **0.08**

**Cooldown:** 90s (mais longo, reduz frequência)

**Por que é frequente:**
- Thresholds moderados (0.08)
- Estados de calma são comuns em conversas normais
- `relief` e `satisfaction` aparecem quando problemas são resolvidos

**Feedback esperado:** `serenidade`

---

## 🟡 Emoções Moderadamente Frequentes

### 5. **Confusão** ⭐⭐⭐
**Probabilidade: MODERADA**

**Thresholds:**
- `doubt`: **0.15** (threshold alto, mas `confusion` está desabilitado com threshold 1.0)

**Cooldown:** 25s (curto, permite detecções frequentes)

**Por que pode ser frequente:**
- Cooldown curto (25s) permite múltiplas detecções
- Dúvidas são comuns em conversas
- Mas threshold alto (0.15) reduz frequência

**Feedback esperado:** `confusao`

---

### 6. **Hostilidade (Apenas Anxiety)** ⭐⭐
**Probabilidade: BAIXA-MODERADA**

**Threshold mais baixo:**
- `anxiety`: **0.08** (única emoção de hostilidade com threshold baixo)

**Cooldown:** 30s (curto)

**Por que pode aparecer:**
- `anxiety` tem threshold baixo (0.08)
- Ansiedade leve é comum em conversas (nervosismo, preocupação)
- Mas outras emoções de hostilidade têm thresholds mais altos (0.07-0.12)

**Feedback esperado:** `hostilidade` (mas raro, pois outras emoções bloqueiam)

---

## 🔴 Emoções Raras em Conversas Normais

### 7. **Frustração** ⭐
**Probabilidade: BAIXA**

**Threshold:** **0.15** (alto)

**Cooldown:** 25s (curto)

**Por que é rara:**
- Threshold muito alto (0.15)
- Frustração intensa não é comum em conversas normais
- Mas pode aparecer via meta-estado (frustrationTrend) com cooldown de 25s

**Feedback esperado:** `frustracao_crescente`

---

### 8. **Tédio** ⭐
**Probabilidade: BAIXA**

**Thresholds:**
- `boredom`: **0.15** (alto)
- `tiredness`: **0.20** (muito alto)

**Cooldown:** 25s (curto)

**Por que é raro:**
- Thresholds altos (0.15-0.20)
- Tédio intenso não é comum em conversas ativas
- Requer também `interest` baixo (< 0.15)

**Feedback esperado:** `tedio`

---

### 9. **Tristeza** ⭐
**Probabilidade: BAIXA**

**Thresholds:**
- `sadness`: **0.10**
- `disappointment`: **0.10**
- `disapproval`: **0.08** (mais baixo)
- `loneliness`: **0.10**
- `melancholy`: **0.10**
- `grief`: **0.11**
- `despair`: **0.11**
- `guilt`, `shame`, `embarrassment`, `regret`: **0.12**

**Cooldown:** 40s

**Por que é rara:**
- Thresholds moderados-altos (0.08-0.12)
- Tristeza intensa não é comum em conversas normais
- `disapproval` (0.08) pode aparecer ocasionalmente

**Feedback esperado:** `tristeza`

---

## 📊 Sinais Prosódicos (Camada 3)

### Mais Frequentes:

1. **Arousal (Energia)**
   - Cooldown: 20s (curto)
   - Thresholds: -0.4 (baixo), 0.5 (alto)
   - **Frequente** - energia varia naturalmente

2. **Valence (Tom Emocional)**
   - Cooldown: 20s (curto)
   - Thresholds: -0.35 (negativo), -0.6 (severamente negativo)
   - **Moderado** - tom negativo é menos comum

3. **Volume**
   - Cooldown: 15s (muito curto)
   - **Frequente** - problemas técnicos de volume são comuns

4. **Monotonia**
   - Cooldown: 20s
   - **Moderado** - fala monótona pode aparecer

---

## 📈 Ranking de Frequência Esperada

### Top 5 Feedbacks Mais Frequentes:

1. **🥇 `entusiasmo_alto` (Engajamento)**
   - Threshold: 0.06 (mais baixo)
   - Cooldown: 60s
   - **Motivo:** `interest` é extremamente comum em conversas

2. **🥈 `estado_mental`**
   - Thresholds: 0.07-0.09 (baixos)
   - Cooldown: 60s
   - **Motivo:** Múltiplas emoções contextuais com thresholds baixos

3. **🥉 `conexao`**
   - Threshold: 0.07
   - Cooldown: 75s
   - **Motivo:** Empatia/simpatia são naturais em conversas

4. **4️⃣ `serenidade`**
   - Threshold: 0.08
   - Cooldown: 90s
   - **Motivo:** Calma e satisfação são comuns

5. **5️⃣ Sinais Prosódicos (arousal, volume)**
   - Cooldowns: 15-20s (muito curtos)
   - **Motivo:** Variações naturais de energia e volume

---

## 🎯 Emoções Específicas Mais Comuns

### Top 10 Emoções com Thresholds Mais Baixos:

1. **`interest`**: 0.06 ⭐⭐⭐⭐⭐
2. **`joy`**: 0.06 ⭐⭐⭐⭐⭐
3. **`determination`**: 0.06 ⭐⭐⭐⭐⭐
4. **`enthusiasm`**: 0.06 ⭐⭐⭐⭐⭐
5. **`excitement`**: 0.06 ⭐⭐⭐⭐⭐
6. **`realization`**: 0.07 ⭐⭐⭐⭐
7. **`amusement`**: 0.07 ⭐⭐⭐⭐
8. **`entrancement`**: 0.07 ⭐⭐⭐⭐
9. **`affection`**: 0.07 ⭐⭐⭐⭐
10. **`emphatic pain`**: 0.07 ⭐⭐⭐⭐

---

## 💡 Observações Importantes

### Fatores que Aumentam Frequência:

1. **Thresholds baixos (≤ 0.08)**
   - Permitem detecção de emoções leves
   - Mais comum em conversas normais

2. **Cooldowns curtos (≤ 30s)**
   - Permitem múltiplas detecções
   - Especialmente importante para sinais prosódicos

3. **Validações contextuais menos restritivas**
   - Engajamento e Estado Mental têm validações mais permissivas
   - Permitem detecção mesmo com emoções conflitantes baixas

### Fatores que Reduzem Frequência:

1. **Thresholds altos (≥ 0.12)**
   - Requerem emoções intensas
   - Raros em conversas normais

2. **Cooldowns longos (≥ 60s)**
   - Limitam frequência de detecção
   - Especialmente para emoções positivas (engajamento: 60s, serenidade: 90s)

3. **Validações contextuais restritivas**
   - Hostilidade bloqueia muitas outras emoções
   - Tristeza profunda bloqueia emoções positivas

---

## 📊 Distribuição Esperada em Conversa Normal (30 minutos)

### Estimativa de Feedbacks:

- **`entusiasmo_alto`**: 8-12 vezes (a cada ~2-3 minutos)
- **`estado_mental`**: 6-10 vezes (a cada ~3-4 minutos)
- **`conexao`**: 4-6 vezes (a cada ~5-7 minutos)
- **`serenidade`**: 3-5 vezes (a cada ~6-10 minutos)
- **Sinais Prosódicos**: 10-15 vezes (variações contínuas)
- **`confusao`**: 2-4 vezes (ocasional)
- **`hostilidade`**: 0-2 vezes (raro, apenas anxiety leve)
- **`frustracao_crescente`**: 0-2 vezes (raro)
- **`tristeza`**: 0-1 vez (muito raro)
- **`tedio`**: 0-1 vez (muito raro)

**Total estimado:** 33-56 feedbacks em 30 minutos

---

## 🔍 Conclusão

Em conversas normais, os feedbacks mais frequentes são:

1. **Emoções positivas** (engajamento, conexão, serenidade)
2. **Estados mentais contextuais** (realization, curiosity, interest)
3. **Sinais prosódicos** (variações de energia e volume)

Emoções negativas intensas (hostilidade, tristeza profunda, frustração) são raras em conversas normais, mas o sistema está preparado para detectá-las quando necessário.

---

**Data da Análise**: 2025-01-27

