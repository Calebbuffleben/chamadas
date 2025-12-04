# Planejamento Fase 8: Análise Real de Texto com ML

## 📋 Análise da Fase 8

### Estado Atual
- ✅ Infraestrutura base implementada
- ✅ Serviço Python funcional com placeholder
- ✅ Integração completa com backend e pipeline A2E2
- ✅ Fluxo end-to-end funcionando
- ⏳ Análise de texto ainda é placeholder (retorna valores fixos)

### Objetivos da Fase 8
1. **Substituir análise placeholder por modelos ML reais**
2. **Implementar análise de sentimento em português**
3. **Detectar emoções em texto**
4. **Extrair palavras-chave relevantes**
5. **Otimizar performance para tempo real**
6. **Adicionar métricas e monitoramento**

### Desafios e Considerações

#### Performance
- **Latência:** Análise deve ser rápida (< 500ms por transcrição)
- **Throughput:** Suportar múltiplas transcrições simultâneas
- **Recursos:** Modelos ML podem consumir muita memória/CPU

#### Modelos ML
- **Idioma:** Português (pt-BR)
- **Tamanho:** Modelos leves para tempo real
- **Acurácia:** Balancear performance vs. qualidade

#### Infraestrutura
- **Docker:** Imagem precisa suportar PyTorch
- **Cache:** Modelos devem ser carregados uma vez
- **GPU:** Opcional, mas pode acelerar processamento

---

## 🎯 Planejamento Passo-a-Passo

### FASE 8.1: Preparação e Dependências

#### Passo 8.1.1: Atualizar requirements.txt

**Arquivo:** `apps/text-analysis/requirements.txt`

Adicionar dependências ML:
```txt
# ML/NLP
torch==2.1.2
transformers==4.37.2
sentencepiece==0.1.99
tokenizers==0.15.0

# NLP em Português
nltk==3.8.1
spacy==3.7.2

# Cache e otimização
cachetools==5.3.2
```

**Nota:** Versões específicas para compatibilidade e estabilidade.

#### Passo 8.1.2: Atualizar Dockerfile para ML

**Arquivo:** `apps/text-analysis/Dockerfile`

Modificações:
```dockerfile
FROM python:3.11-slim

# Instalar dependências do sistema (incluindo para ML)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# ... resto do Dockerfile ...

# Variáveis para modelos ML
ENV TRANSFORMERS_CACHE=/app/models/.cache
ENV HF_HOME=/app/models/.cache
```

#### Passo 8.1.3: Atualizar .env.example

**Arquivo:** `apps/text-analysis/.env.example`

Adicionar:
```bash
# ML Models
MODEL_CACHE_DIR=/app/models/.cache
MODEL_DEVICE=cpu  # ou cuda se disponível
SENTIMENT_MODEL=neuralmind/bert-base-portuguese-cased
EMOTION_MODEL=cardiffnlp/twitter-roberta-base-emotion  # ou modelo em português
ENABLE_ML_ANALYSIS=true

# Performance
ANALYSIS_BATCH_SIZE=1
ANALYSIS_MAX_LENGTH=512
ANALYSIS_TIMEOUT_MS=5000
```

---

### FASE 8.2: Estrutura de Modelos ML

#### Passo 8.2.1: Criar módulo de modelos

**Criar:** `apps/text-analysis/src/models/sentiment.py`

