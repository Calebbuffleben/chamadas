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

