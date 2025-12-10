# Fase 8 – Pipeline NLP com BERT Leve

## 📋 Objetivo

Implementar um sistema completo de análise de texto em tempo real utilizando modelo BERT otimizado para processamento eficiente de transcrições de reuniões em português.

### Escopo de Implementação

- **Análise de Sentimento**: Classificação em positivo, negativo e neutro com scores probabilísticos
- **Detecção de Emoções**: Identificação de emoções básicas (alegria, tristeza, raiva, medo, surpresa)
- **Extração de Keywords**: Identificação automática de palavras-chave relevantes
- **Cache Inteligente**: Sistema de cache em memória com TTL para otimização de performance
- **Pipeline Assíncrono**: Processamento não-bloqueante para garantir latência < 500ms
- **Integração Real-time**: Comunicação bidirecional via Socket.IO com backend NestJS

### Filosofia de Design

- **Simplicidade**: Implementação direta sem complexidade desnecessária
- **Performance**: Otimização para latência baixa e uso eficiente de recursos
- **Confiabilidade**: Tratamento robusto de erros e fallbacks
- **Escalabilidade**: Arquitetura preparada para crescimento futuro

---

## 🛠️ Tecnologias Utilizadas

### Core Stack

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **Python** | 3.11 | Linguagem base do serviço |
| **PyTorch** | 2.1.2 | Framework de deep learning para inferência |
| **Transformers** | 4.37.2 | Biblioteca Hugging Face para modelos pré-treinados |
| **FastAPI** | 0.109.0 | Framework web assíncrono para endpoints REST |
| **Socket.IO** | 5.11.0 | Comunicação em tempo real com backend |
| **Uvicorn** | 0.27.0 | ASGI server para FastAPI |

### NLP e ML

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **BERT Model** | neuralmind/bert-base-portuguese-cased | Modelo de linguagem pré-treinado em português |
| **NLTK** | 3.8.1 | Processamento de linguagem natural (tokenização, stopwords) |
| **SentencePiece** | 0.1.99 | Tokenização subword para modelos BERT |
| **Tokenizers** | 0.15.0 | Biblioteca de tokenização rápida |

### Infraestrutura e Utilidades

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **Docker** | Latest | Containerização do serviço |
| **Docker Compose** | 3.8 | Orquestração e gerenciamento |
| **Cachetools** | 5.3.2 | Cache em memória com TTL |
| **Pydantic** | 2.5.3 | Validação de dados e modelos |
| **Structlog** | 24.1.0 | Logging estruturado e contextualizado |
| **Python-dotenv** | 1.0.0 | Gerenciamento de variáveis de ambiente |

### Justificativa de Escolhas

- **BERT Português**: Modelo específico para português brasileiro, otimizado para sentimento
- **PyTorch 2.1.2**: Versão estável com suporte completo a CPU e CUDA
- **FastAPI**: Performance superior ao Flask, suporte nativo a async/await
- **Socket.IO**: Protocolo confiável com fallback automático e reconexão
- **Cachetools**: Cache thread-safe com TTL automático, ideal para alta concorrência

---

## 🏗️ Arquitetura do Sistema

