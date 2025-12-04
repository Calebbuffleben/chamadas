# Passo a Passo: Implementação do Serviço de Análise de Texto

## 📋 Visão Geral

Este documento fornece um guia passo a passo para implementar o serviço Python de análise de texto, seguindo a ordem lógica de dependências. A análise real de texto será implementada por último.

---

## 🎯 Ordem de Implementação

1. ✅ **Fase 1:** Infraestrutura Base do Serviço Python
2. ✅ **Fase 2:** Docker e Containerização
3. ✅ **Fase 3:** Captura de Transcrição (Chrome Extension)
4. ✅ **Fase 4:** Backend - Recepção de Transcrições
5. ✅ **Fase 5:** Backend - Integração com Serviço Python
6. ✅ **Fase 6:** Serviço Python - Socket.IO Server Básico
7. ✅ **Fase 7:** Integração Completa (Teste End-to-End)
8. ⏳ **Fase 8:** Análise Real de Texto (Deixar para depois)

---

## 📦 FASE 1: Infraestrutura Base do Serviço Python

### Passo 1.1: Criar Estrutura de Pastas

```bash
# Na raiz do projeto
mkdir -p apps/text-analysis/src/services
mkdir -p apps/text-analysis/src/models
mkdir -p apps/text-analysis/src/types
mkdir -p apps/text-analysis/tests
mkdir -p apps/text-analysis/scripts
```

### Passo 1.2: Criar Arquivos Base

**Criar:** `apps/text-analysis/src/__init__.py`
```python
# Empty file
```

**Criar:** `apps/text-analysis/src/services/__init__.py`
```python
# Empty file
```

**Criar:** `apps/text-analysis/src/models/__init__.py`
```python
# Empty file
```

**Criar:** `apps/text-analysis/src/types/__init__.py`
```python
# Empty file
```

**Criar:** `apps/text-analysis/tests/__init__.py`
```python
# Empty file
```

### Passo 1.3: Criar requirements.txt

**Criar:** `apps/text-analysis/requirements.txt`
```txt
# Socket.IO
python-socketio[asyncio]==5.11.0

# Web Framework (para health checks)
fastapi==0.109.0
uvicorn[standard]==0.27.0

# Utilitários
pydantic==2.5.3
python-dotenv==1.0.0

# Logging
structlog==24.1.0

# HTTP Client (para health checks)
httpx==0.26.0

# Testing (dev)
pytest==7.4.4
pytest-asyncio==0.23.3
```

**Nota:** PyTorch e transformers serão adicionados na Fase 8 (análise real).

### Passo 1.4: Criar .env.example

**Criar:** `apps/text-analysis/.env.example`
```bash
# Server
PORT=8000
HOST=0.0.0.0
LOG_LEVEL=INFO

# Socket.IO
SOCKETIO_CORS_ORIGINS=*

# Analysis
ANALYSIS_TIMEOUT_MS=5000
```

### Passo 1.5: Criar README.md Básico

**Criar:** `apps/text-analysis/README.md`
```markdown
# Text Analysis Service

Serviço Python para análise de transcrições em tempo real.

## Setup

```bash
pip install -r requirements.txt
```

## Executar

```bash
python -m src.main
```

## Health Check

```bash
curl http://localhost:8000/health
```
```

---

## 🐳 FASE 2: Docker e Containerização

### Passo 2.1: Criar Dockerfile

**Criar:** `apps/text-analysis/Dockerfile`
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

### Passo 2.2: Criar docker-compose.yml

**Criar:** `apps/text-analysis/docker-compose.yml`

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

### Passo 2.3: Testar Build do Docker

```bash
cd apps/text-analysis
docker build -t text-analysis:test .
```

**Verificar:** Build deve completar sem erros.

---

## 🐍 FASE 3: Serviço Python - Estrutura Básica

### Passo 3.1: Criar config.py

**Criar:** `apps/text-analysis/src/config.py`
```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configurações do serviço"""
    
    # Server
    PORT = int(os.getenv('PORT', '8000'))
    HOST = os.getenv('HOST', '0.0.0.0')
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    
    # Socket.IO
    SOCKETIO_CORS_ORIGINS = os.getenv('SOCKETIO_CORS_ORIGINS', '*').split(',')
    
    # Analysis
    ANALYSIS_TIMEOUT_MS = int(os.getenv('ANALYSIS_TIMEOUT_MS', '5000'))
```

