# Planejamento: Serviço Python de Análise de Texto em Tempo Real

## 📋 Visão Geral

Este documento descreve o planejamento completo para criação de um serviço Python containerizado que realizará análise de texto (transcrições do Google Meet) em tempo real, integrado ao sistema existente de análise de emoções baseado em áudio.

---

## 🏗️ Arquitetura Geral

```
┌─────────────────┐
│ Chrome Extension│
│  (Google Meet)  │
└────────┬────────┘
         │
         │ 1. Captura Transcrição
         │    (WebSocket nativo)
         ▼
┌─────────────────┐
│   Backend       │
│   (NestJS)      │
└────────┬────────┘
         │
         │ 2. Envia para Serviço Python
         │    (Socket.IO Client)
         ▼
┌─────────────────┐
│ Serviço Python  │
│ (PyTorch/ML)    │
│ Socket.IO Server│
└────────┬────────┘
         │
         │ 3. Retorna Análise
         │    (Socket.IO)
         ▼
┌─────────────────┐
│   Backend       │
│   (NestJS)      │
└────────┬────────┘
         │
         │ 4. Integra com Pipeline A2E2
         │    (EventEmitter interno)
         │ 5. Gera Feedback
         │    (Socket.IO Server)
         ▼
┌─────────────────┐
│ Chrome Extension│
│  (Feedback UI)  │
│  Socket.IO Client│
└─────────────────┘
```

**Nota:** O feedback é entregue via Socket.IO através da sala `feedback:<meetingId>`, usando o `AppWebSocketGateway` existente.

---

## 📁 Estrutura de Pastas Proposta

```
live-meeting/
├── apps/
│   ├── backend/              # Existente
│   ├── chrome-extension/     # Existente
│   └── text-analysis/        # NOVO SERVIÇO
│       ├── Dockerfile
│       ├── docker-compose.yml
│       ├── requirements.txt
│       ├── .env.example
│       ├── README.md
│       ├── src/
│       │   ├── __init__.py
│       │   ├── main.py              # Entry point (FastAPI/Socket.IO server)
│       │   ├── config.py            # Configurações
│       │   ├── socketio_server.py   # Servidor Socket.IO
│       │   ├── models/              # Modelos ML (futuro)
│       │   │   ├── __init__.py
│       │   │   └── sentiment.py     # Placeholder para análise de sentimento
│       │   ├── services/
│       │   │   ├── __init__.py
│       │   │   └── analysis_service.py  # Lógica de análise (placeholder)
│       │   └── types/
│       │       ├── __init__.py
│       │       └── messages.py      # Tipos de mensagens (Pydantic models)
│       ├── tests/
│       │   ├── __init__.py
│       │   ├── test_socketio.py
│       │   └── test_analysis.py
│       └── scripts/
│           └── download_models.sh  # Script para baixar modelos (futuro)
```

---

## 🔌 Fluxo de Dados Detalhado

### 1. Captura de Transcrição (Chrome Extension)

**Arquivo:** `apps/chrome-extension/transcription-capture.js` (NOVO)

**Responsabilidades:**
- Capturar transcrições do Google Meet em tempo real
- Enviar para backend via WebSocket nativo (similar ao áudio)
- Formato: JSON com texto, timestamp, participantId

**Estrutura de Mensagem:**
```javascript
{
  type: 'TRANSCRIPTION_CHUNK',
  meetingId: 'RM_123',
  participantId: 'user_abc',
  text: 'Olá, como vocês estão?',
  timestamp: 1234567890,
  language: 'pt-BR',
  confidence: 0.95
}
```

**Endpoint Backend:** `ws://localhost:3001/egress-transcription?meetingId=<id>&participantId=<id>&language=pt-BR`

**Nota:** Similar ao endpoint de áudio (`/egress-audio`), usando WebSocket nativo (não Socket.IO).

---

### 2. Recepção no Backend (NestJS)