```python
from typing import Dict, Any
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import structlog

logger = structlog.get_logger()

class SentimentAnalyzer:
    """Analisador de sentimento usando BERT em português"""
    
    def __init__(self, model_name: str, device: str = "cpu"):
        self.device = device
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self._loaded = False
    
    async def load(self):
        """Carrega modelo (lazy loading)"""
        if self._loaded:
            return
        
        logger.info("Loading sentiment model", model=self.model_name)
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                cache_dir=os.getenv('MODEL_CACHE_DIR')
            )
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name,
                cache_dir=os.getenv('MODEL_CACHE_DIR')
            )
            self.model.to(self.device)
            self.model.eval()
            self._loaded = True
            logger.info("Sentiment model loaded successfully")
        except Exception as e:
            logger.error("Failed to load sentiment model", error=str(e))
            raise
    
    async def analyze(self, text: str) -> Dict[str, float]:
        """
        Analisa sentimento do texto.
        Retorna: {'positive': float, 'negative': float, 'neutral': float}
        """
        if not self._loaded:
            await self.load()
        
        # Tokenizar e processar
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True
        ).to(self.device)
        
        # Inferência
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probs = torch.softmax(logits, dim=-1)
        
        # Mapear para positive/negative/neutral
        # (ajustar conforme saída do modelo)
        scores = probs[0].cpu().numpy()
        
        return {
            'positive': float(scores[2]) if len(scores) > 2 else 0.0,
            'negative': float(scores[0]) if len(scores) > 0 else 0.0,
            'neutral': float(scores[1]) if len(scores) > 1 else 0.0,
        }
```

#### Passo 8.2.2: Criar analisador de emoções

**Criar:** `apps/text-analysis/src/models/emotion.py`

```python
from typing import Dict, Any, List
import torch
from transformers import pipeline
import structlog

logger = structlog.get_logger()

class EmotionDetector:
    """Detector de emoções em texto"""
    
    def __init__(self, model_name: str, device: str = "cpu"):
        self.device = device
        self.model_name = model_name
        self.pipeline = None
        self._loaded = False
    
    async def load(self):
        """Carrega modelo (lazy loading)"""
        if self._loaded:
            return
        
        logger.info("Loading emotion model", model=self.model_name)
        try:
            self.pipeline = pipeline(
                "text-classification",
                model=self.model_name,
                device=0 if self.device == "cuda" else -1,
                return_all_scores=True
            )
            self._loaded = True
            logger.info("Emotion model loaded successfully")
        except Exception as e:
            logger.error("Failed to load emotion model", error=str(e))
            raise
    
    async def detect(self, text: str) -> Dict[str, float]:
        """
        Detecta emoções no texto.
        Retorna: {'joy': float, 'sadness': float, 'anger': float, ...}
        """
        if not self._loaded:
            await self.load()
        
        try:
            results = self.pipeline(text, truncation=True, max_length=512)
            emotions = {}
            for item in results[0]:
                emotions[item['label'].lower()] = float(item['score'])
            return emotions
        except Exception as e:
            logger.error("Emotion detection failed", error=str(e))
            return {}
```

#### Passo 8.2.3: Criar extrator de palavras-chave

**Criar:** `apps/text-analysis/src/models/keywords.py`

```python
from typing import List
import re
from collections import Counter
import nltk
from nltk.corpus import stopwords
import structlog

logger = structlog.get_logger()

# Baixar stopwords do NLTK (fazer uma vez)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)
try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)

class KeywordExtractor:
    """Extrai palavras-chave relevantes do texto"""
    
    def __init__(self, language: str = "portuguese"):
        self.language = language
        try:
            self.stopwords = set(stopwords.words(language))
        except:
            self.stopwords = set(['o', 'a', 'de', 'para', 'com', 'em', 'um', 'uma'])
            logger.warn("Using fallback stopwords")
    
    def extract(self, text: str, top_n: int = 10) -> List[str]:
        """
        Extrai palavras-chave do texto.
        Retorna: Lista das top N palavras mais relevantes
        """
        # Normalizar texto
        text_lower = text.lower()
        
        # Remover pontuação e tokenizar
        words = re.findall(r'\b\w+\b', text_lower)
        
        # Filtrar stopwords e palavras muito curtas
        keywords = [
            w for w in words 
            if w not in self.stopwords 
            and len(w) > 3
        ]
        
        # Contar frequência
        word_freq = Counter(keywords)
        
        # Retornar top N
        top_keywords = [word for word, _ in word_freq.most_common(top_n)]
        
        return top_keywords
```