### Passo 3.2: Criar types/messages.py

**Criar:** `apps/text-analysis/src/types/messages.py`
```python
from typing import Optional, Dict, Any
from pydantic import BaseModel

class TranscriptionChunk(BaseModel):
    """Mensagem recebida do backend"""
    meetingId: str
    participantId: str
    text: str
    timestamp: int
    language: Optional[str] = None
    confidence: Optional[float] = None

class TextAnalysisResult(BaseModel):
    """Mensagem enviada para o backend"""
    meetingId: str
    participantId: str
    text: str
    analysis: Dict[str, Any]
    timestamp: int
    confidence: float
```

### Passo 3.3: Criar services/analysis_service.py (Placeholder)

**Criar:** `apps/text-analysis/src/services/analysis_service.py`
```python
from typing import Dict, Any
from ..types.messages import TranscriptionChunk

class TextAnalysisService:
    """Serviço de análise de texto (placeholder)"""
    
    async def analyze(self, chunk: TranscriptionChunk) -> Dict[str, Any]:
        """
        Analisa texto e retorna resultados.
        
        Por enquanto, retorna estrutura básica.
        Análise real será implementada na Fase 8.
        """
        # Placeholder: análise básica
        word_count = len(chunk.text.split())
        char_count = len(chunk.text)
        has_question = '?' in chunk.text
        has_exclamation = '!' in chunk.text
        
        return {
            'word_count': word_count,
            'char_count': char_count,
            'has_question': has_question,
            'has_exclamation': has_exclamation,
            'sentiment_score': {
                'positive': 0.0,
                'negative': 0.0,
                'neutral': 1.0
            },
            'emotions': {},
            'topics': [],
            'keywords': []
        }
```

### Passo 3.4: Criar socketio_server.py

**Criar:** `apps/text-analysis/src/socketio_server.py`
```python
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
    async_mode='asgi'
)

# Criar app ASGI
app = socketio.ASGIApp(sio)

# Instanciar serviço de análise
analysis_service = TextAnalysisService()

@sio.event
async def connect(sid, environ):
    """Cliente conectado"""
    logger.info("Client connected", client_id=sid)

@sio.event
async def disconnect(sid):
    """Cliente desconectado"""
    logger.info("Client disconnected", client_id=sid)

@sio.event
async def transcription_chunk(sid, data: Dict[str, Any]):
    """Recebe chunk de transcrição do backend"""
    try:
        logger.info("Received transcription chunk", client_id=sid, data=data)
        
        # Validar e parsear dados
        chunk = TranscriptionChunk(**data)
        
        # Processar texto (placeholder)
        analysis_result = await analysis_service.analyze(chunk)
        
        # Criar resposta
        result = TextAnalysisResult(
            meetingId=chunk.meetingId,
            participantId=chunk.participantId,
            text=chunk.text,
            analysis=analysis_result,
            timestamp=chunk.timestamp,
            confidence=0.5  # Placeholder
        )
        
        # Enviar resultado de volta
        await sio.emit('text_analysis_result', result.dict(), room=sid)
        
        logger.info("Sent analysis result", client_id=sid, result=result.dict())
        
    except Exception as e:
        logger.error("Error processing transcription", error=str(e), client_id=sid)
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def ping(sid, data: Dict[str, Any]):
    """Health check ping"""
    await sio.emit('pong', {'timestamp': data.get('timestamp')}, room=sid)
```

### Passo 3.5: Criar main.py

**Criar:** `apps/text-analysis/src/main.py`
```python
import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from .config import Config
from .socketio_server import app as socketio_app

# Criar app FastAPI para health check
fastapi_app = FastAPI()

@fastapi_app.get("/health")
async def health():
    """Health check endpoint"""
    return JSONResponse({"status": "ok", "service": "text-analysis"})

# Montar Socket.IO app no FastAPI
fastapi_app.mount("/socket.io/", socketio_app)

if __name__ == "__main__":
    uvicorn.run(
        fastapi_app,
        host=Config.HOST,
        port=Config.PORT,
        log_level=Config.LOG_LEVEL.lower()
    )
```