### Diagrama de Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ transcription-capture.js                                   │  │
│  │  - Captura transcrições do Google Meet                   │  │
│  │  - Polling a cada 1 segundo                               │  │
│  │  - Envia via WebSocket nativo                            │  │
│  └───────────────────────┬──────────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────────┘
                            │ WebSocket (ws://)
                            │ POST /egress-transcription
                            │ Payload: {text, timestamp, confidence}
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend NestJS                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ transcription-egress.server.ts                           │  │
│  │  - Recebe transcrições via WebSocket                      │  │
│  │  - Valida e sanitiza dados                                │  │
│  │  - Cria TranscriptionChunk                                │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                       │
│  ┌───────────────────────▼──────────────────────────────────┐  │
│  │ TextAnalysisService (NestJS)                              │  │
│  │  - Cliente Socket.IO                                     │  │
│  │  - Emite: 'transcription_chunk'                          │  │
│  │  - Escuta: 'text_analysis_result'                        │  │
│  └───────────────────────┬──────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────┘
                           │ Socket.IO (http://)
                           │ Event: transcription_chunk
                           │ Payload: TranscriptionChunk
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Python Service (Docker Container)                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Socket.IO Server (ASGI)                                  │ │
│  │  - Recebe: 'transcription_chunk'                         │ │
│  │  - Valida com Pydantic                                   │ │
│  │  - Roteia para TextAnalysisService                       │ │
│  │  - Emite: 'text_analysis_result'                         │ │
│  └───────────────────────┬──────────────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼──────────────────────────────────┐ │
│  │ TextAnalysisService                                     │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ 1. Verifica Cache (AnalysisCache)                │  │ │
│  │  │    - Chave: meetingId:participantId:text_hash   │  │ │
│  │  │    - TTL: 300 segundos                           │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                          │                              │ │
│  │  ┌───────────────────────▼──────────────────────────┐  │ │
│  │  │ 2. Lazy Load BERT (se necessário)                │  │ │
│  │  │    - Carrega tokenizer e modelo                   │  │ │
│  │  │    - Move para device (CPU/CUDA)                  │  │ │
│  │  │    - Cria pipeline de sentimento                  │  │ │
│  │  └───────────────────────┬──────────────────────────┘  │ │
│  │                          │                              │ │
│  │  ┌───────────────────────▼──────────────────────────┐  │ │
│  │  │ 3. Análise Paralela                               │  │ │
│  │  │    ├─ Sentimento (BERT)                          │  │ │
│  │  │    ├─ Keywords (NLTK)                             │  │ │
│  │  │    └─ Emoções (Heurística)                        │  │ │
│  │  └───────────────────────┬──────────────────────────┘  │ │
│  │                          │                              │ │
│  │  ┌───────────────────────▼──────────────────────────┐  │ │
│  │  │ 4. Agrega Resultados                             │  │ │
│  │  │    - Combina todas as análises                    │  │ │
│  │  │    - Calcula métricas (word_count, etc)           │  │ │
│  │  │    - Armazena no cache                            │  │ │
│  │  └───────────────────────────────────────────────────┘  │ │
│  └───────────────────────┬──────────────────────────────────┘ │
│                          │                                      │
│  ┌───────────────────────▼──────────────────────────────────┐ │
│  │ BERT Model (neuralmind/bert-base-portuguese-cased)      │ │
│  │  - 110M parâmetros                                       │ │
│  │  - Otimizado para português brasileiro                  │ │
│  │  - Suporte a sentimento e classificação                 │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Socket.IO
                           │ Event: text_analysis_result
                           │ Payload: TextAnalysisResult
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend NestJS                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ FeedbackAggregatorService                                │  │
│  │  - Recebe: 'text.analysis' (EventEmitter)                │  │
│  │  - Atualiza ParticipantState                             │  │
│  │  - Re-executa pipeline A2E2                              │  │
│  │  - Gera feedback combinado (áudio + texto)              │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                       │
│  ┌───────────────────────▼──────────────────────────────────┐  │
│  │ FeedbackDeliveryService                                 │  │
│  │  - Publica feedback via Socket.IO                        │  │
│  │  - Envia para Chrome Extension                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes Principais

1. **Chrome Extension**: Captura transcrições do Google Meet
2. **Backend NestJS**: Recebe transcrições e coordena análise
3. **Python Service**: Processa texto com BERT e retorna análise
4. **Cache Layer**: Reduz reprocessamento e melhora latência
5. **BERT Model**: Modelo de linguagem para análise semântica

### Fluxo de Dados

1. **Ingestão**: Transcrição capturada → WebSocket → Backend
2. **Roteamento**: Backend → Socket.IO → Python Service
3. **Processamento**: Cache check → BERT analysis → Agregação
4. **Retorno**: Python Service → Socket.IO → Backend
5. **Integração**: Backend → A2E2 Pipeline → Feedback

---

## 📦 Estrutura de Pastas

```
apps/text-analysis/
│
├── src/
│   ├── __init__.py
│   ├── main.py                          # Entry point: FastAPI + Socket.IO
│   ├── config.py                         # Configurações centralizadas
│   ├── socketio_server.py               # Servidor Socket.IO (ASGI)
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── bert_analyzer.py             # Classe BERTAnalyzer
│   │       ├── __init__()
│   │       ├── _load_model()
│   │       ├── analyze_sentiment()
│   │       ├── extract_keywords()
│   │       └── detect_emotions()
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── analysis_service.py           # TextAnalysisService
│   │   │   ├── __init__()
│   │   │   ├── _get_analyzer()
│   │   │   └── analyze()
│   │   └── cache_service.py             # AnalysisCache
│   │       ├── __init__()
│   │       ├── get()
│   │       ├── set()
│   │       └── clear()
│   │
│   └── types/
│       ├── __init__.py
│       └── messages.py                  # Modelos Pydantic
│           ├── TranscriptionChunk
│           └── TextAnalysisResult
│
├── requirements.txt                      # Dependências Python
├── Dockerfile                           # Imagem Docker
├── docker-compose.yml                   # Orquestração
├── .env.example                         # Variáveis de ambiente
└── README.md                            # Documentação
```

### Descrição dos Módulos

- **`main.py`**: Inicializa FastAPI, monta Socket.IO, configura logging
- **`config.py`**: Centraliza todas as configurações do serviço
- **`socketio_server.py`**: Handlers Socket.IO para eventos de transcrição
- **`models/bert_analyzer.py`**: Lógica de análise com BERT (sentimento, keywords, emoções)
- **`services/analysis_service.py`**: Orquestra análise, gerencia cache, lazy loading
- **`services/cache_service.py`**: Cache em memória com TTL
- **`types/messages.py`**: Schemas Pydantic para validação de dados

---

## 🚀 Implementação Passo a Passo

### Passo 1: Configuração do Ambiente

#### 1.1 Arquivo `requirements.txt`

```txt
# Socket.IO
python-socketio[asyncio]==5.11.0

# Web Framework
fastapi==0.109.0
uvicorn[standard]==0.27.0

# Utilitários
pydantic==2.5.3
python-dotenv==1.0.0

# Logging
structlog==24.1.0

# ML/NLP
torch==2.1.2
transformers==4.37.2
sentencepiece==0.1.99
tokenizers==0.15.0

# NLP em Português
nltk==3.8.1

# Cache
cachetools==5.3.2

# HTTP Client (para health checks)
httpx==0.26.0
```

**Notas**:
- Versões fixas garantem reprodutibilidade
- `torch` e `transformers` são as dependências mais pesadas (~2GB)
- `nltk` requer download de recursos durante build

#### 1.2 Arquivo `.env.example`

```bash
# Server Configuration
PORT=8000
HOST=0.0.0.0
LOG_LEVEL=INFO

# Socket.IO Configuration
SOCKETIO_CORS_ORIGINS=*

# ML Model Configuration
MODEL_NAME=neuralmind/bert-base-portuguese-cased
MODEL_CACHE_DIR=/app/models/.cache
MODEL_DEVICE=cpu

# Cache Configuration
CACHE_TTL_SECONDS=300
CACHE_MAX_SIZE=1000

# Performance Tuning
ANALYSIS_MAX_LENGTH=512
ANALYSIS_BATCH_SIZE=1
```

**Explicação das Variáveis**:
- `MODEL_NAME`: Nome do modelo no Hugging Face Hub
- `MODEL_CACHE_DIR`: Diretório para cache de modelos (persistente via volume)
- `MODEL_DEVICE`: `cpu` ou `cuda` (GPU)
- `CACHE_TTL_SECONDS`: Tempo de vida do cache (5 minutos padrão)
- `CACHE_MAX_SIZE`: Máximo de entradas no cache (evita memory leak)

#### 1.3 Arquivo `src/config.py`

```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """
    Configurações centralizadas do serviço de análise de texto.
    Todas as configurações são carregadas de variáveis de ambiente
    com valores padrão sensatos.
    """
    
    # Server Configuration
    PORT: int = int(os.getenv('PORT', '8000'))
    HOST: str = os.getenv('HOST', '0.0.0.0')
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    
    # Socket.IO Configuration
    SOCKETIO_CORS_ORIGINS: list = os.getenv('SOCKETIO_CORS_ORIGINS', '*').split(',')
    
    # ML Model Configuration
    MODEL_NAME: str = os.getenv('MODEL_NAME', 'neuralmind/bert-base-portuguese-cased')
    MODEL_CACHE_DIR: str = os.getenv('MODEL_CACHE_DIR', '/app/models/.cache')
    MODEL_DEVICE: str = os.getenv('MODEL_DEVICE', 'cpu')
    
    # Cache Configuration
    CACHE_TTL_SECONDS: int = int(os.getenv('CACHE_TTL_SECONDS', '300'))
    CACHE_MAX_SIZE: int = int(os.getenv('CACHE_MAX_SIZE', '1000'))
    
    # Performance Configuration
    ANALYSIS_MAX_LENGTH: int = int(os.getenv('ANALYSIS_MAX_LENGTH', '512'))
    ANALYSIS_BATCH_SIZE: int = int(os.getenv('ANALYSIS_BATCH_SIZE', '1'))
    
    @classmethod
    def validate(cls):
        """Valida configurações críticas"""
        assert cls.MODEL_NAME, "MODEL_NAME must be set"
        assert cls.MODEL_CACHE_DIR, "MODEL_CACHE_DIR must be set"
        assert cls.CACHE_TTL_SECONDS > 0, "CACHE_TTL_SECONDS must be positive"
        assert cls.CACHE_MAX_SIZE > 0, "CACHE_MAX_SIZE must be positive"
```

---

### Passo 2: Dockerfile Otimizado

```dockerfile
FROM python:3.11-slim

# Metadados
LABEL maintainer="live-meeting-team"
LABEL description="Text Analysis Service with BERT for Portuguese"
LABEL version="1.0.0"

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Diretório de trabalho
WORKDIR /app

# Copiar requirements primeiro (para melhor cache do Docker)
COPY requirements.txt .

# Instalar dependências Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Baixar recursos NLTK durante build (acelera primeiro uso)
RUN python -c "import nltk; \
    nltk.download('punkt', quiet=True); \
    nltk.download('stopwords', quiet=True); \
    nltk.download('punkt_tab', quiet=True)"

# Criar diretório para modelos com permissões corretas
RUN mkdir -p /app/models && \
    chmod 755 /app/models

# Variáveis de ambiente
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV TRANSFORMERS_CACHE=/app/models/.cache
ENV HF_HOME=/app/models/.cache
ENV NLTK_DATA=/app/models/nltk_data

# Copiar código (último passo para melhor cache)
COPY src/ ./src/

# Expor porta
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s \
           --timeout=10s \
           --start-period=30s \
           --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Comando de inicialização
CMD ["python", "-m", "src.main"]
```

**Otimizações**:
- Cache de layers Docker otimizado (requirements antes do código)
- Recursos NLTK baixados durante build
- Health check com período de inicialização maior (30s para carregar modelo)
- Variáveis de ambiente configuradas para cache de modelos

---

### Passo 3: Implementação do Cache

**Arquivo:** `src/services/cache_service.py`

```python
"""
Serviço de cache em memória para resultados de análise de texto.
Utiliza TTLCache do cachetools para cache thread-safe com TTL automático.
"""

from typing import Dict, Any, Optional
from cachetools import TTLCache
import structlog
import hashlib

logger = structlog.get_logger()


class AnalysisCache:
    """
    Cache em memória com TTL para resultados de análise de texto.
    
    Características:
    - Thread-safe (TTLCache é thread-safe)
    - TTL automático (entradas expiram após TTL)
    - Tamanho limitado (evita memory leak)
    - Hash de chaves para evitar colisões
    """
    
    def __init__(self, ttl_seconds: int = 300, max_size: int = 1000):
        """
        Inicializa cache.
        
        Args:
            ttl_seconds: Tempo de vida das entradas em segundos
            max_size: Número máximo de entradas no cache
        """
        self.cache = TTLCache(maxsize=max_size, ttl=ttl_seconds)
        self.ttl_seconds = ttl_seconds
        self.max_size = max_size
        
        logger.info(
            "AnalysisCache initialized",
            ttl_seconds=ttl_seconds,
            max_size=max_size
        )
    
    def _generate_key(self, meeting_id: str, participant_id: str, text: str) -> str:
        """
        Gera chave de cache baseada em hash do texto.
        
        Args:
            meeting_id: ID da reunião
            participant_id: ID do participante
            text: Texto a ser analisado
            
        Returns:
            Chave de cache única
        """
        # Usar hash MD5 para textos longos, texto completo para textos curtos
        if len(text) > 100:
            text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()
            return f"{meeting_id}:{participant_id}:{text_hash}"
        else:
            return f"{meeting_id}:{participant_id}:{text[:100]}"
    
    def get(self, meeting_id: str, participant_id: str, text: str) -> Optional[Dict[str, Any]]:
        """
        Recupera resultado do cache.
        
        Args:
            meeting_id: ID da reunião
            participant_id: ID do participante
            text: Texto analisado
            
        Returns:
            Resultado da análise ou None se não encontrado/expirado
        """
        key = self._generate_key(meeting_id, participant_id, text)
        result = self.cache.get(key)
        
        if result:
            logger.debug(
                "Cache hit",
                meeting_id=meeting_id,
                key_preview=key[:50]
            )
        else:
            logger.debug(
                "Cache miss",
                meeting_id=meeting_id,
                key_preview=key[:50]
            )
        
        return result
    
    def set(self, meeting_id: str, participant_id: str, text: str, value: Dict[str, Any]):
        """
        Armazena resultado no cache.
        
        Args:
            meeting_id: ID da reunião
            participant_id: ID do participante
            text: Texto analisado
            value: Resultado da análise
        """
        key = self._generate_key(meeting_id, participant_id, text)
        self.cache[key] = value
        
        logger.debug(
            "Cache set",
            meeting_id=meeting_id,
            key_preview=key[:50],
            cache_size=len(self.cache)
        )
    
    def clear(self):
        """Limpa todo o cache"""
        self.cache.clear()
        logger.info("Cache cleared")
    
    def stats(self) -> Dict[str, Any]:
        """
        Retorna estatísticas do cache.
        
        Returns:
            Dict com estatísticas (tamanho atual, tamanho máximo, TTL)
        """
        return {
            "current_size": len(self.cache),
            "max_size": self.max_size,
            "ttl_seconds": self.ttl_seconds
        }
```

**Características**:
- Hash MD5 para textos longos (economia de memória)
- Thread-safe via TTLCache
- Logging detalhado para debugging
- Método `stats()` para monitoramento

---

### Passo 4: Implementação do Analisador BERT

**Arquivo:** `src/models/bert_analyzer.py`

```python
"""
Analisador de texto usando modelo BERT pré-treinado em português.
Implementa análise de sentimento, extração de keywords e detecção de emoções.
"""

import os
import torch
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    pipeline
)
from typing import Dict, List
import structlog
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from collections import Counter

logger = structlog.get_logger()

# Baixar recursos NLTK se necessário
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)


class BERTAnalyzer:
    """
    Analisador de texto usando BERT para português.
    
    Funcionalidades:
    - Análise de sentimento (positivo/negativo/neutro)
    - Extração de keywords
    - Detecção básica de emoções
    """
    
    def __init__(
        self,
        model_name: str,
        device: str = "cpu",
        cache_dir: str = None,
        max_length: int = 512
    ):
        """
        Inicializa analisador BERT.
        
        Args:
            model_name: Nome do modelo no Hugging Face Hub
            device: Dispositivo ('cpu' ou 'cuda')
            cache_dir: Diretório para cache de modelos
            max_length: Tamanho máximo de tokens
        """
        self.model_name = model_name
        self.device = device
        self.cache_dir = cache_dir
        self.max_length = max_length
        
        self.tokenizer = None
        self.model = None
        self.pipeline = None
        self._loaded = False
        
        # Stopwords em português
        try:
            self.stopwords = set(stopwords.words('portuguese'))
        except Exception as e:
            logger.warn("Failed to load Portuguese stopwords, using fallback", error=str(e))
            self.stopwords = set([
                'o', 'a', 'de', 'para', 'com', 'em', 'um', 'uma', 'que', 'é',
                'do', 'da', 'no', 'na', 'os', 'as', 'dos', 'das', 'nos', 'nas'
            ])
        
        logger.info(
            "BERTAnalyzer initialized",
            model=model_name,
            device=device,
            cache_dir=cache_dir
        )
    
    def _load_model(self):
        """Carrega modelo BERT (lazy loading)"""
        if self._loaded:
            return
        
        logger.info("Loading BERT model", model=self.model_name)
        
        try:
            # Carregar tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                cache_dir=self.cache_dir
            )
            
            # Carregar modelo
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name,
                cache_dir=self.cache_dir
            )
            
            # Mover para dispositivo
            if self.device == "cuda" and torch.cuda.is_available():
                self.model = self.model.to("cuda")
                self.device = "cuda"
                logger.info("Using CUDA device")
            else:
                self.device = "cpu"
                logger.info("Using CPU device")
            
            # Modo de avaliação (não treinamento)
            self.model.eval()
            
            # Criar pipeline para análise de sentimento
            self.pipeline = pipeline(
                "sentiment-analysis",
                model=self.model,
                tokenizer=self.tokenizer,
                device=0 if self.device == "cuda" else -1,
                return_all_scores=False
            )
            
            self._loaded = True
            logger.info("BERT model loaded successfully", device=self.device)
            
        except Exception as e:
            logger.error("Failed to load BERT model", error=str(e))
            raise
    
    def analyze_sentiment(self, text: str) -> Dict[str, float]:
        """
        Analisa sentimento do texto usando BERT.
        
        Args:
            text: Texto a ser analisado
            
        Returns:
            Dict com scores de sentimento:
            {
                'positive': float,
                'negative': float,
                'neutral': float
            }
        """
        if not self._loaded:
            self._load_model()
        
        try:
            # Truncar texto se muito longo
            if len(text) > self.max_length * 4:  # Aproximação: 4 chars por token
                text = text[:self.max_length * 4]
                logger.debug("Text truncated", original_length=len(text))
            
            # Análise com pipeline
            result = self.pipeline(text)[0]
            
            # Extrair label e score
            label = result['label'].lower()
            score = result['score']
            
            # Normalizar para formato esperado
            sentiment = {
                'positive': 0.0,
                'negative': 0.0,
                'neutral': 0.0
            }
            
            # Mapear labels do modelo para nosso formato
            if 'pos' in label or 'positive' in label or 'positivo' in label:
                sentiment['positive'] = score
                sentiment['neutral'] = 1.0 - score
            elif 'neg' in label or 'negative' in label or 'negativo' in label:
                sentiment['negative'] = score
                sentiment['neutral'] = 1.0 - score
            else:
                # Label neutro ou desconhecido
                sentiment['neutral'] = score
                sentiment['positive'] = (1.0 - score) / 2
                sentiment['negative'] = (1.0 - score) / 2
            
            logger.debug(
                "Sentiment analysis completed",
                sentiment=sentiment,
                label=label
            )
            
            return sentiment
            
        except Exception as e:
            logger.error("Sentiment analysis failed", error=str(e), text_preview=text[:50])
            # Retornar sentimento neutro em caso de erro
            return {'positive': 0.0, 'negative': 0.0, 'neutral': 1.0}
    
    def extract_keywords(self, text: str, top_n: int = 10) -> List[str]:
        """
        Extrai palavras-chave do texto usando NLTK.
        
        Args:
            text: Texto a ser processado
            top_n: Número de keywords a retornar
            
        Returns:
            Lista de palavras-chave ordenadas por frequência
        """
        try:
            # Normalizar texto
            text_lower = text.lower()
            
            # Tokenizar
            words = word_tokenize(text_lower, language='portuguese')
            
            # Filtrar: remover stopwords, pontuação e palavras muito curtas
            filtered_words = [
                word for word in words
                if word.isalnum()
                and word not in self.stopwords
                and len(word) > 2
            ]
            
            # Contar frequência
            word_freq = Counter(filtered_words)
            
            # Retornar top N
            keywords = [word for word, _ in word_freq.most_common(top_n)]
            
            logger.debug(
                "Keywords extracted",
                count=len(keywords),
                keywords=keywords[:5]
            )
            
            return keywords
            
        except Exception as e:
            logger.error("Keyword extraction failed", error=str(e))
            return []
    
    def detect_emotions(self, text: str) -> Dict[str, float]:
        """
        Detecta emoções básicas no texto (versão simplificada baseada em keywords).
        
        Args:
            text: Texto a ser analisado
            
        Returns:
            Dict com scores de emoções:
            {
                'joy': float,
                'sadness': float,
                'anger': float,
                'fear': float,
                'surprise': float
            }
        """
        emotions = {
            'joy': 0.0,
            'sadness': 0.0,
            'anger': 0.0,
            'fear': 0.0,
            'surprise': 0.0
        }
        
        # Palavras-chave para cada emoção (português)
        emotion_keywords = {
            'joy': [
                'feliz', 'alegre', 'content', 'satisfeito', 'animado',
                'entusiasmado', 'empolgado', 'radiante', 'eufórico'
            ],
            'sadness': [
                'triste', 'deprimido', 'desanimado', 'melancólico',
                'chateado', 'desapontado', 'abatido', 'desolado'
            ],
            'anger': [
                'raiva', 'irritado', 'furioso', 'bravo', 'nervoso',
                'irritado', 'revoltado', 'indignado', 'exasperado'
            ],
            'fear': [
                'medo', 'assustado', 'preocupado', 'ansioso', 'temor',
                'pânico', 'apreensivo', 'receoso', 'amedrontado'
            ],
            'surprise': [
                'surpreso', 'impressionado', 'chocado', 'admirado',
                'espantado', 'atônito', 'maravilhado', 'deslumbrado'
            ]
        }
        
        text_lower = text.lower()
        
        # Contar ocorrências de keywords para cada emoção
        for emotion, keywords in emotion_keywords.items():
            count = sum(1 for keyword in keywords if keyword in text_lower)
            if count > 0:
                # Normalizar score (0 a 1)
                emotions[emotion] = min(count / len(keywords), 1.0)
        
        logger.debug("Emotions detected", emotions=emotions)
        
        return emotions
```

**Características**:
- Lazy loading do modelo (carrega apenas quando necessário)
- Tratamento robusto de erros com fallbacks
- Suporte a CPU e CUDA
- Logging detalhado para debugging
- Otimização de memória (truncamento de textos longos)

---

### Passo 5: Serviço de Análise Principal

**Arquivo:** `src/services/analysis_service.py`

```python
"""
Serviço principal de análise de texto.
Orquestra análise com BERT, gerencia cache e agrega resultados.
"""

from typing import Dict, Any
from ..types.messages import TranscriptionChunk
from ..models.bert_analyzer import BERTAnalyzer
from ..services.cache_service import AnalysisCache
from ..config import Config
import structlog
import time

logger = structlog.get_logger()


class TextAnalysisService:
    """
    Serviço de análise de texto com BERT.
    
    Responsabilidades:
    - Gerenciar cache de resultados
    - Lazy loading do analisador BERT
    - Orquestrar análise (sentimento, keywords, emoções)
    - Agregar resultados
    """
    
    def __init__(self):
        """Inicializa serviço de análise"""
        self.analyzer = None
        self.cache = AnalysisCache(
            ttl_seconds=Config.CACHE_TTL_SECONDS,
            max_size=Config.CACHE_MAX_SIZE
        )
        
        logger.info(
            "TextAnalysisService initialized",
            cache_ttl=Config.CACHE_TTL_SECONDS,
            cache_max_size=Config.CACHE_MAX_SIZE
        )
    
    def _get_analyzer(self) -> BERTAnalyzer:
        """
        Retorna analisador BERT (lazy loading).
        
        Returns:
            Instância de BERTAnalyzer
        """
        if self.analyzer is None:
            logger.info("Initializing BERT analyzer")
            self.analyzer = BERTAnalyzer(
                model_name=Config.MODEL_NAME,
                device=Config.MODEL_DEVICE,
                cache_dir=Config.MODEL_CACHE_DIR,
                max_length=Config.ANALYSIS_MAX_LENGTH
            )
        return self.analyzer
    
    async def analyze(self, chunk: TranscriptionChunk) -> Dict[str, Any]:
        """
        Analisa texto e retorna resultados completos.
        
        Fluxo:
        1. Verifica cache
        2. Se não encontrado, executa análise
        3. Armazena no cache
        4. Retorna resultados
        
        Args:
            chunk: Chunk de transcrição a ser analisado
            
        Returns:
            Dict com resultados da análise:
            {
                'word_count': int,
                'char_count': int,
                'has_question': bool,
                'has_exclamation': bool,
                'sentiment_score': Dict[str, float],
                'emotions': Dict[str, float],
                'topics': List[str],
                'keywords': List[str]
            }
        """
        start_time = time.perf_counter()
        
        # Verificar cache primeiro
        cached_result = self.cache.get(
            chunk.meetingId,
            chunk.participantId,
            chunk.text
        )
        
        if cached_result:
            latency_ms = (time.perf_counter() - start_time) * 1000
            logger.info(
                "Analysis completed (cached)",
                meeting_id=chunk.meetingId,
                latency_ms=round(latency_ms, 2)
            )
            return cached_result
        
        # Obter analisador (lazy loading)
        analyzer = self._get_analyzer()
        
        # Executar análises em paralelo (futuro: usar asyncio.gather)
        sentiment = analyzer.analyze_sentiment(chunk.text)
        keywords = analyzer.extract_keywords(chunk.text, top_n=10)
        emotions = analyzer.detect_emotions(chunk.text)
        
        # Calcular métricas básicas
        word_count = len(chunk.text.split())
        char_count = len(chunk.text)
        has_question = '?' in chunk.text
        has_exclamation = '!' in chunk.text
        
        # Construir resultado completo
        result = {
            'word_count': word_count,
            'char_count': char_count,
            'has_question': has_question,
            'has_exclamation': has_exclamation,
            'sentiment_score': sentiment,
            'emotions': emotions,
            'topics': [],  # Placeholder para futura implementação
            'keywords': keywords
        }
        
        # Armazenar no cache
        self.cache.set(
            chunk.meetingId,
            chunk.participantId,
            chunk.text,
            result
        )
        
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        logger.info(
            "Analysis completed",
            meeting_id=chunk.meetingId,
            participant_id=chunk.participantId,
            word_count=word_count,
            sentiment=sentiment,
            keywords_count=len(keywords),
            latency_ms=round(latency_ms, 2)
        )
        
        return result
```

**Características**:
- Cache-first approach (reduz latência)
- Lazy loading do modelo BERT
- Métricas de performance (latência)
- Logging estruturado

---

### Passo 6: Servidor Socket.IO

**Arquivo:** `src/socketio_server.py`

```python
"""
Servidor Socket.IO para comunicação em tempo real com backend NestJS.
Recebe chunks de transcrição e retorna resultados de análise.
"""

import socketio
import structlog
from typing import Dict, Any
from .config import Config
from .types.messages import TranscriptionChunk, TextAnalysisResult
from .services.analysis_service import TextAnalysisService

logger = structlog.get_logger()

# Criar servidor Socket.IO
sio = socketio.AsyncServer(
    cors_allowed_origins=Config.SOCKETIO_CORS_ORIGINS,
    async_mode='asgi',
    logger=False,  # Usar structlog ao invés do logger padrão
    engineio_logger=False
)

# Criar app ASGI
app = socketio.ASGIApp(sio)

# Instanciar serviço de análise (singleton)
analysis_service = TextAnalysisService()


@sio.event
async def connect(sid, environ):
    """
    Handler para conexão de cliente.
    
    Args:
        sid: Session ID do cliente
        environ: Informações do ambiente WSGI
    """
    logger.info("Client connected", client_id=sid)


@sio.event
async def disconnect(sid):
    """
    Handler para desconexão de cliente.
    
    Args:
        sid: Session ID do cliente
    """
    logger.info("Client disconnected", client_id=sid)


@sio.event
async def transcription_chunk(sid, data: Dict[str, Any]):
    """
    Handler principal: recebe chunk de transcrição e retorna análise.
    
    Fluxo:
    1. Valida dados com Pydantic
    2. Processa com TextAnalysisService
    3. Cria TextAnalysisResult
    4. Emite resultado via Socket.IO
    
    Args:
        sid: Session ID do cliente
        data: Dados do chunk de transcrição
    """
    try:
        logger.info(
            "Received transcription chunk",
            client_id=sid,
            meeting_id=data.get('meetingId'),
            participant_id=data.get('participantId')
        )
        
        # Validar e parsear dados com Pydantic
        chunk = TranscriptionChunk(**data)
        
        # Processar texto com BERT
        analysis_result = await analysis_service.analyze(chunk)
        
        # Criar resposta
        result = TextAnalysisResult(
            meetingId=chunk.meetingId,
            participantId=chunk.participantId,
            text=chunk.text,
            analysis=analysis_result,
            timestamp=chunk.timestamp,
            confidence=0.9  # Confiança baseada no modelo BERT
        )
        
        # Enviar resultado de volta via Socket.IO
        await sio.emit('text_analysis_result', result.dict(), room=sid)
        
        logger.info(
            "Sent analysis result",
            client_id=sid,
            meeting_id=chunk.meetingId,
            sentiment=analysis_result.get('sentiment_score', {})
        )
        
    except Exception as e:
        logger.error(
            "Error processing transcription",
            error=str(e),
            error_type=type(e).__name__,
            client_id=sid
        )
        # Enviar erro para cliente
        await sio.emit('error', {
            'message': str(e),
            'type': type(e).__name__
        }, room=sid)


@sio.event
async def ping(sid, data: Dict[str, Any]):
    """
    Health check ping/pong.
    
    Args:
        sid: Session ID do cliente
        data: Dados do ping (opcional)
    """
    await sio.emit('pong', {
        'timestamp': data.get('timestamp'),
        'service': 'text-analysis'
    }, room=sid)
```

**Características**:
- Validação com Pydantic
- Tratamento de erros robusto
- Logging estruturado
- Health check ping/pong

---

### Passo 7: Entry Point (FastAPI + Socket.IO)

**Arquivo:** `src/main.py`

```python
"""
Entry point do serviço de análise de texto.
Integra FastAPI (para endpoints REST) com Socket.IO (para comunicação real-time).
"""

import uvicorn
import structlog
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from .config import Config
from .socketio_server import app as socketio_app
from .services.analysis_service import TextAnalysisService
from .types.messages import TranscriptionChunk

# Configurar structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Criar app FastAPI
fastapi_app = FastAPI(
    title="Text Analysis Service",
    description="Serviço de análise de texto com BERT para português",
    version="1.0.0"
)

# Instanciar serviço de análise
analysis_service = TextAnalysisService()


@fastapi_app.get("/health")
async def health():
    """
    Health check endpoint.
    
    Returns:
        JSON com status do serviço
    """
    return JSONResponse({
        "status": "ok",
        "service": "text-analysis",
        "version": "1.0.0"
    })


@fastapi_app.post("/analyze")
async def analyze_text(request: dict):
    """
    Endpoint REST para análise de texto (para testes e debugging).
    
    Request Body:
    {
        "text": "Texto a ser analisado",
        "meetingId": "meet_123",
        "participantId": "user_456",
        "timestamp": 1234567890
    }
    
    Response:
    {
        "meetingId": "meet_123",
        "participantId": "user_456",
        "text": "Texto a ser analisado",
        "analysis": {
            "word_count": 5,
            "char_count": 25,
            "has_question": false,
            "has_exclamation": false,
            "sentiment_score": {
                "positive": 0.7,
                "negative": 0.1,
                "neutral": 0.2
            },
            "emotions": {...},
            "topics": [],
            "keywords": ["texto", "analisado"]
        },
        "timestamp": 1234567890,
        "confidence": 0.9
    }
    """
    try:
        # Validar request
        if not request.get('text'):
            raise HTTPException(status_code=400, detail="Text is required")
        
        # Criar chunk
        chunk = TranscriptionChunk(
            meetingId=request.get('meetingId', 'test_meeting'),
            participantId=request.get('participantId', 'test_user'),
            text=request.get('text', ''),
            timestamp=request.get('timestamp', 0)
        )
        
        # Processar análise
        analysis_result = await analysis_service.analyze(chunk)
        
        # Retornar resultado
        return JSONResponse({
            "meetingId": chunk.meetingId,
            "participantId": chunk.participantId,
            "text": chunk.text,
            "analysis": analysis_result,
            "timestamp": chunk.timestamp,
            "confidence": 0.9
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in /analyze endpoint", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@fastapi_app.get("/cache/stats")
async def cache_stats():
    """
    Endpoint para estatísticas do cache.
    
    Returns:
        JSON com estatísticas do cache
    """
    stats = analysis_service.cache.stats()
    return JSONResponse(stats)


@fastapi_app.post("/cache/clear")
async def clear_cache():
    """
    Endpoint para limpar cache (útil para testes).
    
    Returns:
        JSON com confirmação
    """
    analysis_service.cache.clear()
    return JSONResponse({"status": "cache cleared"})


# Montar Socket.IO app no FastAPI
fastapi_app.mount("/socket.io/", socketio_app)

if __name__ == "__main__":
    # Validar configurações
    Config.validate()
    
    logger.info(
        "Starting Text Analysis Service",
        host=Config.HOST,
        port=Config.PORT,
        model=Config.MODEL_NAME,
        device=Config.MODEL_DEVICE
    )
    
    uvicorn.run(
        fastapi_app,
        host=Config.HOST,
        port=Config.PORT,
        log_level=Config.LOG_LEVEL.lower(),
        access_log=False  # Usar structlog ao invés
    )
```

**Características**:
- FastAPI para endpoints REST
- Socket.IO montado no FastAPI
- Endpoints de debug (`/cache/stats`, `/cache/clear`)
- Validação de configurações na inicialização

---

## 🧪 Exemplos de Uso

### Exemplo 1: Via Socket.IO (Produção)

**Cliente (Backend NestJS):**

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:8001', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('Connected to text analysis service');
  
  // Enviar chunk de transcrição
  socket.emit('transcription_chunk', {
    meetingId: 'meet_abc123',
    participantId: 'user_xyz789',
    text: 'Estou muito feliz com o progresso do projeto!',
    timestamp: Date.now(),
    language: 'pt-BR',
    confidence: 0.95
  });
});

