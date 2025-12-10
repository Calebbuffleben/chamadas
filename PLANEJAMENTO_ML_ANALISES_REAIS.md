# Planejamento: Implementação de Análises ML Reais

## 📋 Objetivo

Substituir as implementações mockadas (pattern matching) por modelos ML reais para:
- **Intent Classification** (Classificação de Intenção)
- **Topic Classification** (Classificação de Tópicos)
- **Speech Act Classification** (Classificação de Atos de Fala)
- **Named Entity Recognition (NER)** (Reconhecimento de Entidades)
- **Emotion Detection** (Detecção de Emoções)

---

## 🔍 Estado Atual vs Estado Desejado

### Estado Atual (Mockado)

| Campo | Implementação Atual | Tipo |
|-------|-------------------|------|
| `intent` | Pattern matching com dicionário | ❌ Mockado |
| `topic` | Pattern matching com dicionário | ❌ Mockado |
| `speech_act` | Verificação de `?`, `!` + patterns | ❌ Mockado |
| `entities` | Pattern matching básico | ❌ Mockado |
| `emotions` | Pattern matching com keywords | ❌ Mockado |
| `sentiment` | BERT pipeline (real) | ✅ ML Real |
| `embedding` | SBERT (real) | ✅ ML Real |
| `keywords` | NLTK (estatístico) | ✅ OK |

### Estado Desejado (ML Real)

| Campo | Modelo Proposto | Tecnologia |
|-------|----------------|------------|
| `intent` | Fine-tuned BERT ou Zero-shot | Transformers |
| `topic` | Clustering semântico ou Zero-shot | SBERT + Clustering |
| `speech_act` | Fine-tuned BERT ou Embeddings + Classificador | Transformers |
| `entities` | spaCy NER ou Transformers NER | spaCy / Transformers |
| `emotions` | Fine-tuned BERT multilabel | Transformers |
| `sentiment` | BERT pipeline (manter) | ✅ Já implementado |
| `embedding` | SBERT (manter) | ✅ Já implementado |

---

## 🎯 Estratégia de Implementação

### Fase 1: NER (Named Entity Recognition) - Prioridade Alta
**Justificativa**: Entidades são fundamentais para entender contexto e são relativamente fáceis de implementar.

**Modelo**: spaCy com modelo português
- **Vantagens**: 
  - Fácil integração
  - Modelo pré-treinado disponível
  - Performance boa
  - Suporta português
- **Modelo**: `pt_core_news_sm` ou `pt_core_news_lg`

### Fase 2: Emotion Detection - Prioridade Alta
**Justificativa**: Complementa análise de sentimento e é útil para feedback emocional.

**Modelo**: Fine-tuned BERT multilabel ou modelo pré-treinado
- **Opções**:
  1. Fine-tune `neuralmind/bert-base-portuguese-cased` para emoções
  2. Usar modelo multilabel existente
  3. Usar embeddings + classificador simples

### Fase 3: Intent Classification - Prioridade Média
**Justificativa**: Importante para entender ações desejadas.

**Modelo**: Zero-shot classification ou Fine-tuned BERT
- **Opções**:
  1. Zero-shot com BART/MBART (sem treinamento)
  2. Fine-tune BERT para intenções específicas
  3. Embeddings + classificador simples

### Fase 4: Topic Classification - Prioridade Média
**Justificativa**: Útil para categorizar conversas.

**Modelo**: Clustering semântico ou Zero-shot
- **Opções**:
  1. Clustering com embeddings SBERT (K-means, DBSCAN)
  2. Zero-shot classification
  3. Fine-tune BERT para tópicos

### Fase 5: Speech Act Classification - Prioridade Baixa
**Justificativa**: Pode ser melhorado, mas já funciona razoavelmente.

**Modelo**: Embeddings + Classificador ou Fine-tuned BERT
- **Opções**:
  1. Embeddings SBERT + SVM/Logistic Regression
  2. Fine-tune BERT para speech acts
  3. Manter heurística atual (melhorada)

---

## 🛠️ Tecnologias e Dependências

### Novas Dependências Necessárias

