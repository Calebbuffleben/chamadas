import uvicorn
import structlog
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from .config import Config
from .socketio_server import app as socketio_app

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