socket.on('text_analysis_result', (result) => {
  console.log('Analysis result:', result);
  // {
  //   meetingId: 'meet_abc123',
  //   participantId: 'user_xyz789',
  //   text: 'Estou muito feliz com o progresso do projeto!',
  //   analysis: {
  //     word_count: 8,
  //     char_count: 47,
  //     has_question: false,
  //     has_exclamation: true,
  //     sentiment_score: {
  //       positive: 0.85,
  //       negative: 0.05,
  //       neutral: 0.10
  //     },
  //     emotions: {
  //       joy: 0.5,
  //       sadness: 0.0,
  //       anger: 0.0,
  //       fear: 0.0,
  //       surprise: 0.0
  //     },
  //     topics: [],
  //     keywords: ['feliz', 'progresso', 'projeto']
  //   },
  //   timestamp: 1701234567890,
  //   confidence: 0.9
  // }
});

socket.on('error', (error) => {
  console.error('Error:', error);
});
```

### Exemplo 2: Via REST API (Testes)

**Request:**

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Este produto é terrível, não recomendo!",
    "meetingId": "test_meeting",
    "participantId": "test_user",
    "timestamp": 1701234567890
  }'
```

**Response:**

```json
{
  "meetingId": "test_meeting",
  "participantId": "test_user",
  "text": "Este produto é terrível, não recomendo!",
  "analysis": {
    "word_count": 6,
    "char_count": 40,
    "has_question": false,
    "has_exclamation": true,
    "sentiment_score": {
      "positive": 0.10,
      "negative": 0.80,
      "neutral": 0.10
    },
    "emotions": {
      "joy": 0.0,
      "sadness": 0.0,
      "anger": 0.3,
      "fear": 0.0,
      "surprise": 0.0
    },
    "topics": [],
    "keywords": ["produto", "terrível", "recomendo"]
  },
  "timestamp": 1701234567890,
  "confidence": 0.9
}
```

