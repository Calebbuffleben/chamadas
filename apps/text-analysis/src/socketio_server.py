"""
Servidor Socket.IO para comunicação em tempo real com backend NestJS.
Recebe chunks de transcrição e retorna resultados de análise.
"""

import socketio
import structlog
import base64
from typing import Dict, Any
from .config import Config
from .types.messages import TranscriptionChunk, TextAnalysisResult, AudioChunk
from .services.analysis_service import TextAnalysisService
from .services.transcription_service import TranscriptionService

logger = structlog.get_logger()

# Criar servidor Socket.IO
sio = socketio.AsyncServer(
    cors_allowed_origins=Config.SOCKETIO_CORS_ORIGINS,
    async_mode='asgi',
    logger=False,  # Usar structlog ao invés do logger padrão
    engineio_logger=False
)

# DIAGNÓSTICO: Registrar handler genérico para capturar todos os eventos
@sio.on('*')
async def catch_all(event, sid, data):
    """Handler genérico para capturar todos os eventos Socket.IO"""
    logger.critical(
        "🔴 [DIAGNÓSTICO] Evento Socket.IO capturado",
        event=event,
        client_id=sid,
        data_type=type(data).__name__,
        data_keys=list(data.keys()) if isinstance(data, dict) else 'not_dict'
    )
    print(f"[DIAGNÓSTICO] Evento genérico: {event}, sid={sid}, data={type(data)}")

# Criar app ASGI
app = socketio.ASGIApp(sio)

# Instanciar serviços (singletons)
logger.info("🔄 [SOCKET.IO] Inicializando serviços...")
analysis_service = TextAnalysisService()
transcription_service = TranscriptionService()
logger.info("✅ [SOCKET.IO] Serviços inicializados, Socket.IO server pronto")


@sio.event
async def connect(sid, environ):
    """
    Handler para conexão de cliente.
    
    Args:
        sid: Session ID do cliente
        environ: Informações do ambiente WSGI
    """
    # DIAGNÓSTICO: Log imediato
    print(f"[DIAGNÓSTICO] connect chamado! sid={sid}")
    logger.critical(
        "🔴 [DIAGNÓSTICO] Handler connect INICIADO",
        client_id=sid,
        remote_addr=environ.get('REMOTE_ADDR', 'unknown')
    )
    
    logger.info(
        "🔌 [CONEXÃO] Cliente conectado",
        client_id=sid,
        remote_addr=environ.get('REMOTE_ADDR', 'unknown')
    )
    
    print(f"[DIAGNÓSTICO] Após logger.info de conexão")


