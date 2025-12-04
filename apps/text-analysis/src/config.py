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
    
    # ML Models
    MODEL_CACHE_DIR = os.getenv('MODEL_CACHE_DIR', '/app/models/.cache')
    MODEL_DEVICE = os.getenv('MODEL_DEVICE', 'cpu')
    SENTIMENT_MODEL = os.getenv('SENTIMENT_MODEL', 'neuralmind/bert-base-portuguese-cased')
    EMOTION_MODEL = os.getenv('EMOTION_MODEL', 'cardiffnlp/twitter-roberta-base-emotion')
    ENABLE_ML_ANALYSIS = os.getenv('ENABLE_ML_ANALYSIS', 'true').lower() == 'true'
    
    # Performance
    ANALYSIS_BATCH_SIZE = int(os.getenv('ANALYSIS_BATCH_SIZE', '1'))
    ANALYSIS_MAX_LENGTH = int(os.getenv('ANALYSIS_MAX_LENGTH', '512'))