### Exemplo 3: Health Check

```bash
curl http://localhost:8000/health
```

**Response:**

```json
{
  "status": "ok",
  "service": "text-analysis",
  "version": "1.0.0"
}
```

### Exemplo 4: Cache Stats

```bash
curl http://localhost:8000/cache/stats
```

**Response:**

```json
{
  "current_size": 42,
  "max_size": 1000,
  "ttl_seconds": 300
}
```

---

## 🐳 Docker e Deploy

### Docker Compose

**Arquivo:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  text-analysis:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: live-meeting-text-analysis
    restart: unless-stopped
    ports:
      - "8001:8000"
    environment:
      - PYTHONUNBUFFERED=1
      - LOG_LEVEL=INFO
      - SOCKETIO_CORS_ORIGINS=*
      - PORT=8000
      - HOST=0.0.0.0
      - MODEL_NAME=neuralmind/bert-base-portuguese-cased
      - MODEL_CACHE_DIR=/app/models/.cache
      - MODEL_DEVICE=cpu
      - CACHE_TTL_SECONDS=300
      - CACHE_MAX_SIZE=1000
      - ANALYSIS_MAX_LENGTH=512
    volumes:
      - ./src:/app/src:ro
      - text_analysis_models:/app/models
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - live-meeting-network

volumes:
  text_analysis_models:
    driver: local