---

### FASE 8.3: Integração no Serviço de Análise

#### Passo 8.3.1: Atualizar TextAnalysisService

**Modificar:** `apps/text-analysis/src/services/analysis_service.py`

```python
from typing import Dict, Any
import os
from ..types.messages import TranscriptionChunk
from ..models.sentiment import SentimentAnalyzer
from ..models.emotion import EmotionDetector
from ..models.keywords import KeywordExtractor
import structlog

logger = structlog.get_logger()

class TextAnalysisService:
    """Serviço de análise de texto com ML"""
    
    def __init__(self):
        self.sentiment_analyzer = None
        self.emotion_detector = None
        self.keyword_extractor = KeywordExtractor()
        self.ml_enabled = os.getenv('ENABLE_ML_ANALYSIS', 'false').lower() == 'true'
        self._models_loaded = False
    
    async def _ensure_models_loaded(self):
        """Carrega modelos ML se habilitado"""
        if not self.ml_enabled:
            return
        
        if self._models_loaded:
            return
        
        try:
            device = os.getenv('MODEL_DEVICE', 'cpu')
            
            # Carregar modelos em paralelo
            sentiment_model = os.getenv('SENTIMENT_MODEL', 'neuralmind/bert-base-portuguese-cased')
            self.sentiment_analyzer = SentimentAnalyzer(sentiment_model, device)
            await self.sentiment_analyzer.load()
            
            emotion_model = os.getenv('EMOTION_MODEL', '')
            if emotion_model:
                self.emotion_detector = EmotionDetector(emotion_model, device)
                await self.emotion_detector.load()
            
            self._models_loaded = True
            logger.info("ML models loaded successfully")
        except Exception as e:
            logger.error("Failed to load ML models", error=str(e))
            self.ml_enabled = False
    
    async def analyze(self, chunk: TranscriptionChunk) -> Dict[str, Any]:
        """
        Analisa texto usando ML se habilitado, senão usa placeholder.
        """
        # Garantir que modelos estão carregados
        await self._ensure_models_loaded()
        
        # Análise básica (sempre)
        word_count = len(chunk.text.split())
        char_count = len(chunk.text)
        has_question = '?' in chunk.text
        has_exclamation = '!' in chunk.text
        
        # Análise ML (se habilitado)
        if self.ml_enabled and self.sentiment_analyzer:
            try:
                sentiment = await self.sentiment_analyzer.analyze(chunk.text)
                emotions = {}
                if self.emotion_detector:
                    emotions = await self.emotion_detector.detect(chunk.text)
                keywords = self.keyword_extractor.extract(chunk.text, top_n=10)
                confidence = 0.9
            except Exception as e:
                logger.error("ML analysis failed, using fallback", error=str(e))
                sentiment = {'positive': 0.0, 'negative': 0.0, 'neutral': 1.0}
                emotions = {}
                keywords = []
                confidence = 0.5
        else:
            # Fallback: placeholder
            sentiment = {'positive': 0.0, 'negative': 0.0, 'neutral': 1.0}
            emotions = {}
            keywords = []
            confidence = 0.5
        
        return {
            'word_count': word_count,
            'char_count': char_count,
            'has_question': has_question,
            'has_exclamation': has_exclamation,
            'sentiment_score': sentiment,
            'emotions': emotions,
            'topics': [],  # Futuro: implementar extração de tópicos
            'keywords': keywords
        }
```

---

### FASE 8.4: Otimizações e Cache

#### Passo 8.4.1: Implementar cache de resultados

**Criar:** `apps/text-analysis/src/services/cache_service.py`