### Passo 3.6: Testar Serviço Python Localmente

```bash
cd apps/text-analysis
pip install -r requirements.txt
python -m src.main
```

**Verificar:**
- Servidor inicia na porta 8000
- Health check: `curl http://localhost:8000/health` retorna `{"status": "ok"}`

---

## 🔌 FASE 4: Backend - Integração com Serviço Python

### Passo 4.1: Instalar Dependências Socket.IO Client

**Verificar:** `apps/backend/package.json` já tem `socket.io-client`?

Se não tiver, adicionar:
```bash
cd apps/backend
pnpm add socket.io-client
```

### Passo 4.2: Criar TextAnalysisModule

**Criar:** `apps/backend/src/pipeline/text-analysis.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { TextAnalysisService } from './text-analysis.service';

@Module({
  providers: [TextAnalysisService],
  exports: [TextAnalysisService],
})
export class TextAnalysisModule {}
```

### Passo 4.3: Criar TextAnalysisService

**Criar:** `apps/backend/src/pipeline/text-analysis.service.ts`
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
    this.pythonServiceUrl =
      process.env.TEXT_ANALYSIS_SERVICE_URL || 'http://localhost:8001';
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

### Passo 4.4: Adicionar Variáveis de Ambiente

**Modificar:** `apps/backend/env`

Adicionar:
```bash
# Text Analysis Service
# Como o backend não está em Docker, usa localhost com a porta mapeada
TEXT_ANALYSIS_SERVICE_URL=http://localhost:8001
TEXT_ANALYSIS_ENABLED=true
TEXT_ANALYSIS_TIMEOUT_MS=5000
```

**Nota:** O backend não está em Docker, então a URL usa `localhost:8001` (porta mapeada do host) ao invés de `text-analysis:8000` (nome do serviço Docker).

### Passo 4.5: Registrar Módulo no AppModule

**Modificar:** `apps/backend/src/app.module.ts`

Adicionar `TextAnalysisModule` aos imports:
```typescript
import { TextAnalysisModule } from './pipeline/text-analysis.module';

@Module({
  imports: [
    // ... outros imports
    TextAnalysisModule,
  ],
  // ...
})
```

### Passo 4.6: Testar Conexão Backend → Python

```bash
# Iniciar serviço Python
cd apps/text-analysis
python -m src.main

# Em outro terminal, iniciar backend
cd apps/backend
pnpm start:dev
```

**Verificar logs:**
- Backend deve conectar ao Python service
- Log: `✅ Connected to Python text analysis service`

---

## 📝 FASE 5: Backend - Recepção de Transcrições

### Passo 5.1: Criar TranscriptionEgressServer

