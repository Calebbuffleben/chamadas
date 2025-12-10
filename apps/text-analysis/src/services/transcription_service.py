"""
Serviço de transcrição de áudio usando Whisper.
Recebe chunks de áudio WAV e retorna transcrições em texto.
"""

import io
import asyncio
import time
import structlog
import whisper
import torch
import numpy as np
from typing import Optional, Dict, Any
from ..config import Config

logger = structlog.get_logger()


class TranscriptionService:
    """
    Serviço de transcrição de áudio usando Whisper.
    
    Whisper é um modelo de transcrição de áudio de código aberto da OpenAI,
    otimizado para múltiplos idiomas incluindo português.
    
    Características:
    - Suporta múltiplos idiomas (português incluído)
    - Modelos leves disponíveis (tiny, base, small, medium, large)
    - Funciona em CPU e GPU
    - Lazy loading do modelo (carrega apenas quando necessário)
    """
    
    def __init__(self):
        """
        Inicializa serviço de transcrição.
        O modelo Whisper será carregado apenas na primeira transcrição (lazy loading).
        """
        self.model = None
        self._loaded = False
        self.model_name = Config.WHISPER_MODEL_NAME
        self.device = Config.WHISPER_DEVICE
        self.language = Config.WHISPER_LANGUAGE
        self.task = Config.WHISPER_TASK
        
        logger.info(
            "✅ [SERVIÇO] TranscriptionService inicializado",
            model=self.model_name,
            device=self.device,
            language=self.language
        )
    
    def _load_model(self):
        """
        Carrega modelo Whisper (lazy loading).
        
        Modelos disponíveis (do menor ao maior):
        - tiny: ~39M parâmetros, mais rápido, menos preciso
        - base: ~74M parâmetros, bom equilíbrio
        - small: ~244M parâmetros, mais preciso
        - medium: ~769M parâmetros, muito preciso
        - large: ~1550M parâmetros, mais preciso, mais lento
        
        O modelo escolhido (base por padrão) oferece bom equilíbrio
        entre velocidade e precisão para transcrições em tempo real.
        """
        if self._loaded:
            return
        
        logger.info("Loading Whisper model", model=self.model_name)
        
        try:
            # Whisper detecta automaticamente se CUDA está disponível
            # mas podemos forçar device se necessário
            device = self.device
            if device == "cuda" and not torch.cuda.is_available():
                logger.warn("CUDA requested but not available, using CPU")
                device = "cpu"
            
            # Carregar modelo Whisper
            # O modelo será baixado automaticamente na primeira execução
            # e armazenado em cache para uso futuro
            self.model = whisper.load_model(
                self.model_name,
                device=device
            )
            
            self._loaded = True
            
            logger.info(
                "Whisper model loaded successfully",
                model=self.model_name,
                device=device,
                language=self.language
            )
            
        except Exception as e:
            logger.error("Failed to load Whisper model", error=str(e), model=self.model_name)
            raise
    
    async def transcribe_audio(
        self,
        audio_data: bytes,
        sample_rate: int = 16000,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Transcreve áudio WAV para texto usando Whisper.
        
        Como funciona:
        ==============
        1. O áudio WAV é decodificado para array numpy
        2. O Whisper processa o áudio em chunks sobrepostos
        3. O modelo gera tokens de texto correspondentes ao áudio
        4. Os tokens são decodificados para texto final
        
        Parâmetros:
        ===========
        - audio_data: Bytes do arquivo WAV (incluindo header)
        - sample_rate: Taxa de amostragem do áudio (Hz)
        - language: Idioma do áudio (None = auto-detect, 'pt' = português)
        
        Retorna:
        ========
        Dict com:
        {
            'text': str,              # Texto transcrito
            'language': str,           # Idioma detectado
            'segments': List[Dict],    # Segmentos com timestamps
            'confidence': float        # Confiança média (0-1)
        }
        
        Exemplo:
        ========
        result = service.transcribe_audio(wav_bytes, sample_rate=16000, language='pt')
        print(result['text'])  # "Olá, como você está?"
        """
        if not self._loaded:
            self._load_model()
        
        try:
            logger.debug(
                "🔍 [TRANSCRIÇÃO] Decodificando WAV",
                audio_size_bytes=len(audio_data),
                expected_sample_rate=sample_rate
            )
            
            # Decodificar WAV para array numpy
            # O Whisper espera áudio como array numpy float32 normalizado (-1 a 1)
            audio_array = self._decode_wav(audio_data, sample_rate)
            
            if audio_array is None or len(audio_array) == 0:
                logger.warn(
                    "⚠️ [TRANSCRIÇÃO] Áudio vazio ou inválido",
                    audio_size_bytes=len(audio_data)
                )
                return {
                    'text': '',
                    'language': language or self.language,
                    'segments': [],
                    'confidence': 0.0
                }
            
            logger.debug(
                "✅ [TRANSCRIÇÃO] WAV decodificado",
                audio_samples=len(audio_array),
                audio_length_sec=round(len(audio_array) / sample_rate, 2)
            )
            
            # Configurar parâmetros de transcrição
            transcribe_options = {
                'language': language or self.language,
                'task': self.task,  # 'transcribe' ou 'translate'
                'fp16': False,  # Usar float32 em CPU
                'verbose': False  # Não imprimir logs detalhados
            }
            
            # Se CUDA estiver disponível, usar fp16 para melhor performance
            if self.device == "cuda" and torch.cuda.is_available():
                transcribe_options['fp16'] = True
            
            audio_length_sec = len(audio_array) / sample_rate
            logger.info(
                "🎙️ [TRANSCRIÇÃO] Iniciando transcrição com Whisper",
                audio_length_sec=round(audio_length_sec, 2),
                audio_samples=len(audio_array),
                sample_rate=sample_rate,
                language=transcribe_options['language'],
                model=self.model_name,
                device=self.device
            )
            
            # Transcrever áudio em thread separada para não bloquear event loop
            # Whisper é CPU/GPU intensivo e pode demorar alguns segundos
            # Usar get_running_loop() para Python 3.7+ (mais seguro)
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                # Fallback para get_event_loop() se não houver loop rodando
                loop = asyncio.get_event_loop()
            
            transcribe_start = time.perf_counter()
            result = await loop.run_in_executor(
                None,
                lambda: self.model.transcribe(audio_array, **transcribe_options)
            )
            transcribe_latency_ms = (time.perf_counter() - transcribe_start) * 1000
            
            logger.debug(
                "⏱️ [TRANSCRIÇÃO] Transcrição executada",
                latency_ms=round(transcribe_latency_ms, 2)
            )
            
            # Extrair informações relevantes
            text = result.get('text', '').strip()
            detected_language = result.get('language', language or self.language)
            segments = result.get('segments', [])
            
            # Calcular confiança média dos segmentos
            confidence = 0.0
            if segments:
                confidences = [
                    seg.get('no_speech_prob', 0.0) for seg in segments
                    if 'no_speech_prob' in seg
                ]
                if confidences:
                    # no_speech_prob é a probabilidade de NÃO ter fala
                    # Queremos a probabilidade de TER fala, então: 1 - no_speech_prob
                    speech_probs = [1.0 - conf for conf in confidences]
                    confidence = float(np.mean(speech_probs)) if speech_probs else 0.0
            
            logger.info(
                "✅ [TRANSCRIÇÃO] Transcrição concluída",
                text_length=len(text),
                text_preview=text[:50] if text else '',
                language=detected_language,
                confidence=round(confidence, 3),
                segments_count=len(segments),
                latency_ms=round(transcribe_latency_ms, 2)
            )
            
            return {
                'text': text,
                'language': detected_language,
                'segments': segments,
                'confidence': confidence
            }
            
        except Exception as e:
            logger.error(
                "Transcription failed",
                error=str(e),
                error_type=type(e).__name__
            )
            # Retornar resultado vazio em caso de erro
            return {
                'text': '',
                'language': language or self.language,
                'segments': [],
                'confidence': 0.0
            }
    
    def _decode_wav(self, wav_data: bytes, expected_sample_rate: int) -> Optional[np.ndarray]:
        """
        Decodifica dados WAV para array numpy.
        
        O formato WAV esperado:
        - Header de 44 bytes
        - Dados PCM16LE (16-bit little-endian)
        - Mono ou estéreo
        
        Retorna:
        - Array numpy float32 normalizado (-1.0 a 1.0)
        - Taxa de amostragem ajustada se necessário
        """
        try:
            import wave
            
            # Criar arquivo WAV em memória
            wav_file = io.BytesIO(wav_data)
            
            # Ler WAV usando wave module
            with wave.open(wav_file, 'rb') as wf:
                sample_rate = wf.getframerate()
                num_channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                num_frames = wf.getnframes()
                
                # Ler dados de áudio
                audio_bytes = wf.readframes(num_frames)
                
                # Converter bytes para array numpy
                if sample_width == 2:  # 16-bit
                    audio_array = np.frombuffer(audio_bytes, dtype=np.int16)
                elif sample_width == 4:  # 32-bit
                    audio_array = np.frombuffer(audio_bytes, dtype=np.int32)
                else:
                    logger.warn(f"Unsupported sample width: {sample_width}")
                    return None
                
                # Converter para float32 e normalizar (-1.0 a 1.0)
                # Para int16: dividir por 32768.0
                # Para int32: dividir por 2147483648.0
                if sample_width == 2:
                    audio_float = audio_array.astype(np.float32) / 32768.0
                else:
                    audio_float = audio_array.astype(np.float32) / 2147483648.0
                
                # Converter estéreo para mono (média dos canais)
                if num_channels == 2:
                    audio_float = audio_float.reshape(-1, 2).mean(axis=1)
                
                # Resample se necessário (Whisper funciona melhor com 16kHz)
                # Nota: Se o áudio já estiver em 16kHz, não precisa resample
                if sample_rate != expected_sample_rate:
                    try:
                        from scipy import signal
                        num_samples = int(len(audio_float) * expected_sample_rate / sample_rate)
                        if num_samples > 0:
                            audio_float = signal.resample(audio_float, num_samples)
                            logger.debug(
                                "Audio resampled",
                                from_rate=sample_rate,
                                to_rate=expected_sample_rate,
                                original_samples=len(audio_array),
                                resampled_samples=num_samples
                            )
                        else:
                            logger.warn("Invalid resample target, keeping original sample rate")
                    except ImportError:
                        logger.warn("scipy not available, skipping resample - Whisper will handle it")
                        # Whisper pode lidar com diferentes sample rates, mas 16kHz é ideal
                    except Exception as e:
                        logger.warn(f"Resample failed: {e}, keeping original sample rate")
                else:
                    logger.debug("Audio already at target sample rate, no resample needed")
                
                return audio_float
                
        except Exception as e:
            logger.error("Failed to decode WAV", error=str(e))
            return None