**Arquivo:** `apps/backend/src/egress/transcription-egress.server.ts` (NOVO)

**Responsabilidades:**
- Receber transcrições via WebSocket nativo
- Validar e normalizar dados
- Enviar para serviço Python via Socket.IO
- Gerenciar buffer/agrupamento de transcrições (similar ao áudio)

**Estrutura Interna:**
```typescript
interface TranscriptionChunk {
  meetingId: string;
  participantId: string;
  text: string;
  timestamp: number;
  language?: string;
  confidence?: number;
}
```

**Agrupamento:**
- Similar ao áudio: agrupar transcrições por janela temporal (ex: 5-10 segundos)
- Ou enviar imediatamente (dependendo da estratégia)

---

### 3. Serviço Python (Socket.IO Server)

**Arquivo:** `apps/text-analysis/src/socketio_server.py` (NOVO)

**Tecnologias:**
- `python-socketio` (servidor Socket.IO)
- `fastapi` (opcional, para health checks)
- `pytorch` (para modelos ML futuros)
- `transformers` (para modelos NLP futuros)

**Estrutura do Servidor:**
```python
import socketio
from typing import Dict, Any

sio = socketio.AsyncServer(cors_allowed_origins="*")
app = socketio.ASGIApp(sio)

@sio.event
async def connect(sid, environ):
    """Cliente conectado"""
    print(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    """Cliente desconectado"""
    print(f"Client disconnected: {sid}")

@sio.event
async def transcription_chunk(sid, data: Dict[str, Any]):
    """Recebe chunk de transcrição do backend"""
    # Processar texto
    result = await process_transcription(data)
    # Retornar análise
    await sio.emit('text_analysis_result', result, room=sid)
```

**Eventos Socket.IO:**
- **Recebe:** `transcription_chunk` (do backend)
- **Envia:** `text_analysis_result` (para backend)
- **Health:** `ping` / `pong`

---

### 4. Análise de Texto (Placeholder)

**Arquivo:** `apps/text-analysis/src/services/analysis_service.py` (NOVO)

**Estrutura Inicial (Placeholder):**
```python
from typing import Dict, Any, List
import re

class TextAnalysisService:
    """Serviço de análise de texto (placeholder para implementação futura)"""
    
    async def analyze(self, text: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analisa texto e retorna resultados.
        
        Por enquanto, retorna estrutura básica.
        Futuro: análise de sentimento, emoções, tópicos, etc.
        """
        # Placeholder: análise básica
        word_count = len(text.split())
        char_count = len(text)
        has_question = '?' in text
        has_exclamation = '!' in text
        
        # Detecção básica de palavras-chave (exemplo)
        negative_words = ['não', 'problema', 'erro', 'falha']
        positive_words = ['sim', 'ótimo', 'bom', 'perfeito']
        
        negative_score = sum(1 for word in negative_words if word in text.lower())
        positive_score = sum(1 for word in positive_words if word in text.lower())
        
        return {
            'text': text,
            'metadata': metadata,
            'analysis': {
                'word_count': word_count,
                'char_count': char_count,
                'has_question': has_question,
                'has_exclamation': has_exclamation,
                'sentiment_score': {
                    'positive': positive_score,
                    'negative': negative_score,
                    'neutral': 1.0 - (positive_score + negative_score) / max(word_count, 1)
                },
                'emotions': {},  # Placeholder para emoções futuras
                'topics': [],    # Placeholder para tópicos futuros
                'keywords': self._extract_keywords(text)
            },
            'timestamp': metadata.get('timestamp'),
            'confidence': 0.5  # Placeholder
        }
    
    def _extract_keywords(self, text: str) -> List[str]:
        """Extrai palavras-chave básicas (placeholder)"""
        # Remove stopwords básicas
        stopwords = ['o', 'a', 'de', 'para', 'com', 'em', 'um', 'uma']
        words = re.findall(r'\b\w+\b', text.lower())
        keywords = [w for w in words if w not in stopwords and len(w) > 3]
        return list(set(keywords))[:10]  # Top 10 únicas
```