```txt
# NER
spacy==3.7.2
https://github.com/explosion/spacy-models/releases/download/pt_core_news_sm-3.7.0/pt_core_news_sm-3.7.0-py3-none-any.whl

# Zero-shot Classification (opcional)
transformers[torch]>=4.37.2  # Já existe, mas pode precisar atualizar

# Clustering (para topics)
scikit-learn==1.3.2

# Classificadores adicionais (opcional)
# Já temos scipy, pode adicionar sklearn se necessário
```

### Modelos a Baixar/Usar

1. **spaCy Portuguese Model**
   ```bash
   python -m spacy download pt_core_news_sm
   ```

2. **Zero-shot Models** (se usar)
   - `facebook/bart-large-mnli` (multilingual)
   - `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli` (multilingual)

3. **Emotion Models** (se usar pré-treinado)
   - `j-hartmann/emotion-english-distilroberta-base` (inglês, adaptar)
   - Fine-tune próprio com dataset português

---

## 📁 Estrutura de Arquivos

```
apps/text-analysis/src/
├── models/
│   ├── bert_analyzer.py          # ✅ Já existe (sentiment, embedding)
│   ├── ner_analyzer.py           # 🆕 NOVO: NER com spaCy
│   ├── emotion_analyzer.py       # 🆕 NOVO: Emotion detection
│   ├── intent_analyzer.py        # 🆕 NOVO: Intent classification
│   ├── topic_analyzer.py         # 🆕 NOVO: Topic classification
│   └── speech_act_analyzer.py    # 🆕 NOVO: Speech act classification
├── services/
│   └── analysis_service.py       # ✏️ ATUALIZAR: Integrar novos analisadores
└── config.py                     # ✏️ ATUALIZAR: Adicionar configs dos novos modelos
```

---

## 🔧 Implementação Detalhada

### Fase 1: NER (Named Entity Recognition)

#### 1.1 Criar `ner_analyzer.py`

```python
"""
Analisador de Named Entity Recognition usando spaCy.
Extrai entidades nomeadas do texto (pessoas, organizações, locais, etc.).
"""

import spacy
import structlog
from typing import List, Dict, Any

logger = structlog.get_logger()


class NERAnalyzer:
    """
    Analisador NER usando spaCy.
    
    Tipos de entidades detectadas:
    - PER (Person): Pessoas
    - ORG (Organization): Organizações
    - LOC (Location): Locais
    - MISC (Miscellaneous): Outros
    - MONEY: Valores monetários
    - DATE: Datas
    - TIME: Horários
    """
    
    def __init__(self, model_name: str = "pt_core_news_sm"):
        """
        Inicializa analisador NER.
        
        Args:
            model_name: Nome do modelo spaCy (pt_core_news_sm ou pt_core_news_lg)
        """
        self.model_name = model_name
        self.nlp = None
        self._loaded = False
        
        logger.info("NERAnalyzer initialized", model=model_name)
    
    def _load_model(self):
        """Carrega modelo spaCy (lazy loading)"""
        if self._loaded:
            return
        
        try:
            logger.info("Loading spaCy NER model", model=self.model_name)
            self.nlp = spacy.load(self.model_name)
            self._loaded = True
            logger.info("spaCy NER model loaded successfully")
        except OSError:
            logger.error(
                f"spaCy model '{self.model_name}' not found. "
                f"Install with: python -m spacy download {self.model_name}"
            )
            raise
    
    def extract_entities(self, text: str) -> List[Dict[str, Any]]:
        """
        Extrai entidades nomeadas do texto.
        
        Args:
            text: Texto a ser analisado
            
        Returns:
            Lista de entidades encontradas:
            [
                {
                    'text': str,        # Texto da entidade
                    'label': str,       # Tipo (PER, ORG, LOC, etc.)
                    'start': int,       # Posição inicial no texto
                    'end': int          # Posição final no texto
                },
                ...
            ]
        """
        if not self._loaded:
            self._load_model()
        
        try:
            doc = self.nlp(text)
            entities = []
            
            for ent in doc.ents:
                entities.append({
                    'text': ent.text,
                    'label': ent.label_,
                    'start': ent.start_char,
                    'end': ent.end_char,
                    'confidence': 1.0  # spaCy não retorna confidence, usar 1.0
                })
            
            logger.debug(
                "Entities extracted",
                count=len(entities),
                entities=[e['text'] for e in entities[:5]]
            )
            
            return entities
            
        except Exception as e:
            logger.error("NER extraction failed", error=str(e))
            return []
    
    def extract_entities_simple(self, text: str) -> List[str]:
        """
        Extrai apenas os textos das entidades (formato simplificado).
        
        Args:
            text: Texto a ser analisado
            
        Returns:
            Lista de strings com nomes das entidades
        """
        entities = self.extract_entities(text)
        return [e['text'] for e in entities]
```