networks:
  live-meeting-network:
    external: true
```

**Comandos:**

```bash
# Construir e iniciar
cd apps/text-analysis
docker-compose up -d

# Ver logs
docker-compose logs -f text-analysis

# Parar
docker-compose down

# Parar e remover volumes (limpar cache de modelos)
docker-compose down -v

# Rebuild
docker-compose up -d --build
```

---

## 📊 Performance e Métricas

### Latência Esperada

| Operação | Latência (CPU) | Latência (GPU) |
|----------|----------------|----------------|
| **Cache Hit** | < 10ms | < 10ms |
| **Análise Completa** | 200-500ms | 50-150ms |
| **Carregamento Inicial** | 5-10s | 3-5s |

### Uso de Recursos

| Recurso | CPU | GPU |
|---------|-----|-----|
| **RAM (Idle)** | ~500MB | ~500MB |
| **RAM (Modelo Carregado)** | ~2-3GB | ~2-3GB |
| **VRAM (GPU)** | N/A | ~1-2GB |
| **Disco (Modelo)** | ~500MB | ~500MB |

### Otimizações Implementadas

1. **Cache em Memória**: Reduz reprocessamento
2. **Lazy Loading**: Modelo carregado apenas quando necessário
3. **Truncamento de Texto**: Limita tamanho de entrada
4. **Batch Processing**: Preparado para processamento em lote (futuro)

### Recomendações

- **CPU**: Adequado para desenvolvimento e testes
- **GPU**: Recomendado para produção com alto volume
- **Cache**: Ajustar TTL baseado em padrões de uso
- **Memória**: Monitorar uso e ajustar `CACHE_MAX_SIZE` se necessário

---

## 🔍 Troubleshooting

### Problema: Modelo não carrega

**Sintomas:**
- Erro ao inicializar BERTAnalyzer
- Timeout no health check

**Soluções:**
```bash
# Verificar logs
docker-compose logs text-analysis

