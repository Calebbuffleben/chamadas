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

