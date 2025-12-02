# Contagem de Emoções Implementadas no Sistema A2E2

## Resumo

**Total de Emoções Únicas: 60 emoções**

---

## Emoções por Categoria

### 1. Hostilidade (9 emoções)

**Hostilidade Ativa:**
- anger (raiva)
- disgust (nojo)
- distress (angústia)
- rage (fúria)
- contempt (desprezo)

**Medo/Ameaça:**
- fear (medo)
- horror (horror)
- terror (terror)
- anxiety (ansiedade)

### 2. Frustração (1 emoção)

- frustration (frustração)

### 3. Tédio (2 emoções)

- boredom (tédio)
- tiredness (cansaço)

### 4. Confusão (2 emoções)

- confusion (confusão)
- doubt (dúvida)

### 5. Engajamento (12 emoções)

**Engajamento Moderado:**
- interest (interesse)
- joy (alegria)
- determination (determinação)
- enthusiasm (entusiasmo)
- excitement (excitação)

**Engajamento Intenso:**
- ecstasy (êxtase)
- triumph (triunfo)
- awe (admiração profunda)
- admiration (admiração)

**Engajamento Lúdico:**
- amusement (diversão)
- entrancement (encantamento)

### 6. Serenidade (4 emoções)

- calmness (calma)
- contentment (contentamento)
- relief (alívio)
- satisfaction (satisfação)

### 7. Conexão Social (4 emoções)

- affection (afeto)
- emphatic pain (dor empática) - nota: "emphatic pain" (com espaço)
- love (amor)
- sympathy (simpatia/compaixão)

### 8. Tristeza (12 emoções)

**Tristeza Direta:**
- sadness (tristeza)
- disappointment (decepção)
- sorrow (pesar)

**Autoavaliação Negativa:**
- guilt (culpa)
- shame (vergonha)
- embarrassment (constrangimento)
- regret (arrependimento)

**Julgamento:**
- disapproval (desaprovação)

**Luto/Perda Profunda:**
- grief (luto)
- despair (desespero)

**Isolamento:**
- loneliness (solidão)
- melancholy (melancolia)

### 9. Estado Mental (24 emoções)

**Foco:**
- concentration (concentração)
- contemplation (contemplação)

**Desconforto Social:**
- awkwardness (constrangimento social)
- envy (inveja)

**Sofrimento:**
- pain (dor)

**Autoafirmação:**
- pride (orgulho)

**Insight:**
- realization (realização)

**Memória Afetiva:**
- nostalgia (nostalgia)

**Motivação:**
- desire (desejo)

**Quebra de Expectativa:**
- surprise (surpresa)

**Estado Basal:**
- neutral (neutro)

**Curiosidade:**
- curiosity (curiosidade)
- anticipation (antecipação)

**Esperança:**
- hope (esperança)

**Tranquilidade:**
- relief (alívio) - *duplicado com Serenidade*
- satisfaction (satisfação) - *duplicado com Serenidade*
- calmness (calma) - *duplicado com Serenidade*
- contentment (contentamento) - *duplicado com Serenidade*

**Interesse:**
- interest (interesse) - *duplicado com Engajamento*

**Incerteza:**
- confusion (confusão) - *duplicado com Confusão*
- doubt (dúvida) - *duplicado com Confusão*

**Baixa Energia:**
- boredom (tédio) - *duplicado com Tédio*

---

## Emoções Únicas (sem duplicatas)

### Total: 60 emoções únicas

1. anger
2. disgust
3. distress
4. rage
5. contempt
6. fear
7. horror
8. terror
9. anxiety
10. frustration
11. boredom
12. tiredness
13. confusion
14. doubt
15. interest
16. joy
17. determination
18. enthusiasm
19. excitement
20. ecstasy
21. triumph
22. awe
23. admiration
24. amusement
25. entrancement
26. calmness
27. contentment
28. relief
29. satisfaction
30. affection
31. emphatic pain
32. love
33. sympathy
34. sadness
35. disappointment
36. sorrow
37. guilt
38. shame
39. embarrassment
40. regret
41. disapproval
42. grief
43. despair
44. loneliness
45. melancholy
46. concentration
47. contemplation
48. awkwardness
49. envy
50. pain
51. pride
52. realization
53. nostalgia
54. desire
55. surprise
56. neutral
57. curiosity
58. anticipation
59. hope

---

## Observações

### Emoções Duplicadas entre Categorias

Algumas emoções aparecem em múltiplas categorias porque são usadas em diferentes contextos:

- **relief, satisfaction, calmness, contentment**: Aparecem em Serenidade e Estado Mental
- **interest**: Aparece em Engajamento e Estado Mental
- **confusion, doubt**: Aparecem em Confusão e Estado Mental
- **boredom**: Aparece em Tédio e Estado Mental

Isso é intencional, pois essas emoções podem ser detectadas em diferentes contextos e com diferentes thresholds dependendo do detector.

### Emoção Especial

- **emphatic pain**: É armazenada como "emphatic pain" (com espaço) no sistema de emoções, mas é tratada como uma única emoção.

---

## Distribuição por Detector

- **detect-hostility.ts**: 9 emoções (hostilidade + medo/ameaça)
- **detect-frustration.ts**: 1 emoção (frustration)
- **detect-boredom.ts**: 2 emoções (boredom, tiredness)
- **detect-confusion.ts**: 2 emoções (confusion, doubt)
- **detect-engagement.ts**: 12 emoções (engajamento moderado, intenso, lúdico)
- **detect-serenity.ts**: 4 emoções (calmness, contentment, relief, satisfaction)
- **detect-connection.ts**: 4 emoções (affection, emphatic pain, love, sympathy)
- **detect-sadness.ts**: 12 emoções (tristeza direta, autoavaliação, julgamento, luto, isolamento)
- **detect-mental-state.ts**: 24 emoções (estados contextuais e neutros)

**Total de emoções detectadas pelos detectores primários: 60 emoções únicas**

---

**Data da Contagem**: 2025-01-27

