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

