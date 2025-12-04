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