#### 1.2 Integrar no `analysis_service.py`

```python
# Adicionar import
from ..models.ner_analyzer import NERAnalyzer

# No __init__ do TextAnalysisService
self.ner_analyzer = None

# No método analyze()
if self.ner_analyzer is None:
    self.ner_analyzer = NERAnalyzer()
entities = self.ner_analyzer.extract_entities_simple(chunk.text)
```

---

### Fase 2: Emotion Detection

#### 2.1 Criar `emotion_analyzer.py`

```python
"""
Analisador de emoções usando BERT fine-tuned ou modelo multilabel.
Detecta múltiplas emoções simultaneamente (multilabel).
"""

import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    pipeline
)
from typing import Dict
import structlog

logger = structlog.get_logger()


class EmotionAnalyzer:
    """
    Analisador de emoções usando BERT.
    
    Emoções detectadas:
    - joy (alegria)
    - sadness (tristeza)
    - anger (raiva)
    - fear (medo)
    - surprise (surpresa)
    - disgust (nojo)
    - neutral (neutro)
    """
    
    def __init__(
        self,
        model_name: str = "j-hartmann/emotion-english-distilroberta-base",
        device: str = "cpu",
        cache_dir: str = None
    ):
        """
        Inicializa analisador de emoções.
        
        Args:
            model_name: Nome do modelo no Hugging Face
            device: Dispositivo ('cpu' ou 'cuda')
            cache_dir: Diretório de cache
        """
        self.model_name = model_name
        self.device = device
        self.cache_dir = cache_dir
        self.tokenizer = None
        self.model = None
        self.pipeline = None
        self._loaded = False
        
        logger.info("EmotionAnalyzer initialized", model=model_name)
    
    def _load_model(self):
        """Carrega modelo (lazy loading)"""
        if self._loaded:
            return
        
        try:
            logger.info("Loading emotion detection model", model=self.model_name)
            
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                cache_dir=self.cache_dir
            )
            
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name,
                cache_dir=self.cache_dir
            )
            
            if self.device == "cuda" and torch.cuda.is_available():
                self.model = self.model.to("cuda")
                self.device = "cuda"
            
            self.model.eval()
            
            self.pipeline = pipeline(
                "text-classification",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if self.device == "cuda" else -1,
                return_all_scores=True  # Retornar todas as emoções
            )
            
            self._loaded = True
            logger.info("Emotion model loaded successfully")
            
        except Exception as e:
            logger.error("Failed to load emotion model", error=str(e))
            raise
    
    def detect_emotions(self, text: str) -> Dict[str, float]:
        """
        Detecta emoções no texto (multilabel).
        
        Args:
            text: Texto a ser analisado
            
        Returns:
            Dict com scores de emoções (0.0 a 1.0):
            {
                'joy': float,
                'sadness': float,
                'anger': float,
                'fear': float,
                'surprise': float,
                'disgust': float,
                'neutral': float
            }
        """
        if not self._loaded:
            self._load_model()
        
        try:
            # Pipeline retorna todas as scores
            results = self.pipeline(text)[0]  # Lista de dicts com label e score
            
            # Converter para formato esperado
            emotions = {
                'joy': 0.0,
                'sadness': 0.0,
                'anger': 0.0,
                'fear': 0.0,
                'surprise': 0.0,
                'disgust': 0.0,
                'neutral': 0.0
            }
            
            # Mapear labels do modelo para nosso formato
            label_mapping = {
                'joy': 'joy',
                'sadness': 'sadness',
                'anger': 'anger',
                'fear': 'fear',
                'surprise': 'surprise',
                'disgust': 'disgust',
                'neutral': 'neutral'
            }
            
            for result in results:
                label = result['label'].lower()
                score = result['score']
                
                # Mapear label
                for key, mapped_label in label_mapping.items():
                    if mapped_label in label or label in mapped_label:
                        emotions[key] = score
                        break
            
            logger.debug("Emotions detected", emotions=emotions)
            return emotions
            
        except Exception as e:
            logger.error("Emotion detection failed", error=str(e))
            return {
                'joy': 0.0,
                'sadness': 0.0,
                'anger': 0.0,
                'fear': 0.0,
                'surprise': 0.0,
                'disgust': 0.0,
                'neutral': 1.0
            }
```