# Verificar espaço em disco
docker exec text-analysis df -h

# Verificar permissões
docker exec text-analysis ls -la /app/models

# Limpar cache e recarregar
docker-compose down -v
docker-compose up -d
```

### Problema: Latência alta

**Sintomas:**
- Análise demora > 1s
- Timeout em requisições

**Soluções:**
- Verificar uso de CPU: `docker stats text-analysis`
- Reduzir `CACHE_TTL_SECONDS` se cache muito grande
- Considerar usar GPU se disponível
- Verificar se há outros processos consumindo recursos

### Problema: Erro de memória

**Sintomas:**
- Container é morto pelo OOM killer
- Erros de memória no log

**Soluções:**
- Reduzir `CACHE_MAX_SIZE`
- Aumentar limite de memória do container
- Verificar se há memory leak (monitorar uso ao longo do tempo)

### Problema: Socket.IO não conecta

**Sintomas:**
- Backend não consegue conectar ao serviço Python
- Erros de conexão

**Soluções:**
- Verificar se serviço está rodando: `curl http://localhost:8001/health`
- Verificar variável `TEXT_ANALYSIS_SERVICE_URL` no backend
- Verificar firewall/portas
- Verificar logs do Socket.IO no Python service

---

## ✅ Checklist de Implementação