**Criar:** `apps/backend/src/egress/transcription-egress.server.ts`
```typescript
import { HttpServer } from '@nestjs/common';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { TextAnalysisService } from '../pipeline/text-analysis.service';
import { Logger } from '@nestjs/common';

const log = new Logger('TranscriptionEgress');

export interface TranscriptionEgressWsOptions {
  path?: string;
}

export function setupTranscriptionEgressWsServer(
  httpServer: HttpServer,
  opts?: TranscriptionEgressWsOptions,
  textAnalysisService?: TextAnalysisService,
): void {
  const options: Required<TranscriptionEgressWsOptions> = {
    path: opts?.path ?? '/egress-transcription',
  };

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request: IncomingMessage, socket, head: Buffer) => {
    try {
      const url = request.url ?? '';
      if (!url.startsWith(options.path)) {
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      log.error(`Upgrade error: ${(err as Error).message}`);
      socket.destroy();
    }
  });

  function parseUrlParams(req: IncomingMessage): URLSearchParams {
    const url = req.url ?? '';
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    return new URLSearchParams(queryString);
  }

  function sanitize(value: string | null, name: string): string {
    if (!value) return '';
    return value.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const params = parseUrlParams(req);
    const meetingId = sanitize(params.get('meetingId') ?? '', 'meetingId');
    const participantId = sanitize(params.get('participantId') ?? '', 'participantId');
    const language = params.get('language') ?? 'pt-BR';

    if (!meetingId || !participantId) {
      log.warn('Missing meetingId or participantId, closing connection');
      ws.close(1008, 'Missing required parameters');
      return;
    }

    const id = `${meetingId}/${participantId}`;
    log.log(`Transcription egress connected: ${id}`);

    ws.on('message', async (data: Buffer | string) => {
      try {
        // Espera JSON com transcrição
        const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
        const payload = JSON.parse(text) as {
          text: string;
          timestamp?: number;
          confidence?: number;
        };

        if (!payload.text || typeof payload.text !== 'string') {
          log.warn(`Invalid transcription payload from ${id}`);
          return;
        }

        const chunk = {
          meetingId,
          participantId,
          text: payload.text,
          timestamp: payload.timestamp ?? Date.now(),
          language,
          confidence: payload.confidence,
        };

        log.debug(`Received transcription: ${id} - "${payload.text.substring(0, 50)}..."`);

        // Enviar para serviço Python
        if (textAnalysisService) {
          await textAnalysisService.sendTranscription(chunk);
        } else {
          log.warn('TextAnalysisService not available');
        }
      } catch (error) {
        log.error(
          `Error processing transcription from ${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    ws.on('close', () => {
      log.log(`Transcription egress disconnected: ${id}`);
    });

    ws.on('error', (error: Error) => {
      log.error(`Transcription egress error for ${id}: ${error.message}`);
    });
  });

  log.log(`Transcription egress WebSocket server listening on ${options.path}`);
}
```

### Passo 5.2: Registrar no main.ts

**Modificar:** `apps/backend/src/main.ts`

Adicionar após setup do audio egress:
```typescript
import { setupTranscriptionEgressWsServer } from './egress/transcription-egress.server';
import { TextAnalysisService } from './pipeline/text-analysis.service';

// ... no bootstrap()

// Setup transcription egress
const textAnalysisService = app.get(TextAnalysisService);
setupTranscriptionEgressWsServer(httpServer, undefined, textAnalysisService);
```

### Passo 5.3: Testar Recepção de Transcrições

**Teste manual com curl:**
```bash
# Conectar via WebSocket (usar wscat ou similar)
# wscat -c "ws://localhost:3001/egress-transcription?meetingId=test_123&participantId=user_1"