```python
from typing import Optional, Dict, Any
from cachetools import TTLCache
import hashlib
import structlog

logger = structlog.get_logger()

class AnalysisCache:
    """Cache de resultados de análise para evitar reprocessamento"""
    
    def __init__(self, max_size: int = 1000, ttl: int = 3600):
        # Cache com TTL de 1 hora
        self.cache = TTLCache(maxsize=max_size, ttl=ttl)
    
    def _hash_text(self, text: str) -> str:
        """Gera hash do texto para usar como chave"""
        return hashlib.sha256(text.encode('utf-8')).hexdigest()
    
    def get(self, text: str) -> Optional[Dict[str, Any]]:
        """Recupera resultado do cache"""
        key = self._hash_text(text)
        return self.cache.get(key)
    
    def set(self, text: str, result: Dict[str, Any]):
        """Armazena resultado no cache"""
        key = self._hash_text(text)
        self.cache[key] = result
        logger.debug("Cached analysis result", key=key[:8])
```

#### Passo 8.4.2: Integrar cache no TextAnalysisService

**Modificar:** `apps/text-analysis/src/services/analysis_service.py`

Adicionar cache:
```python
from ..services.cache_service import AnalysisCache

class TextAnalysisService:
    def __init__(self):
        # ... código existente ...
        self.cache = AnalysisCache(max_size=1000, ttl=3600)
    
    async def analyze(self, chunk: TranscriptionChunk) -> Dict[str, Any]:
        # Verificar cache primeiro
        cached = self.cache.get(chunk.text)
        if cached:
            logger.debug("Using cached analysis result")
            return cached
        
        # ... análise ML ...
        
        # Armazenar no cache
        self.cache.set(chunk.text, result)
        return result
```

---

### FASE 8.5: Métricas e Monitoramento

#### Passo 8.5.1: Adicionar métricas de performance

**Criar:** `apps/text-analysis/src/services/metrics_service.py`

```python
import time
from typing import Dict, Any
from collections import defaultdict
import structlog

logger = structlog.get_logger()

class MetricsService:
    """Coleta métricas de performance do serviço"""
    
    def __init__(self):
        self.request_count = 0
        self.error_count = 0
        self.total_latency_ms = 0.0
        self.latency_history = []
        self.model_load_times = {}
    
    def record_analysis(self, latency_ms: float, success: bool):
        """Registra métrica de análise"""
        self.request_count += 1
        if success:
            self.total_latency_ms += latency_ms
            self.latency_history.append(latency_ms)
            # Manter apenas últimos 100
            if len(self.latency_history) > 100:
                self.latency_history.pop(0)
        else:
            self.error_count += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas atuais"""
        avg_latency = (
            self.total_latency_ms / max(self.request_count - self.error_count, 1)
        )
        return {
            'request_count': self.request_count,
            'error_count': self.error_count,
            'success_rate': (
                (self.request_count - self.error_count) / max(self.request_count, 1)
            ),
            'avg_latency_ms': avg_latency,
            'min_latency_ms': min(self.latency_history) if self.latency_history else 0,
            'max_latency_ms': max(self.latency_history) if self.latency_history else 0,
        }
```

#### Passo 8.5.2: Adicionar endpoint de métricas

**Modificar:** `apps/text-analysis/src/main.py`

```python
from .services.metrics_service import MetricsService

metrics_service = MetricsService()

@fastapi_app.get("/metrics")
async def metrics():
    """Endpoint de métricas"""
    return JSONResponse(metrics_service.get_stats())
```

---

### FASE 8.6: Testes e Validação

#### Passo 8.6.1: Criar testes unitários

**Criar:** `apps/text-analysis/tests/test_analysis_service.py`

```python
import pytest
from src.services.analysis_service import TextAnalysisService
from src.types.messages import TranscriptionChunk

@pytest.mark.asyncio
async def test_sentiment_analysis():
    service = TextAnalysisService()
    chunk = TranscriptionChunk(
        meetingId="test",
        participantId="user1",
        text="Estou muito feliz com o resultado!",
        timestamp=1234567890
    )
    result = await service.analyze(chunk)
    assert 'sentiment_score' in result
    assert result['sentiment_score']['positive'] > 0

@pytest.mark.asyncio
async def test_keyword_extraction():
    service = TextAnalysisService()
    chunk = TranscriptionChunk(
        meetingId="test",
        participantId="user1",
        text="Precisamos discutir o projeto e a implementação",
        timestamp=1234567890
    )
    result = await service.analyze(chunk)
    assert 'keywords' in result
    assert len(result['keywords']) > 0
```

