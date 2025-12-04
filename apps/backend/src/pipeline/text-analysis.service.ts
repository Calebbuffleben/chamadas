import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface TranscriptionChunk {
  meetingId: string;
  participantId: string;
  text: string;
  timestamp: number;
  language?: string;
  confidence?: number;
}

export interface TextAnalysisResult {
  meetingId: string;
  participantId: string;
  text: string;
  analysis: {
    word_count: number;
    char_count: number;
    has_question: boolean;
    has_exclamation: boolean;
    sentiment_score: {
      positive: number;
      negative: number;
      neutral: number;
    };
    emotions: Record<string, number>;
    topics: string[];
    keywords: string[];
  };
  timestamp: number;
  confidence: number;
}

@Injectable()
export class TextAnalysisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TextAnalysisService.name);
  private socket: Socket | null = null;
  private readonly pythonServiceUrl: string;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  constructor(private readonly emitter: EventEmitter2) {
    this.pythonServiceUrl =
      process.env.TEXT_ANALYSIS_SERVICE_URL || 'http://localhost:8001';
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    this.logger.log(`Connecting to Python text analysis service: ${this.pythonServiceUrl}`);

    this.socket = io(this.pythonServiceUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      this.logger.log('✅ Connected to Python text analysis service');
      this.reconnectAttempts = 0;
    });

    this.socket.on('text_analysis_result', (data: TextAnalysisResult) => {
      this.logger.log(
        `Received text analysis result: ${data.meetingId}/${data.participantId}`,
      );
      // Emitir evento para integração com A2E2
      this.emitter.emit('text.analysis', data);
    });

    this.socket.on('error', (error: Error) => {
      this.logger.error(`Python service error: ${error.message}`);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.logger.warn(`Disconnected from Python service: ${reason}`);
    });

    this.socket.on('connect_error', (error: Error) => {
      this.reconnectAttempts++;
      this.logger.warn(
        `Failed to connect to Python service (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}): ${error.message}`,
      );
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.logger.log('Disconnected from Python text analysis service');
    }
  }

  async sendTranscription(chunk: TranscriptionChunk): Promise<void> {
    if (!this.socket?.connected) {
      this.logger.warn('Python service not connected, skipping transcription');
      return;
    }

    try {
      this.socket.emit('transcription_chunk', {
        meetingId: chunk.meetingId,
        participantId: chunk.participantId,
        text: chunk.text,
        timestamp: chunk.timestamp,
        language: chunk.language,
        confidence: chunk.confidence,
      });
      this.logger.debug(
        `Sent transcription to Python: ${chunk.meetingId}/${chunk.participantId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send transcription: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