@sio.event
async def disconnect(sid):
    """
    Handler para desconexão de cliente.
    
    Args:
        sid: Session ID do cliente
    """
    logger.info(
        "🔌 [CONEXÃO] Cliente desconectado",
        client_id=sid
    )


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
    # DIAGNÓSTICO: Log imediato no início do handler
    print(f"[DIAGNÓSTICO] transcription_chunk chamado! sid={sid}, data_keys={list(data.keys()) if data else 'None'}")
    logger.critical(
        "🔴 [DIAGNÓSTICO] Handler transcription_chunk INICIADO",
        client_id=sid,
        data_type=type(data).__name__,
        data_keys=list(data.keys()) if isinstance(data, dict) else 'not_dict',
        has_meeting_id='meetingId' in data if isinstance(data, dict) else False
    )
    
    try:
        meeting_id = data.get('meetingId')
        participant_id = data.get('participantId')
        text_preview = data.get('text', '')[:50] if data.get('text') else ''
        text_length = len(data.get('text', ''))
        
        # DIAGNÓSTICO: Log antes do logger.info principal
        print(f"[DIAGNÓSTICO] Antes do logger.info - meeting_id={meeting_id}, text_length={text_length}")
        
        logger.info(
            "📥 [FLUXO] Recebido chunk de transcrição",
            client_id=sid,
            meeting_id=meeting_id,
            participant_id=participant_id,
            text_length=text_length,
            text_preview=text_preview,
            timestamp=data.get('timestamp')
        )
        
        # DIAGNÓSTICO: Log após o logger.info principal
        print(f"[DIAGNÓSTICO] Após logger.info - log deveria ter sido emitido")
        
        # Validar e parsear dados com Pydantic
        logger.debug(
            "🔍 [FLUXO] Validando dados com Pydantic",
            client_id=sid,
            meeting_id=meeting_id
        )
        chunk = TranscriptionChunk(**data)
        
        # Processar texto com BERT
        logger.info(
            "⚙️ [FLUXO] Iniciando análise de texto",
            client_id=sid,
            meeting_id=meeting_id,
            participant_id=participant_id,
            text_length=len(chunk.text)
        )
        analysis_result = await analysis_service.analyze(chunk)
        
        logger.debug(
            "✅ [FLUXO] Análise concluída, criando resposta",
            client_id=sid,
            meeting_id=meeting_id,
            intent=analysis_result.get('intent'),
            sentiment=analysis_result.get('sentiment')
        )
        
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
        # Pydantic v2.5.3 usa model_dump() ao invés de dict()
        result_dict = result.model_dump()
        await sio.emit('text_analysis_result', result_dict, room=sid)
        
        logger.info(
            "📤 [FLUXO] Resultado de análise enviado",
            client_id=sid,
            meeting_id=chunk.meetingId,
            participant_id=chunk.participantId,
            intent=analysis_result.get('intent'),
            intent_confidence=analysis_result.get('intent_confidence'),
            topic=analysis_result.get('topic'),
            topic_confidence=analysis_result.get('topic_confidence'),
            speech_act=analysis_result.get('speech_act'),
            sentiment=analysis_result.get('sentiment'),
            sentiment_score=analysis_result.get('sentiment_score'),
            urgency=analysis_result.get('urgency'),
            keywords_count=len(analysis_result.get('keywords', [])),
            entities_count=len(analysis_result.get('entities', [])),
            embedding_dim=len(analysis_result.get('embedding', []))
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
async def audio_chunk(sid, data: Dict[str, Any]):
    """
    Handler para chunks de áudio: transcreve áudio e analisa texto.
    
    Fluxo:
    1. Recebe chunk de áudio WAV
    2. Transcreve áudio para texto usando Whisper
    3. Se houver texto transcrito, analisa com BERT
    4. Retorna resultado de análise
    
    Args:
        sid: Session ID do cliente
        data: Dados do chunk de áudio:
            {
                'meetingId': str,
                'participantId': str,
                'track': str,
                'audioData': str (base64) ou bytes,
                'sampleRate': int,
                'channels': int,
                'timestamp': int,
                'language': str (opcional)
            }
    """
    # DIAGNÓSTICO: Log imediato no início do handler
    print(f"[DIAGNÓSTICO] audio_chunk chamado! sid={sid}, data_keys={list(data.keys()) if data else 'None'}")
    logger.critical(
        "🔴 [DIAGNÓSTICO] Handler audio_chunk INICIADO",
        client_id=sid,
        data_type=type(data).__name__,
        data_keys=list(data.keys()) if isinstance(data, dict) else 'not_dict',
        has_meeting_id='meetingId' in data if isinstance(data, dict) else False
    )
    
    try:
        meeting_id = data.get('meetingId')
        participant_id = data.get('participantId')
        sample_rate = data.get('sampleRate', 16000)
        channels = data.get('channels', 1)
        audio_data = data.get('audioData')
        
        # Calcular tamanho do áudio
        if isinstance(audio_data, str):
            audio_size_bytes = len(audio_data)
        elif isinstance(audio_data, bytes):
            audio_size_bytes = len(audio_data)
        else:
            audio_size_bytes = 0
        
        logger.info(
            "🎤 [FLUXO] Recebido chunk de áudio",
            client_id=sid,
            meeting_id=meeting_id,
            participant_id=participant_id,
            audio_size_bytes=audio_size_bytes,
            sample_rate=sample_rate,
            channels=channels,
            timestamp=data.get('timestamp')
        )
        
        # Decodificar dados de áudio
        logger.debug(
            "🔍 [FLUXO] Decodificando dados de áudio",
            client_id=sid,
            meeting_id=meeting_id,
            audio_data_type=type(audio_data).__name__
        )
        
        if isinstance(audio_data, str):
            # Se for string, assumir base64
            audio_bytes = base64.b64decode(audio_data)
        elif isinstance(audio_data, bytes):
            audio_bytes = audio_data
        else:
            raise ValueError("audioData must be base64 string or bytes")
        
        logger.debug(
            "✅ [FLUXO] Áudio decodificado",
            client_id=sid,
            meeting_id=meeting_id,
            decoded_size_bytes=len(audio_bytes)
        )
        
        # Transcrever áudio para texto
        logger.info(
            "🎙️ [FLUXO] Iniciando transcrição de áudio com Whisper",
            client_id=sid,
            meeting_id=meeting_id,
            audio_size_bytes=len(audio_bytes),
            sample_rate=sample_rate,
            language=data.get('language', Config.WHISPER_LANGUAGE)
        )
        
        transcription_result = await transcription_service.transcribe_audio(
            audio_data=audio_bytes,
            sample_rate=sample_rate,
            language=data.get('language', Config.WHISPER_LANGUAGE)
        )
        
        text = transcription_result.get('text', '').strip()
        confidence = transcription_result.get('confidence', 0.0)
        detected_language = transcription_result.get('language', 'unknown')
        
        if not text:
            logger.warn(
                "⚠️ [FLUXO] Nenhum texto transcrito do áudio",
                client_id=sid,
                meeting_id=meeting_id,
                confidence=confidence
            )
            # Enviar resultado vazio com estrutura completa
            await sio.emit('text_analysis_result', {
                'meetingId': data.get('meetingId'),
                'participantId': data.get('participantId'),
                'text': '',
                'analysis': {
                    'intent': 'unknown',
                    'intent_confidence': 0.0,
                    'topic': 'unknown',
                    'topic_confidence': 0.0,
                    'speech_act': 'statement',
                    'speech_act_confidence': 0.0,
                    'keywords': [],
                    'entities': [],
                    'sentiment': 'neutral',
                    'sentiment_score': 0.5,
                    'urgency': 0.0,
                    'embedding': []
                },
                'timestamp': data.get('timestamp', 0),
                'confidence': 0.0
            }, room=sid)
            return
        
        logger.info(
            "✅ [FLUXO] Transcrição concluída",
            client_id=sid,
            meeting_id=meeting_id,
            text_length=len(text),
            text_preview=text[:50],
            confidence=round(confidence, 3),
            detected_language=detected_language
        )
        
        # Criar chunk de transcrição para análise
        from .types.messages import TranscriptionChunk
        chunk = TranscriptionChunk(
            meetingId=data.get('meetingId'),
            participantId=data.get('participantId'),
            text=text,
            timestamp=data.get('timestamp', 0),
            language=detected_language,
            confidence=confidence
        )
        
        # Analisar texto com BERT
        logger.info(
            "⚙️ [FLUXO] Iniciando análise de texto transcrito",
            client_id=sid,
            meeting_id=meeting_id,
            participant_id=participant_id,
            text_length=len(text)
        )
        analysis_result = await analysis_service.analyze(chunk)
        
        logger.debug(
            "✅ [FLUXO] Análise concluída, criando resposta",
            client_id=sid,
            meeting_id=meeting_id,
            intent=analysis_result.get('intent'),
            sentiment=analysis_result.get('sentiment')
        )
        
        # Criar resposta
        result = TextAnalysisResult(
            meetingId=chunk.meetingId,
            participantId=chunk.participantId,
            text=chunk.text,
            analysis=analysis_result,
            timestamp=chunk.timestamp,
            confidence=confidence
        )
        
        # Enviar resultado de volta via Socket.IO
        # Pydantic v2.5.3 usa model_dump() ao invés de dict()
        result_dict = result.model_dump()
        await sio.emit('text_analysis_result', result_dict, room=sid)
        
        logger.info(
            "📤 [FLUXO] Resultado de análise enviado (do áudio)",
            client_id=sid,
            meeting_id=chunk.meetingId,
            participant_id=chunk.participantId,
            transcription_confidence=round(confidence, 3),
            intent=analysis_result.get('intent'),
            intent_confidence=analysis_result.get('intent_confidence'),
            topic=analysis_result.get('topic'),
            topic_confidence=analysis_result.get('topic_confidence'),
            speech_act=analysis_result.get('speech_act'),
            sentiment=analysis_result.get('sentiment'),
            sentiment_score=analysis_result.get('sentiment_score'),
            urgency=analysis_result.get('urgency'),
            keywords_count=len(analysis_result.get('keywords', [])),
            entities_count=len(analysis_result.get('entities', [])),
            embedding_dim=len(analysis_result.get('embedding', []))
        )
        
    except Exception as e:
        logger.error(
            "Error processing audio chunk",
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