**Estrutura de Resposta:**
```python
{
    'meetingId': 'RM_123',
    'participantId': 'user_abc',
    'text': 'Texto original',
    'analysis': {
        'word_count': 10,
        'char_count': 50,
        'has_question': True,
        'has_exclamation': False,
        'sentiment_score': {
            'positive': 0.3,
            'negative': 0.1,
            'neutral': 0.6
        },
        'emotions': {},  # Futuro
        'topics': [],    # Futuro
        'keywords': ['palavra1', 'palavra2']
    },
    'timestamp': 1234567890,
    'confidence': 0.5
}
```

---

### 5. Integração no Backend (NestJS)

**Arquivo:** `apps/backend/src/pipeline/text-analysis.service.ts` (NOVO)

**Dependências Necessárias:**
```bash
cd apps/backend
pnpm add socket.io-client
pnpm add -D @types/socket.io-client
```

**Responsabilidades:**
- Conectar ao serviço Python via Socket.IO (cliente)
- Enviar transcrições agrupadas
- Receber análises
- Integrar resultados com pipeline A2E2

**Estrutura:**
```typescript
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface TranscriptionChunk {
  meetingId: string;
  participantId: string;
  text: string;
  timestamp: number;
  language?: string;
  confidence?: number;
}

export interface TextAnalysisResult {
  meetingId: string;
  participantId: string;
  text: string;
  analysis: {
    word_count: number;
    char_count: number;
    has_question: boolean;
    has_exclamation: boolean;
    sentiment_score: {
      positive: number;
      negative: number;
      neutral: number;
    };
    emotions: Record<string, number>;
    topics: string[];
    keywords: string[];
  };
  timestamp: number;
  confidence: number;
}

@Injectable()
export class TextAnalysisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TextAnalysisService.name);
  private socket: Socket | null = null;
  private readonly pythonServiceUrl: string;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  constructor(private readonly emitter: EventEmitter2) {
    // URL base (sem /socket.io/ - será adicionado automaticamente pelo socket.io-client)
    const baseUrl = process.env.TEXT_ANALYSIS_SERVICE_URL || 'http://localhost:8001';
    this.pythonServiceUrl = baseUrl;
    // Nota: socket.io-client automaticamente adiciona /socket.io/ ao conectar
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    this.logger.log(`Connecting to Python text analysis service: ${this.pythonServiceUrl}`);

    this.socket = io(this.pythonServiceUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      this.logger.log('✅ Connected to Python text analysis service');
      this.reconnectAttempts = 0;
    });

    this.socket.on('text_analysis_result', (data: TextAnalysisResult) => {
      this.logger.log(
        `Received text analysis result: ${data.meetingId}/${data.participantId}`,
      );
      // Emitir evento para integração com A2E2
      this.emitter.emit('text.analysis', data);
    });

    this.socket.on('error', (error: Error) => {
      this.logger.error(`Python service error: ${error.message}`);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.logger.warn(`Disconnected from Python service: ${reason}`);
    });

    this.socket.on('connect_error', (error: Error) => {
      this.reconnectAttempts++;
      this.logger.warn(
        `Failed to connect to Python service (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${error.message}`,
      );
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.logger.log('Disconnected from Python text analysis service');
    }
  }

  async sendTranscription(chunk: TranscriptionChunk): Promise<void> {
    if (!this.socket?.connected) {
      this.logger.warn('Python service not connected, skipping transcription');
      return;
    }

    try {
      this.socket.emit('transcription_chunk', {
        meetingId: chunk.meetingId,
        participantId: chunk.participantId,
        text: chunk.text,
        timestamp: chunk.timestamp,
        language: chunk.language,
        confidence: chunk.confidence,
      });
      this.logger.debug(
        `Sent transcription to Python: ${chunk.meetingId}/${chunk.participantId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send transcription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
```

**Módulo:**
```typescript
// apps/backend/src/pipeline/text-analysis.module.ts
import { Module } from '@nestjs/common';
import { TextAnalysisService } from './text-analysis.service';

@Module({
  providers: [TextAnalysisService],
  exports: [TextAnalysisService],
})
export class TextAnalysisModule {}
```

**Nota:** Este módulo deve ser importado no `AppModule` e o serviço deve implementar `OnModuleInit` para conectar automaticamente ao iniciar.

---

### 6. Integração com Pipeline A2E2

**Arquivo:** `apps/backend/src/feedback/feedback.aggregator.service.ts` (MODIFICAR)

**Modificações:**
- Adicionar listener para evento `text.analysis`
- Integrar resultados de texto com análise de áudio
- Combinar sinais de texto e áudio nas heurísticas

**Estrutura de Integração:**
```typescript
@OnEvent('text.analysis', { async: true })
handleTextAnalysis(evt: TextAnalysisResult): void {
  const key = this.key(evt.meetingId, evt.participantId);
  let state = this.byKey.get(key);
  
  // Criar estado se não existir (similar ao áudio)
  if (!state) {
    state = this.initState();
    this.byKey.set(key, state);
  }
  
  // Adicionar dados de texto ao estado
  state.textAnalysis = {
    sentiment: evt.analysis.sentiment_score,
    keywords: evt.analysis.keywords,
    hasQuestion: evt.analysis.has_question,
    lastUpdate: evt.timestamp,
  };
  
  // Criar contexto de detecção (reutilizar método existente)
  const now = evt.timestamp;
  const ctx = this.createDetectionContext(evt.meetingId, evt.participantId, now);
  
  // Re-executar pipeline A2E2 com dados combinados
  const feedback = runA2E2Pipeline(state, ctx);
  if (feedback) {
    this.delivery.publishToHosts(evt.meetingId, feedback);
  }
}

// Método auxiliar para criar contexto (já existe no código)
private createDetectionContext(
  meetingId: string,
  participantId: string,
  now: number,
): DetectionContext {
  // Reutilizar lógica existente de criação de contexto
  // (ver código em handleIngestion)
}
```

**Nota:** O tipo `TextAnalysisResult` vem de `TextAnalysisService`, não `TextAnalysisEvent`. O evento interno `text.analysis` usa o mesmo tipo.

**Tipos:**
```typescript
// apps/backend/src/pipeline/text-analysis.service.ts (já definido)
export interface TextAnalysisResult {
  meetingId: string;
  participantId: string;
  text: string;
  analysis: {
    word_count: number;
    char_count: number;
    has_question: boolean;
    has_exclamation: boolean;
    sentiment_score: {
      positive: number;
      negative: number;
      neutral: number;
    };
    emotions: Record<string, number>; // Futuro
    topics: string[]; // Futuro
    keywords: string[];
  };
  timestamp: number;
  confidence: number;
}

// apps/backend/src/feedback/a2e2/types.ts (MODIFICAR)
export type ParticipantState = {
  samples: Sample[];
  ema: {
    valence?: number;
    arousal?: number;
    rms?: number;
    emotions: Map<string, number>;
  };
  cooldownUntilByType: Map<string, number>;
  lastFeedbackAt?: number;
  // NOVO: Dados de análise de texto
  textAnalysis?: {
    sentiment: {
      positive: number;
      negative: number;
      neutral: number;
    };
    keywords: string[];
    hasQuestion: boolean;
    lastUpdate?: number;
  };
};
```

**Nota:** Não é necessário criar `TextAnalysisEvent` separado. O `TextAnalysisResult` do serviço é usado diretamente.

---

## 🐳 Docker e Containerização

### Dockerfile do Serviço Python

**Arquivo:** `apps/text-analysis/Dockerfile`

```dockerfile
FROM python:3.11-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Diretório de trabalho
WORKDIR /app

# Copiar requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY src/ ./src/
COPY scripts/ ./scripts/

# Variáveis de ambiente
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Expor porta
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Comando de inicialização
CMD ["python", "-m", "src.main"]
```

### requirements.txt

**Arquivo:** `apps/text-analysis/requirements.txt`

```txt
# Socket.IO
python-socketio[asyncio]==5.11.0
python-socketio[client]==5.11.0

# Web Framework (para health checks)
fastapi==0.109.0
uvicorn[standard]==0.27.0

# ML/NLP (futuro)
torch==2.1.2
transformers==4.37.2
sentencepiece==0.1.99

# Utilitários
pydantic==2.5.3
python-dotenv==1.0.0

# Logging
structlog==24.1.0

# Testing (dev)
pytest==7.4.4
pytest-asyncio==0.23.3
```

### docker-compose.yml

**Arquivo:** `apps/text-analysis/docker-compose.yml` (NOVO)

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
    volumes:
      - ./src:/app/src:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

**Nota:** O docker-compose.yml está na pasta do serviço Python (`apps/text-analysis/`), não no backend. O backend não utiliza Docker, então o serviço Python será acessível via `http://localhost:8001` quando rodando em Docker.

---

## ⚙️ Configurações e Variáveis de Ambiente

### Backend (.env)

**Adicionar ao `apps/backend/env`:**

```bash
# Text Analysis Service
# URL base do serviço Python (sem /socket.io/)
# Como o backend não está em Docker, usa localhost com a porta mapeada
TEXT_ANALYSIS_SERVICE_URL=http://localhost:8001
TEXT_ANALYSIS_ENABLED=true
TEXT_ANALYSIS_TIMEOUT_MS=5000
```

**Nota:** 
- O `TextAnalysisService` adiciona `/socket.io/` automaticamente à URL base.
- Como o backend não está em Docker, a URL usa `localhost:8001` (porta mapeada do host) ao invés de `text-analysis:8000` (nome do serviço Docker).

### Serviço Python (.env.example)

**Arquivo:** `apps/text-analysis/.env.example`

```bash
# Server
PORT=8000
HOST=0.0.0.0
LOG_LEVEL=INFO

# Socket.IO
SOCKETIO_CORS_ORIGINS=*
SOCKETIO_PING_TIMEOUT=60
SOCKETIO_PING_INTERVAL=25

# Analysis
ANALYSIS_BATCH_SIZE=1
ANALYSIS_TIMEOUT_MS=5000
ANALYSIS_CONFIDENCE_THRESHOLD=0.5

# ML Models (futuro)
MODEL_CACHE_DIR=/app/models
MODEL_DEVICE=cpu  # ou cuda se disponível
```

---

## 📡 Estrutura de Mensagens Socket.IO

### Backend → Python Service

**Evento:** `transcription_chunk`

```typescript
{
  meetingId: string;
  participantId: string;
  text: string;
  timestamp: number;
  language?: string;
  confidence?: number;
}
```

### Python Service → Backend

**Evento:** `text_analysis_result`

```python
{
    'meetingId': str,
    'participantId': str,
    'text': str,
    'analysis': {
        'word_count': int,
        'char_count': int,
        'has_question': bool,
        'has_exclamation': bool,
        'sentiment_score': {
            'positive': float,
            'negative': float,
            'neutral': float
        },
        'emotions': Dict[str, float],  # Futuro
        'topics': List[str],           # Futuro
        'keywords': List[str]
    },
    'timestamp': int,
    'confidence': float
}
```

### Health Check

**Evento:** `ping` / `pong`

```python
# Cliente envia
await sio.emit('ping', {'timestamp': time.time()})

# Servidor responde
@sio.event
async def ping(sid, data):
    await sio.emit('pong', {'timestamp': time.time()}, room=sid)
```

---

## 🔄 Fluxo Completo de Integração

### 1. Inicialização

```
1. Backend inicia
2. TextAnalysisService.connect() → Conecta ao Python
3. Python service inicia Socket.IO server
4. Conexão estabelecida
```

### 2. Processamento de Transcrição

```
1. Chrome Extension captura transcrição do Google Meet
2. Envia via WebSocket nativo → ws://backend:3001/egress-transcription?meetingId=X&participantId=Y
3. Backend recebe via TranscriptionEgressServer e valida
4. Backend envia imediatamente para Python (ou agrupa se necessário)
5. Backend → Python: socket.emit('transcription_chunk', data) via Socket.IO
6. Python processa texto (placeholder na Fase 3, análise real na Fase 8)
7. Python → Backend: sio.emit('text_analysis_result', result, room=sid) via Socket.IO
8. Backend recebe e emite evento interno 'text.analysis' via EventEmitter2
9. FeedbackAggregatorService.handleTextAnalysis() integra com A2E2
10. Pipeline A2E2 executa com dados combinados (áudio + texto)
11. Feedback gerado (se aplicável)
12. Backend → Extension: wsGateway.server.to('feedback:<meetingId>').emit('feedback', payload)
13. Extension (Socket.IO client) recebe e exibe feedback na UI
```

**Nota:** A extensão já tem Socket.IO client configurado para receber feedbacks (ver `feedback-overlay.js`).

---

## 🧪 Estratégia de Testes

### Serviço Python

**Arquivo:** `apps/text-analysis/tests/test_socketio.py`

```python
import pytest
import socketio
import asyncio

@pytest.mark.asyncio
async def test_transcription_chunk():
    """Testa recebimento e processamento de transcrição"""
    client = socketio.AsyncClient()
    await client.connect('http://localhost:8000')
    
    test_data = {
        'meetingId': 'test_123',
        'participantId': 'user_1',
        'text': 'Olá, como vocês estão?',
        'timestamp': 1234567890
    }
    
    result = await client.call('transcription_chunk', test_data)
    
    assert result['meetingId'] == 'test_123'
    assert 'analysis' in result
    assert result['analysis']['has_question'] == True
    
    await client.disconnect()
```

### Backend

**Arquivo:** `apps/backend/src/pipeline/text-analysis.service.spec.ts`

```typescript
describe('TextAnalysisService', () => {
  it('should connect to Python service', async () => {
    // Test connection
  });
  
  it('should send transcription chunks', async () => {
    // Test sending
  });
  
  it('should handle analysis results', async () => {
    // Test receiving
  });
});
```

---

## 📊 Monitoramento e Logging

### Serviço Python

- **Logging estruturado** com `structlog`
- **Métricas:** latência de processamento, taxa de sucesso
- **Health endpoint:** `GET /health`

### Backend

- **Logs:** conexão, envio, recebimento
- **Métricas:** latência, taxa de erro
- **Retry logic:** fila de retry para falhas

---

## 🚀 Fases de Implementação

### Fase 1: Infraestrutura Base (Sem Análise Real)
- [ ] Criar estrutura de pastas do serviço Python
- [x] Dockerfile e docker-compose (em `apps/text-analysis/`)
- [ ] Socket.IO server básico (ping/pong)
- [ ] Health check endpoint (FastAPI)
- [ ] Instalar `socket.io-client` no backend
- [ ] Criar TextAnalysisModule e TextAnalysisService
- [ ] Integração básica no backend (conexão automática via OnModuleInit)
- [ ] Testar conexão Backend ↔ Python Service

### Fase 2: Captura de Transcrição
- [ ] Script de captura na extensão Chrome (`transcription-capture.js`)
- [ ] Registrar script no `manifest.json`
- [ ] Endpoint WebSocket no backend (`/egress-transcription`)
- [ ] Registrar TranscriptionEgressServer no `main.ts`
- [ ] Integrar com TextAnalysisService
- [ ] Envio de transcrições para Python
- [ ] Recebimento e logging no Python
- [ ] Testar fluxo Extension → Backend → Python

### Fase 3: Análise Placeholder
- [ ] Implementar `TextAnalysisService` no Python (placeholder)
- [ ] Retornar estrutura básica de análise (word_count, sentiment básico, etc.)
- [ ] Integração no backend (receber resultados via Socket.IO)
- [ ] Emitir evento 'text.analysis' no EventEmitter
- [ ] Testes básicos de end-to-end

### Fase 4: Integração com A2E2
- [ ] Adicionar campo `textAnalysis` ao `ParticipantState` (types.ts)
- [ ] Adicionar listener `@OnEvent('text.analysis')` no FeedbackAggregatorService
- [ ] Atualizar estado com dados de texto
- [ ] Re-executar pipeline A2E2 após atualização de texto
- [ ] Combinar sinais de áudio e texto nas heurísticas (futuro - Fase 8)
- [ ] Testes de integração completos
- [ ] Verificar que feedbacks são gerados e entregues via Socket.IO

### Fase 5: Análise Real (Futuro)
- [ ] Implementar modelos ML (sentimento, emoções)
- [ ] Otimização de performance
- [ ] Cache de resultados
- [ ] Métricas avançadas

---

## 🔒 Segurança e Performance

### Segurança
- **Validação de entrada:** sanitizar texto recebido
- **Rate limiting:** limitar requisições por participante
- **Autenticação:** considerar tokens entre serviços (futuro)
- **CORS:** configurar adequadamente

### Performance
- **Batching:** agrupar múltiplas transcrições (se aplicável)
- **Async processing:** processamento assíncrono
- **Connection pooling:** reutilizar conexões Socket.IO
- **Caching:** cache de análises similares (futuro)

---

## 📝 Notas Importantes

1. **Não alterar código existente** nesta fase de planejamento
2. **Placeholder primeiro:** implementar análise básica antes de ML
3. **Compatibilidade:** manter compatibilidade com sistema existente
4. **Escalabilidade:** considerar múltiplas instâncias do serviço Python
5. **Fallback:** sistema deve funcionar mesmo se serviço Python estiver offline
6. **Socket.IO Client:** necessário instalar `socket.io-client` no backend
7. **Rede Docker:** todos os serviços devem estar na mesma rede (`live-meeting-network`)
8. **URL do Serviço:** usar URL base (sem `/socket.io/`) - o cliente adiciona automaticamente
9. **EventEmitter:** usar EventEmitter2 interno do NestJS para comunicação entre módulos
10. **ParticipantState:** adicionar campo opcional `textAnalysis` sem quebrar código existente

---

## 🎯 Próximos Passos

1. Revisar e aprovar este planejamento
2. Criar estrutura de pastas
3. Implementar Fase 1 (infraestrutura base)
4. Testar conexão básica
5. Iterar nas fases seguintes

---

---

## 🔍 Revisões e Melhorias

### Revisão 1.0 (2025-01-27)
- ✅ Corrigida URL do Socket.IO (adicionar /socket.io/ automaticamente)
- ✅ Adicionada nota sobre instalação de socket.io-client
- ✅ Corrigida estrutura de pastas (removidos arquivos desnecessários)
- ✅ Adicionada rede Docker para postgres
- ✅ Melhorada descrição do fluxo de dados
- ✅ Adicionados detalhes sobre OnModuleInit/OnModuleDestroy
- ✅ Corrigidos tipos (TextAnalysisResult vs TextAnalysisEvent)
- ✅ Adicionadas notas sobre integração com código existente

---

**Data de Criação:** 2025-01-27  
**Última Revisão:** 2025-01-27  
**Versão:** 1.1  
**Status:** Planejamento Revisado