#### 2.2 Integrar no `analysis_service.py`

```python
# Substituir detect_emotions mockado por:
emotions = analyzer.detect_emotions(chunk.text)  # Se EmotionAnalyzer estiver no BERTAnalyzer
# OU
if self.emotion_analyzer is None:
    self.emotion_analyzer = EmotionAnalyzer()
emotions = self.emotion_analyzer.detect_emotions(chunk.text)
```

---

### Fase 3: Intent Classification

#### 3.1 Criar `intent_analyzer.py`

```python
"""
Analisador de intenção usando Zero-shot Classification ou Fine-tuned BERT.
"""

from transformers import pipeline
from typing import Tuple
import structlog

logger = structlog.get_logger()


class IntentAnalyzer:
    """
    Analisador de intenção usando Zero-shot Classification.
    
    Intenções suportadas:
    - ask_price (perguntar preço)
    - ask_info (pedir informação)
    - request_action (solicitar ação)
    - express_opinion (expressar opinião)
    - express_agreement (concordar)
    - express_disagreement (discordar)
    - ask_question (fazer pergunta genérica)
    - statement (afirmação)
    """
    
    def __init__(
        self,
        model_name: str = "facebook/bart-large-mnli",
        device: str = "cpu",
        cache_dir: str = None
    ):
        self.model_name = model_name
        self.device = device
        self.cache_dir = cache_dir
        self.classifier = None
        self._loaded = False
        
        # Lista de intenções possíveis
        self.intent_labels = [
            "ask about price or cost",
            "ask for information",
            "request an action",
            "express an opinion",
            "express agreement",
            "express disagreement",
            "ask a question",
            "make a statement"
        ]
        
        logger.info("IntentAnalyzer initialized", model=model_name)
    
    def _load_model(self):
        """Carrega modelo zero-shot (lazy loading)"""
        if self._loaded:
            return
        
        try:
            logger.info("Loading zero-shot intent classifier", model=self.model_name)
            
            self.classifier = pipeline(
                "zero-shot-classification",
                model=self.model_name,
                device=0 if self.device == "cuda" else -1
            )
            
            self._loaded = True
            logger.info("Intent classifier loaded successfully")
            
        except Exception as e:
            logger.error("Failed to load intent classifier", error=str(e))
            raise
    
    def detect_intent(self, text: str) -> Tuple[str, float]:
        """
        Detecta intenção do texto.
        
        Args:
            text: Texto a ser analisado
            
        Returns:
            Tupla (intent, confidence):
            - intent: String com a intenção detectada
            - confidence: Float com confiança (0.0 a 1.0)
        """
        if not self._loaded:
            self._load_model()
        
        try:
            result = self.classifier(text, self.intent_labels)
            
            # Mapear label do modelo para nosso formato
            label_mapping = {
                "ask about price or cost": "ask_price",
                "ask for information": "ask_info",
                "request an action": "request_action",
                "express an opinion": "express_opinion",
                "express agreement": "express_agreement",
                "express disagreement": "express_disagreement",
                "ask a question": "ask_question",
                "make a statement": "statement"
            }
            
            top_label = result['labels'][0]
            confidence = result['scores'][0]
            intent = label_mapping.get(top_label, "statement")
            
            logger.debug("Intent detected", intent=intent, confidence=confidence)
            return (intent, float(confidence))
            
        except Exception as e:
            logger.error("Intent detection failed", error=str(e))
            return ("statement", 0.5)
```

---

### Fase 4: Topic Classification

#### 4.1 Criar `topic_analyzer.py`