# Enviar mensagem JSON:
{"text": "Olá, como vocês estão?", "timestamp": 1234567890}
```

**Verificar logs:**
- Backend recebe transcrição
- Backend envia para Python service
- Python service processa e retorna

---

## 🌐 FASE 6: Chrome Extension - Captura de Transcrição

### Passo 6.1: Criar Script de Captura

**Criar:** `apps/chrome-extension/transcription-capture.js`
```javascript
// Script para capturar transcrições do Google Meet
(function () {
	const DEFAULT_WS_URL = 'ws://localhost:3001/egress-transcription';
	const POLL_INTERVAL_MS = 1000; // Verificar a cada 1 segundo

	let ws = null;
	let meetingId = null;
	let participantId = null;
	let lastTranscription = '';
	let wsUrl = null;

	function getMeetingId() {
		// Tentar extrair meeting ID da URL
		const url = window.location.href;
		const match = url.match(/\/meet\/([a-z-]+)/i);
		return match ? match[1] : `meet_${Date.now()}`;
	}

	function getParticipantId() {
		// Tentar extrair participant ID do DOM ou gerar
		// Por enquanto, gerar ID único
		if (!window.__meetParticipantId) {
			window.__meetParticipantId = `user_${Math.random().toString(36).substr(2, 9)}`;
		}
		return window.__meetParticipantId;
	}

	function findTranscriptionElement() {
		// Procurar elemento de transcrição no Google Meet
		// O Google Meet pode ter diferentes seletores
		const selectors = [
			'[data-transcription-text]',
			'[jsname="YbUplb"]', // Possível seletor do Meet
			'.transcription-text',
			'[aria-live="polite"]',
		];

		for (const selector of selectors) {
			const element = document.querySelector(selector);
			if (element && element.textContent.trim()) {
				return element;
			}
		}

		// Fallback: procurar por elementos com texto que muda frequentemente
		const allElements = document.querySelectorAll('[aria-live], [role="log"]');
		for (const el of allElements) {
			if (el.textContent.trim().length > 10) {
				return el;
			}
		}

		return null;
	}

	function openWebSocket() {
		if (ws && ws.readyState === WebSocket.OPEN) {
			return;
		}

		meetingId = getMeetingId();
		participantId = getParticipantId();
		wsUrl = `${DEFAULT_WS_URL}?meetingId=${encodeURIComponent(meetingId)}&participantId=${encodeURIComponent(participantId)}&language=pt-BR`;

		console.log('[transcription-capture] Opening WebSocket:', wsUrl);

		ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			console.log('[transcription-capture] WebSocket connected');
		};

		ws.onerror = (error) => {
			console.error('[transcription-capture] WebSocket error:', error);
		};

		ws.onclose = () => {
			console.log('[transcription-capture] WebSocket closed, reconnecting...');
			setTimeout(openWebSocket, 2000);
		};
	}

	function sendTranscription(text) {
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return;
		}

		if (text === lastTranscription) {
			return; // Evitar duplicatas
		}

		lastTranscription = text;

		const payload = {
			text: text.trim(),
			timestamp: Date.now(),
			confidence: 0.9, // Placeholder
		};

		try {
			ws.send(JSON.stringify(payload));
			console.log('[transcription-capture] Sent:', text.substring(0, 50));
		} catch (error) {
			console.error('[transcription-capture] Send error:', error);
		}
	}

	function startPolling() {
		openWebSocket();

		setInterval(() => {
			const element = findTranscriptionElement();
			if (element) {
				const text = element.textContent.trim();
				if (text && text.length > 5) {
					sendTranscription(text);
				}
			}
		}, POLL_INTERVAL_MS);
	}

	// Iniciar quando DOM estiver pronto
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', startPolling);
	} else {
		startPolling();
	}

	console.log('[transcription-capture] Script loaded');
})();
```

### Passo 6.2: Registrar Script no Manifest

**Modificar:** `apps/chrome-extension/manifest.json`

Adicionar `transcription-capture.js` aos content scripts:
```json
{
  "content_scripts": [
    {
      "matches": ["https://meet.google.com/*"],
      "js": [
        "content.js",
        "transcription-capture.js"
      ],
      "run_at": "document_idle"
    }
  ]
}
```

### Passo 6.3: Testar Captura de Transcrição

1. Carregar extensão no Chrome
2. Abrir Google Meet
3. Ativar transcrição (se disponível)
4. Verificar console do navegador para logs
5. Verificar logs do backend e Python service

---

## 🔗 FASE 7: Integração com Pipeline A2E2

### Passo 7.1: Adicionar Tipos de Texto

**Modificar:** `apps/backend/src/feedback/feedback.types.ts`

Adicionar:
```typescript
export interface TextAnalysisEvent {
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
```

### Passo 7.2: Modificar ParticipantState

**Modificar:** `apps/backend/src/feedback/a2e2/types.ts`

Adicionar campo opcional:
```typescript
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

### Passo 7.3: Adicionar Listener no FeedbackAggregatorService

**Modificar:** `apps/backend/src/feedback/feedback.aggregator.service.ts`

Adicionar método:
```typescript
import { TextAnalysisResult } from '../pipeline/text-analysis.service';

@OnEvent('text.analysis', { async: true })
handleTextAnalysis(evt: TextAnalysisResult): void {
  const key = this.key(evt.meetingId, evt.participantId);
  const state = this.byKey.get(key);
  
  if (!state) {
    this.logger.warn(`No state found for ${key}, creating new state`);
    const newState = this.initState();
    this.byKey.set(key, newState);
    this.updateStateWithTextAnalysis(newState, evt);
    return;
  }
  
  this.updateStateWithTextAnalysis(state, evt);
  
  // Re-executar pipeline A2E2 com dados combinados
  const now = Date.now();
  const ctx = this.createDetectionContext(evt.meetingId, evt.participantId, now);
  const feedback = runA2E2Pipeline(state, ctx);
  
  if (feedback) {
    this.delivery.publishToHosts(evt.meetingId, feedback);
  }
}

private updateStateWithTextAnalysis(
  state: ParticipantState,
  evt: TextAnalysisResult,
): void {
  state.textAnalysis = {
    sentiment: evt.analysis.sentiment_score,
    keywords: evt.analysis.keywords,
    hasQuestion: evt.analysis.has_question,
    lastUpdate: evt.timestamp,
  };
  
  this.logger.debug(
    `Updated text analysis for ${evt.meetingId}/${evt.participantId}`,
    {
      sentiment: evt.analysis.sentiment_score,
      keywords: evt.analysis.keywords.slice(0, 5),
    },
  );
}
```

**Nota:** O método `createDetectionContext` já existe, apenas reutilizar.

### Passo 7.4: Testar Integração Completa

1. Iniciar todos os serviços:
   ```bash
   # Terminal 1: Python service
   cd apps/text-analysis && python -m src.main
   
   # Terminal 2: Backend
   cd apps/backend && pnpm start:dev
   
   # Terminal 3: Docker (PostgreSQL)
   cd apps/backend && docker-compose up
   ```

2. Carregar extensão Chrome
3. Abrir Google Meet com transcrição
4. Verificar fluxo completo:
   - Transcrição capturada → Backend recebe → Python processa → Backend integra → Feedback gerado

---

## ✅ FASE 8: Análise Real de Texto (Deixar para Depois)

### Quando Implementar

Esta fase será implementada após todas as outras estarem funcionando e testadas.

### Planejamento Detalhado

**📄 Ver documento completo:** `PLANEJAMENTO_FASE8_ANALISE_TEXTO.md`

Este documento contém:
- Análise detalhada da fase
- Planejamento passo-a-passo completo (7 sub-fases)
- Código de exemplo para cada componente
- Considerações de performance e recursos
- Critérios de sucesso

### Resumo do que será Implementado

1. **Modelos ML:**
   - Análise de sentimento (BERT em português)
   - Detecção de emoções em texto
   - Extração de palavras-chave avançada
   - Extração de tópicos (futuro)

2. **Otimizações:**
   - Cache de resultados (TTL cache)
   - Lazy loading de modelos
   - Processamento assíncrono
   - Batching de transcrições (futuro)

3. **Métricas:**
   - Latência de processamento
   - Taxa de sucesso/erro
   - Uso de recursos
   - Endpoint `/metrics`

### Arquivos que Serão Modificados/Criados

- `apps/text-analysis/src/services/analysis_service.py` - Implementar análise real
- `apps/text-analysis/src/models/sentiment.py` - Analisador de sentimento
- `apps/text-analysis/src/models/emotion.py` - Detector de emoções
- `apps/text-analysis/src/models/keywords.py` - Extrator de palavras-chave
- `apps/text-analysis/src/services/cache_service.py` - Cache de resultados
- `apps/text-analysis/src/services/metrics_service.py` - Métricas de performance
- `apps/text-analysis/requirements.txt` - Adicionar PyTorch, transformers
- `apps/text-analysis/Dockerfile` - Otimizar para ML
- `apps/text-analysis/docker-compose.yml` - Volume para cache de modelos

---

## 🧪 Checklist de Testes

### Testes Unitários

- [ ] Serviço Python: análise placeholder
- [ ] Backend: conexão Socket.IO
- [ ] Backend: envio de transcrições

### Testes de Integração

- [ ] Backend ↔ Python Service (Socket.IO)
- [ ] Extension → Backend (WebSocket)
- [ ] Fluxo completo end-to-end

### Testes de Performance

- [ ] Latência de processamento
- [ ] Throughput de transcrições
- [ ] Uso de memória/CPU

---

## 🐛 Troubleshooting

### Python Service não conecta

- Verificar URL: `TEXT_ANALYSIS_SERVICE_URL`
- Verificar logs do Python service
- Verificar rede Docker (se usando containers)

### Transcrições não chegam

- Verificar WebSocket no backend
- Verificar console do Chrome
- Verificar se Google Meet tem transcrição ativa

### Análise não retorna

- Verificar logs do Python service
- Verificar evento `text.analysis` no backend
- Verificar integração com A2E2

---

## 📝 Notas Finais

1. **Ordem Importante:** Seguir a ordem das fases
2. **Testar Cada Fase:** Não avançar sem testar a fase anterior
3. **Logs:** Usar logs extensivamente para debug
4. **Análise Real:** Deixar para última fase (Fase 8)

---

**Data de Criação:** 2025-01-27  
**Versão:** 1.0  
**Status:** Guia de Implementação