- [ ] Atualizar `requirements.txt` com todas as dependências
- [ ] Criar/atualizar `.env.example` com todas as variáveis
- [ ] Implementar `src/config.py` com validação
- [ ] Criar `src/services/cache_service.py`
- [ ] Criar `src/models/bert_analyzer.py`
- [ ] Atualizar `src/services/analysis_service.py`
- [ ] Atualizar `src/socketio_server.py`
- [ ] Atualizar `src/main.py` com FastAPI
- [ ] Atualizar `Dockerfile` com otimizações
- [ ] Atualizar `docker-compose.yml` com volumes e networks
- [ ] Testar build Docker: `docker-compose build`
- [ ] Testar health check: `curl http://localhost:8001/health`
- [ ] Testar endpoint REST: `curl -X POST http://localhost:8001/analyze ...`
- [ ] Testar Socket.IO com backend NestJS
- [ ] Verificar logs e métricas de performance
- [ ] Documentar variáveis de ambiente
- [ ] Atualizar README.md

---

## 📝 Notas Finais

### Limitações da Versão Atual

- **Emoções**: Baseadas em keywords (não ML)
- **Tópicos**: Não implementado (placeholder)
- **Cache**: Em memória apenas (não persistente)
- **Batch**: Processamento sequencial (não paralelo)

### Próximos Passos (Opcional)

- Implementar análise de emoções com ML
- Adicionar análise de tópicos (LDA/BERTopic)
- Implementar cache persistente (Redis)
- Adicionar processamento em batch paralelo
- Implementar métricas de performance (Prometheus)
- Adicionar suporte a múltiplos modelos
- Implementar A/B testing de modelos

---

**Documento Técnico Completo - Fase 8: Pipeline NLP com BERT Leve**
**Versão 1.0.0 - Data: 2024**