#### Passo 8.6.2: Testes de performance

**Criar:** `apps/text-analysis/tests/test_performance.py`

```python
import pytest
import time
from src.services.analysis_service import TextAnalysisService

@pytest.mark.asyncio
async def test_latency():
    service = TextAnalysisService()
    chunk = TranscriptionChunk(
        meetingId="test",
        participantId="user1",
        text="Texto de teste para análise de performance",
        timestamp=1234567890
    )
    
    start = time.time()
    result = await service.analyze(chunk)
    latency_ms = (time.time() - start) * 1000
    
    assert latency_ms < 1000  # Deve ser < 1 segundo
```

---

### FASE 8.7: Documentação e Deploy

#### Passo 8.7.1: Atualizar README

**Modificar:** `apps/text-analysis/README.md`

Adicionar seção sobre modelos ML:
```markdown
## Modelos ML

O serviço suporta análise de texto usando modelos de Machine Learning:

- **Sentimento:** BERT em português (neuralmind/bert-base-portuguese-cased)
- **Emoções:** Modelo de detecção de emoções
- **Palavras-chave:** Extração baseada em frequência e stopwords

### Configuração

Configure as variáveis de ambiente:
- `ENABLE_ML_ANALYSIS=true` - Habilita análise ML
- `MODEL_DEVICE=cpu` - Dispositivo (cpu ou cuda)
- `MODEL_CACHE_DIR=/app/models/.cache` - Diretório de cache dos modelos
```

#### Passo 8.7.2: Atualizar docker-compose.yml

**Modificar:** `apps/text-analysis/docker-compose.yml`

Adicionar volume para cache de modelos:
```yaml
volumes:
  - ./src:/app/src:ro
  - text_analysis_models:/app/models  # Cache de modelos ML
```

---

## 📊 Ordem de Implementação Recomendada

1. **Fase 8.1:** Preparação (dependências, Docker, env)
2. **Fase 8.2:** Estrutura de modelos (sentiment, emotion, keywords)
3. **Fase 8.3:** Integração no serviço (substituir placeholder)
4. **Fase 8.4:** Otimizações (cache, batching)
5. **Fase 8.5:** Métricas e monitoramento
6. **Fase 8.6:** Testes e validação
7. **Fase 8.7:** Documentação e deploy

---

## ⚠️ Considerações Importantes

### Modelos em Português
- Priorizar modelos treinados em português (pt-BR)
- NeuralMind BERT é uma boa opção para sentimento
- Considerar modelos multilíngues se necessário

### Performance
- **Lazy Loading:** Carregar modelos apenas quando necessário
- **Cache:** Evitar reprocessar textos idênticos
- **Batching:** Processar múltiplas transcrições juntas (futuro)
- **GPU:** Opcional, mas pode acelerar significativamente

### Recursos
- **Memória:** Modelos BERT podem usar 2-4GB RAM
- **CPU:** Processamento pode ser intensivo
- **Disco:** Cache de modelos pode ocupar vários GB

### Fallback
- Sempre manter fallback para quando ML falhar
- Sistema deve funcionar mesmo sem modelos carregados
- Logs detalhados para debug

---

## 🎯 Critérios de Sucesso

- ✅ Análise de sentimento funcionando com modelos ML
- ✅ Detecção de emoções implementada
- ✅ Extração de palavras-chave melhorada
- ✅ Latência < 500ms por transcrição
- ✅ Cache funcionando corretamente
- ✅ Métricas sendo coletadas
- ✅ Testes passando
- ✅ Documentação atualizada

---

**Data de Criação:** 2025-01-27  
**Versão:** 1.0  
**Status:** Planejamento Detalhado

