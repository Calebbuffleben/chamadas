"""
Serviço principal de análise de texto.
Orquestra análise com BERT, gerencia cache e agrega resultados.
"""

from typing import Dict, Any
from ..types.messages import TranscriptionChunk
from ..models.bert_analyzer import BERTAnalyzer
from ..services.cache_service import AnalysisCache
from ..config import Config
import structlog
import time

logger = structlog.get_logger()


class TextAnalysisService:
    """
    Serviço de análise de texto com BERT.
    
    Responsabilidades:
    - Gerenciar cache de resultados
    - Lazy loading do analisador BERT
    - Orquestrar análise (sentimento, keywords, emoções)
    - Agregar resultados
    """
    
    def __init__(self):
        """Inicializa serviço de análise"""
        self.analyzer = None
        self.cache = AnalysisCache(
            ttl_seconds=Config.CACHE_TTL_SECONDS,
            max_size=Config.CACHE_MAX_SIZE
        )
        
        logger.info(
            "TextAnalysisService initialized",
            cache_ttl=Config.CACHE_TTL_SECONDS,
            cache_max_size=Config.CACHE_MAX_SIZE
        )
    
    def _get_analyzer(self) -> BERTAnalyzer:
        """
        Retorna analisador BERT (lazy loading).
        
        Returns:
            Instância de BERTAnalyzer
        """
        if self.analyzer is None:
            logger.info("Initializing BERT analyzer")
            self.analyzer = BERTAnalyzer(
                model_name=Config.MODEL_NAME,
                device=Config.MODEL_DEVICE,
                cache_dir=Config.MODEL_CACHE_DIR,
                max_length=Config.ANALYSIS_MAX_LENGTH,
                sbert_model_name=getattr(Config, 'SBERT_MODEL_NAME', None)
            )
        return self.analyzer
    
    async def analyze(self, chunk: TranscriptionChunk) -> Dict[str, Any]:
        """
        Analisa texto e retorna resultados completos.
        
        Fluxo:
        1. Verifica cache
        2. Se não encontrado, executa análise
        3. Armazena no cache
        4. Retorna resultados
        
        Args:
            chunk: Chunk de transcrição a ser analisado
            
        Returns:
            Dict com resultados da análise:
            {
                'word_count': int,
                'char_count': int,
                'has_question': bool,
                'has_exclamation': bool,
                'sentiment_score': Dict[str, float],
                'emotions': Dict[str, float],
                'topics': List[str],
                'keywords': List[str]
            }
        """
        start_time = time.perf_counter()
        
        # Verificar cache primeiro
        cached_result = self.cache.get(
            chunk.meetingId,
            chunk.participantId,
            chunk.text
        )
        
        if cached_result:
            latency_ms = (time.perf_counter() - start_time) * 1000
            logger.info(
                "Analysis completed (cached)",
                meeting_id=chunk.meetingId,
                latency_ms=round(latency_ms, 2)
            )
            return cached_result
        
        # Obter analisador (lazy loading)
        analyzer = self._get_analyzer()
        
        # Executar análises em paralelo (futuro: usar asyncio.gather)
        sentiment = analyzer.analyze_sentiment(chunk.text)
        keywords = analyzer.extract_keywords(chunk.text, top_n=10)
        emotions = analyzer.detect_emotions(chunk.text)
        
        # Análise semântica com SBERT
        # Esta análise gera embeddings semânticos e pode calcular similaridade
        # com textos anteriores (útil para detectar repetição de ideias)
        semantic_analysis = None
        try:
            if Config.SBERT_MODEL_NAME:
                # Realizar análise semântica completa
                # Por enquanto, não passamos textos de referência, mas isso pode ser
                # implementado no futuro para detectar repetição de ideias
                semantic_analysis = analyzer.analyze_semantics(chunk.text)
                logger.debug(
                    "Semantic analysis completed",
                    meeting_id=chunk.meetingId,
                    embedding_dim=semantic_analysis.get('embedding_dimension', 0)
                )
        except Exception as e:
            # Se a análise semântica falhar, continuar sem ela
            logger.warn(
                "Semantic analysis failed, continuing without it",
                error=str(e),
                meeting_id=chunk.meetingId
            )
        
        # Calcular métricas básicas
        word_count = len(chunk.text.split())
        char_count = len(chunk.text)
        has_question = '?' in chunk.text
        has_exclamation = '!' in chunk.text
        
        # Construir resultado completo
        result = {
            'word_count': word_count,
            'char_count': char_count,
            'has_question': has_question,
            'has_exclamation': has_exclamation,
            'sentiment_score': sentiment,
            'emotions': emotions,
            'topics': [],  # Placeholder para futura implementação
            'keywords': keywords,
            'semantic_analysis': semantic_analysis  # Nova: análise semântica com SBERT
        }
        
        # Armazenar no cache
        self.cache.set(
            chunk.meetingId,
            chunk.participantId,
            chunk.text,
            result
        )
        
        latency_ms = (time.perf_counter() - start_time) * 1000
        
        logger.info(
            "Analysis completed",
            meeting_id=chunk.meetingId,
            participant_id=chunk.participantId,
            word_count=word_count,
            sentiment=sentiment,
            keywords_count=len(keywords),
            latency_ms=round(latency_ms, 2)
        )
        
        return result