```python
"""
Analisador de tópicos usando Clustering Semântico ou Zero-shot.
"""

from sentence_transformers import SentenceTransformer
from sklearn.cluster import KMeans
import numpy as np
from typing import Tuple, List
import structlog

logger = structlog.get_logger()


class TopicAnalyzer:
    """
    Analisador de tópicos usando embeddings semânticos + clustering.
    
    Tópicos detectados:
    - pricing (preços)
    - product (produtos)
    - support (suporte)
    - schedule (agendamento)
    - technical (técnico)
    - general (geral)
    """
    
    def __init__(
        self,
        sbert_model_name: str,
        device: str = "cpu",
        cache_dir: str = None
    ):
        self.sbert_model_name = sbert_model_name
        self.device = device
        self.cache_dir = cache_dir
        self.sbert_model = None
        self._loaded = False
        
        # Tópicos de referência para classificação
        self.topic_references = {
            'pricing': ['preço', 'valor', 'custo', 'quanto custa', 'price'],
            'product': ['produto', 'serviço', 'solução', 'oferta', 'feature'],
            'support': ['suporte', 'ajuda', 'problema', 'erro', 'bug', 'issue'],
            'schedule': ['agendar', 'horário', 'data', 'reunião', 'meeting'],
            'technical': ['técnico', 'implementação', 'código', 'tecnologia', 'API']
        }
        
        logger.info("TopicAnalyzer initialized")
    
    def _load_model(self):
        """Carrega modelo SBERT (lazy loading)"""
        if self._loaded:
            return
        
        try:
            logger.info("Loading SBERT for topic analysis", model=self.sbert_model_name)
            
            self.sbert_model = SentenceTransformer(
                self.sbert_model_name,
                cache_folder=self.cache_dir,
                device=self.device
            )
            
            self._loaded = True
            logger.info("SBERT model loaded for topic analysis")
            
        except Exception as e:
            logger.error("Failed to load SBERT for topics", error=str(e))
            raise
    
    def detect_topic(self, text: str, keywords: List[str] = None) -> Tuple[str, float]:
        """
        Detecta tópico usando similaridade semântica.
        
        Args:
            text: Texto a ser analisado
            keywords: Lista de keywords (opcional, para fallback)
            
        Returns:
            Tupla (topic, confidence)
        """
        if not self._loaded:
            self._load_model()
        
        try:
            # Gerar embedding do texto
            text_embedding = self.sbert_model.encode(text, convert_to_numpy=True)
            
            best_topic = 'general'
            best_similarity = 0.0
            
            # Calcular similaridade com cada tópico de referência
            for topic, ref_texts in self.topic_references.items():
                # Gerar embeddings das referências
                ref_embeddings = self.sbert_model.encode(
                    ref_texts,
                    convert_to_numpy=True
                )
                
                # Calcular similaridade média
                similarities = np.dot(ref_embeddings, text_embedding)
                avg_similarity = float(np.mean(similarities))
                
                if avg_similarity > best_similarity:
                    best_similarity = avg_similarity
                    best_topic = topic
            
            # Normalizar confidence (similaridade de cosseno está entre -1 e 1)
            confidence = max(0.0, min(1.0, (best_similarity + 1) / 2))
            
            # Se confidence muito baixa, usar fallback com keywords
            if confidence < 0.5 and keywords:
                for topic, ref_texts in self.topic_references.items():
                    if any(kw in ref_texts for kw in keywords):
                        return (topic, 0.6)
            
            logger.debug("Topic detected", topic=best_topic, confidence=confidence)
            return (best_topic, confidence)
            
        except Exception as e:
            logger.error("Topic detection failed", error=str(e))
            return ("general", 0.5)
```

---

### Fase 5: Speech Act Classification

#### 5.1 Criar `speech_act_analyzer.py`

