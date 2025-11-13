export type ParticipantRole = 'host' | 'guest' | 'unknown';

export interface FeedbackIngestionEvent {
  version: 1;
  meetingId: string;
  roomName?: string;
  trackSid?: string;
  participantId?: string;
  participantRole: ParticipantRole;
  ts: number; // ms epoch at ingestion
  prosody: {
    speechDetected: boolean;
    valence?: number;
    arousal?: number;
    warnings: string[];
  };
  signal?: {
    rmsDbfs?: number;
  };
  debug: {
    rawPreview: string;
    rawHash: string; // sha256 hex
  };
}

export interface AggregatedWindowEvent {
  meetingId: string;
  participantId: string;
  window: { start: number; end: number };
  metrics: {
    speechCoverage: number; // 0..1
    meanRmsDbfs?: number;
    valenceEMA?: number;
    arousalEMA?: number;
  };
}

export type FeedbackSeverity = 'info' | 'warning' | 'critical';

export interface FeedbackEventPayload {
  id: string;
  type:
    | 'volume_baixo'
    | 'volume_alto'
    | 'silencio_prolongado'
    | 'tendencia_emocional_negativa'
    | 'engajamento_baixo'
    | 'overlap_fala'
    | 'monologo_prolongado'
    | 'frustracao_crescente'
    | 'entusiasmo_alto'
    | 'monotonia_prosodica'
    | 'energia_grupo_baixa'
    | 'interrupcoes_frequentes'
    | 'polarizacao_emocional'
    | 'efeito_pos_interrupcao'
    | 'ritmo_acelerado'
    | 'ritmo_pausado';
  severity: FeedbackSeverity;
  ts: number;
  meetingId: string;
  participantId: string;
  participantName?: string;
  window: { start: number; end: number };
  message: string;
  tips?: string[];
  metadata?: {
    rmsDbfs?: number;
    speechCoverage?: number;
    valenceEMA?: number;
    arousalEMA?: number;
  };
}
