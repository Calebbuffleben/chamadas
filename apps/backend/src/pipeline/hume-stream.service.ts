import { Injectable, Logger } from '@nestjs/common';
// Use runtime require to avoid type constructibility issues across ws versions
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WSRuntime = require('ws');

export type HumeMeta = {
  meetingId: string;
  participant: string;
  track: string;
  sampleRate: number;
  channels: number;
};

type WsClient = {
  send(data: string | Buffer): void;
  on(event: 'open', listener: () => void): unknown;
  on(event: 'message', listener: (data: unknown, isBinary: boolean) => void): unknown;
  on(event: 'error', listener: (err: Error) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
  close(): void;
};

type Connection = {
  ws: WsClient;
  isOpen: boolean;
  pending: Array<string>;
};

@Injectable()
export class HumeStreamService {
  private readonly logger = new Logger(HumeStreamService.name);
  private readonly wsUrl: string;
  private readonly apiKey: string | undefined;
  private keyToConn = new Map<string, Connection>();

  constructor() {
    // Default endpoint inferred from Hume docs
    const base = process.env.HUME_WS_URL || 'wss://api.hume.ai/v0/stream/models';
    this.wsUrl = base;
    this.apiKey = process.env.HUME_API_KEY;
  }

  async sendChunk(meta: HumeMeta, wavChunk: Buffer): Promise<void> {
    const key = this.buildKey(meta);
    const payload = this.buildPayload(meta, wavChunk);
    let conn = this.keyToConn.get(key);
    if (!conn) {
      conn = await this.open(key);
    }
    if (!conn.isOpen) {
      conn.pending.push(payload);
      return;
    }
    try {
      conn.ws.send(payload);
    } catch (e) {
      this.logger.error(`send error for key=${key}: ${String(e)}`);
      try {
        conn.ws.close();
      } catch {}
      this.keyToConn.delete(key);
    }
  }

  private async open(key: string): Promise<Connection> {
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['X-Hume-Api-Key'] = this.apiKey;
    const WSClientCtor = WSRuntime as { new (url: string, protocols?: string | string[] | undefined, options?: Record<string, unknown>): WsClient };
    const ws: WsClient = new WSClientCtor(this.wsUrl, undefined, { headers });
    this.logger.log(`[Hume] connecting WS for ${key} → ${this.wsUrl}`);
    const conn: Connection = { ws, isOpen: false, pending: [] };
    this.keyToConn.set(key, conn);

    ws.on('open', () => {
      this.logger.log(`[Hume] WS open for ${key}`);
      conn.isOpen = true;
      // Send minimal models config enabling prosody
      const configMsg = JSON.stringify({ models: { prosody: {} } });
      ws.send(configMsg);
      this.logger.log(`[Hume] config sent for ${key}`);
      for (const msg of conn.pending.splice(0)) ws.send(msg);
    });
    ws.on('message', (data: unknown, _isBinary: boolean) => {
      const text = typeof data === 'string' ? data : (data as Buffer).toString('utf8');
      this.logger.log(`[Hume] message for ${key}: ${text.slice(0, 200)}`);
    });
    ws.on('error', (err: Error) => {
      this.logger.error(`[Hume] WS error for ${key}: ${String(err)}`);
    });
    ws.on('close', () => {
      this.logger.warn(`[Hume] WS closed for ${key}`);
      this.keyToConn.delete(key);
    });
    return conn;
  }

  private buildPayload(meta: HumeMeta, wavChunk: Buffer): string {
    const b64 = Buffer.from(wavChunk).toString('base64');
    return JSON.stringify({
      models: { prosody: {} },
      data: b64,
      // optional hints
      mime_type: 'audio/wav',
      meetingId: meta.meetingId,
      participant: meta.participant,
      track: meta.track,
      sr: meta.sampleRate,
      ch: meta.channels,
    });
  }

  private buildKey(meta: HumeMeta): string {
    return `${meta.meetingId}:${meta.participant}:${meta.track}`;
    }
}