```python
"""
Analisador de atos de fala usando embeddings + classificador ou heurística melhorada.
"""

from sentence_transformers import SentenceTransformer
import numpy as np
from typing import Tuple
import structlog

logger = structlog.get_logger()


class SpeechActAnalyzer:
    """
    Analisador de atos de fala.
    
    Atos de fala detectados:
    - question (pergunta)
    - statement (afirmação)
    - request (solicitação)
    - exclamation (exclamação)
    - agreement (concordância)
    - disagreement (discordância)
    """
    
    def __init__(
        self,
        sbert_model_name: str = None,
        device: str = "cpu",
        cache_dir: str = None
    ):
        self.sbert_model_name = sbert_model_name
        self.device = device
        self.cache_dir = cache_dir
        self.sbert_model = None
        self._loaded = False
        
        # Referências semânticas para cada speech act
        self.speech_act_references = {
            'question': ['pergunta', 'question', 'como', 'quando', 'onde', 'quem', 'o que'],
            'request': ['por favor', 'pode', 'poderia', 'faça', 'execute', 'solicito'],
            'agreement': ['concordo', 'sim', 'certo', 'ok', 'entendi', 'exato'],
            'disagreement': ['discordo', 'não', 'errado', 'incorreto', 'não concordo'],
            'exclamation': ['!', 'uau', 'incrível', 'fantástico']
        }
        
        logger.info("SpeechActAnalyzer initialized")
    
    def _load_model(self):
        """Carrega modelo SBERT se disponível (lazy loading)"""
        if self._loaded or not self.sbert_model_name:
            return
        
        try:
            logger.info("Loading SBERT for speech act analysis")
            
            self.sbert_model = SentenceTransformer(
                self.sbert_model_name,
                cache_folder=self.cache_dir,
                device=self.device
            )
            
            self._loaded = True
            logger.info("SBERT loaded for speech act analysis")
            
        except Exception as e:
            logger.warn("Failed to load SBERT for speech acts, using heuristics", error=str(e))
    
    def detect_speech_act(
        self,
        text: str,
        has_question: bool,
        has_exclamation: bool
    ) -> Tuple[str, float]:
        """
        Detecta ato de fala.
        
        Args:
            text: Texto a ser analisado
            has_question: Se contém interrogação
            has_exclamation: Se contém exclamação
            
        Returns:
            Tupla (speech_act, confidence)
        """
        text_lower = text.lower()
        
        # Heurísticas rápidas primeiro
        if has_question:
            return ('question', 0.9)
        
        if has_exclamation:
            return ('exclamation', 0.85)
        
        # Se SBERT disponível, usar similaridade semântica
        if self._loaded and self.sbert_model:
            try:
                text_embedding = self.sbert_model.encode(text, convert_to_numpy=True)
                
                best_act = 'statement'
                best_similarity = 0.0
                
                for act, ref_texts in self.speech_act_references.items():
                    if act in ['question', 'exclamation']:
                        continue  # Já tratados acima
                    
                    ref_embeddings = self.sbert_model.encode(
                        ref_texts,
                        convert_to_numpy=True
                    )
                    
                    similarities = np.dot(ref_embeddings, text_embedding)
                    avg_similarity = float(np.mean(similarities))
                    
                    if avg_similarity > best_similarity:
                        best_similarity = avg_similarity
                        best_act = act
                
                confidence = max(0.7, min(0.95, (best_similarity + 1) / 2))
                return (best_act, confidence)
                
            except Exception as e:
                logger.warn("Semantic speech act detection failed, using heuristics", error=str(e))
        
        # Fallback: heurísticas baseadas em padrões
        command_patterns = ['favor', 'por favor', 'pode', 'poderia', 'faça', 'execute']
        if any(pattern in text_lower for pattern in command_patterns):
            return ('request', 0.8)
        
        if any(word in text_lower for word in ['sim', 'certo', 'ok', 'entendi', 'concordo']):
            return ('agreement', 0.75)
        
        if any(word in text_lower for word in ['não', 'discordo', 'errado', 'incorreto']):
            return ('disagreement', 0.75)
        
        return ('statement', 0.7)
```

---

## 📝 Passo a Passo de Implementação

### Passo 1: Atualizar Dependências

**Arquivo**: `apps/text-analysis/requirements.txt`

```txt
# Adicionar:
spacy==3.7.2
scikit-learn==1.3.2  # Para clustering (se necessário)
```

**Comando**:
```bash
cd apps/text-analysis
pip install -r requirements.txt
python -m spacy download pt_core_news_sm
```

---

### Passo 2: Atualizar Config

**Arquivo**: `apps/text-analysis/src/config.py`

```python
# Adicionar novas configurações:

# NER Configuration
SPACY_MODEL_NAME: str = os.getenv('SPACY_MODEL_NAME', 'pt_core_news_sm')

# Emotion Detection Configuration
EMOTION_MODEL_NAME: str = os.getenv('EMOTION_MODEL_NAME', 'j-hartmann/emotion-english-distilroberta-base')
EMOTION_ENABLED: bool = os.getenv('EMOTION_ENABLED', 'true') == 'true'

# Intent Classification Configuration
INTENT_MODEL_NAME: str = os.getenv('INTENT_MODEL_NAME', 'facebook/bart-large-mnli')
INTENT_ENABLED: bool = os.getenv('INTENT_ENABLED', 'true') == 'true'

# Topic Classification Configuration
TOPIC_ENABLED: bool = os.getenv('TOPIC_ENABLED', 'true') == 'true'
TOPIC_USE_CLUSTERING: bool = os.getenv('TOPIC_USE_CLUSTERING', 'false') == 'true'

# Speech Act Configuration
SPEECH_ACT_USE_SEMANTIC: bool = os.getenv('SPEECH_ACT_USE_SEMANTIC', 'true') == 'true'
```

---

### Passo 3: Criar Novos Analisadores

1. Criar `apps/text-analysis/src/models/ner_analyzer.py`
2. Criar `apps/text-analysis/src/models/emotion_analyzer.py`
3. Criar `apps/text-analysis/src/models/intent_analyzer.py`
4. Criar `apps/text-analysis/src/models/topic_analyzer.py`
5. Criar `apps/text-analysis/src/models/speech_act_analyzer.py`

---

### Passo 4: Atualizar `BERTAnalyzer`

**Arquivo**: `apps/text-analysis/src/models/bert_analyzer.py`

- Remover método `detect_emotions()` mockado
- Manter apenas `analyze_sentiment()`, `extract_keywords()`, e métodos SBERT

---

### Passo 5: Atualizar `TextAnalysisService`

**Arquivo**: `apps/text-analysis/src/services/analysis_service.py`

```python
# Adicionar imports
from ..models.ner_analyzer import NERAnalyzer
from ..models.emotion_analyzer import EmotionAnalyzer
from ..models.intent_analyzer import IntentAnalyzer
from ..models.topic_analyzer import TopicAnalyzer
from ..models.speech_act_analyzer import SpeechActAnalyzer

# No __init__
self.ner_analyzer = None
self.emotion_analyzer = None
self.intent_analyzer = None
self.topic_analyzer = None
self.speech_act_analyzer = None

# No método analyze()
# Substituir métodos mockados por:
if Config.EMOTION_ENABLED:
    if self.emotion_analyzer is None:
        self.emotion_analyzer = EmotionAnalyzer(...)
    emotions = self.emotion_analyzer.detect_emotions(chunk.text)
else:
    emotions = analyzer.detect_emotions(chunk.text)  # Fallback mockado

if Config.INTENT_ENABLED:
    if self.intent_analyzer is None:
        self.intent_analyzer = IntentAnalyzer(...)
    intent, intent_confidence = self.intent_analyzer.detect_intent(chunk.text)
else:
    intent, intent_confidence = self._detect_intent(chunk.text, has_question)  # Fallback

# Similar para topic, speech_act, entities
```

---

### Passo 6: Remover Métodos Mockados

**Arquivo**: `apps/text-analysis/src/services/analysis_service.py`

- Remover ou marcar como `@deprecated`:
  - `_detect_intent()` (substituir por `IntentAnalyzer`)
  - `_detect_topic()` (substituir por `TopicAnalyzer`)
  - `_detect_speech_act()` (substituir por `SpeechActAnalyzer`)
  - `_extract_entities()` (substituir por `NERAnalyzer`)

---

### Passo 7: Atualizar Dockerfile

**Arquivo**: `apps/text-analysis/Dockerfile`

```dockerfile
# Adicionar download do modelo spaCy durante build
RUN python -m spacy download pt_core_news_sm
```

---

### Passo 8: Atualizar `.env.example`

**Arquivo**: `apps/text-analysis/.env.example`

```bash
# NER Configuration
SPACY_MODEL_NAME=pt_core_news_sm

# Emotion Detection
EMOTION_MODEL_NAME=j-hartmann/emotion-english-distilroberta-base
EMOTION_ENABLED=true

# Intent Classification
INTENT_MODEL_NAME=facebook/bart-large-mnli
INTENT_ENABLED=true

# Topic Classification
TOPIC_ENABLED=true
TOPIC_USE_CLUSTERING=false

# Speech Act
SPEECH_ACT_USE_SEMANTIC=true
```

---

## 🎯 Ordem de Implementação Recomendada

### Fase 1: NER (Mais Simples)
1. Instalar spaCy e modelo português
2. Criar `ner_analyzer.py`
3. Integrar no `analysis_service.py`
4. Testar

### Fase 2: Emotion Detection
1. Escolher modelo (pré-treinado ou fine-tune)
2. Criar `emotion_analyzer.py`
3. Integrar no `analysis_service.py`
4. Remover método mockado do `BERTAnalyzer`
5. Testar

### Fase 3: Intent Classification
1. Escolher abordagem (zero-shot ou fine-tune)
2. Criar `intent_analyzer.py`
3. Integrar no `analysis_service.py`
4. Remover método mockado
5. Testar

### Fase 4: Topic Classification
1. Implementar com SBERT + similaridade
2. Criar `topic_analyzer.py`
3. Integrar no `analysis_service.py`
4. Remover método mockado
5. Testar

### Fase 5: Speech Act
1. Melhorar com SBERT
2. Criar `speech_act_analyzer.py`
3. Integrar no `analysis_service.py`
4. Remover método mockado
5. Testar

---

## ⚠️ Considerações Importantes

### Performance
- **Lazy Loading**: Todos os modelos devem usar lazy loading
- **Cache**: Resultados devem ser cacheados (já implementado)
- **Device**: Suportar CPU e CUDA
- **Batch Processing**: Considerar processamento em batch no futuro

### Fallbacks
- Se modelo falhar, usar implementação mockada como fallback
- Logar erros mas não quebrar o fluxo
- Valores padrão para todos os campos

### Modelos Multilíngues
- Verificar se modelos suportam português
- Se não, considerar fine-tuning ou tradução

### Memória
- Modelos grandes podem consumir muita RAM
- Considerar modelos menores (distilbert, etc.)
- Monitorar uso de memória

---

## 📊 Exemplo de Resultado Final

```json
{
  "intent": "ask_price",
  "intent_confidence": 0.91,  // ✅ ML Real (Zero-shot)
  
  "topic": "pricing",
  "topic_confidence": 0.92,    // ✅ ML Real (SBERT + Similaridade)
  
  "speech_act": "question",
  "speech_act_confidence": 0.88, // ✅ ML Real (SBERT + Heurística)
  
  "keywords": ["quanto", "custa", "valor"],  // ✅ NLTK (OK)
  "entities": ["preço", "R$ 100"],           // ✅ ML Real (spaCy NER)
  
  "sentiment": "neutral",
  "sentiment_score": 0.56,     // ✅ ML Real (BERT)
  
  "urgency": 0.64,             // ✅ Heurístico (OK)
  
  "embedding": [0.12, -0.34, ...] // ✅ ML Real (SBERT)
}
```

---

## ✅ Checklist de Implementação

- [ ] Fase 1: NER com spaCy
- [ ] Fase 2: Emotion Detection com BERT
- [ ] Fase 3: Intent Classification (Zero-shot ou Fine-tune)
- [ ] Fase 4: Topic Classification (SBERT + Similaridade)
- [ ] Fase 5: Speech Act (SBERT + Heurística)
- [ ] Atualizar dependências
- [ ] Atualizar configurações
- [ ] Remover métodos mockados
- [ ] Testes de integração
- [ ] Documentação

---

## 🚀 Próximos Passos

1. **Decidir ordem de implementação** (recomendado: NER → Emotions → Intent → Topic → Speech Act)
2. **Escolher modelos específicos** (verificar disponibilidade e performance)
3. **Implementar fase por fase** (testar cada fase antes de prosseguir)
4. **Monitorar performance** (latência, memória, CPU/GPU)
5. **Ajustar conforme necessário** (fine-tuning, modelos alternativos)

