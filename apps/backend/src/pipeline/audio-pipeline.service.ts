import { Injectable, Logger } from '@nestjs/common';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { HumeStreamService } from './hume-stream.service';

export type AudioChunkMeta = {
  meetingId: string;
  participant: string;
  track: string;
  sampleRate: number; // Hz
  channels: number; // 1 or 2
  groupSeconds?: number; // optional per-call override
};

type BufferState = {
  buffers: Buffer[];
  bytesAccumulated: number;
  thresholdBytes: number;
  lastFlushAt: number;
};

@Injectable()
export class AudioPipelineService {
  private readonly logger = new Logger(AudioPipelineService.name);
  private keyToState = new Map<string, BufferState>();
  private readonly defaultGroupSeconds: number;
  

  constructor(private readonly hume: HumeStreamService) {
    const seconds = Number(process.env.AUDIO_PIPELINE_GROUP_SECONDS || '2');
    this.defaultGroupSeconds = Number.isFinite(seconds) && seconds > 0 ? seconds : 2;
  }

  enqueueChunk(meta: AudioChunkMeta, data: Buffer): void {
    const key = this.buildKey(meta);
    const groupSeconds = meta.groupSeconds && meta.groupSeconds > 0 ? meta.groupSeconds : this.defaultGroupSeconds;
    const thresholdBytes = this.computeThresholdBytes(meta, groupSeconds);
    let state = this.keyToState.get(key);
    if (!state) {
      state = {
        buffers: [],
        bytesAccumulated: 0,
        thresholdBytes,
        lastFlushAt: Date.now(),
      };
      this.keyToState.set(key, state);
    }

    state.buffers.push(data);
    state.bytesAccumulated += data.length;

    const timeSinceLastFlush = Date.now() - state.lastFlushAt;
    const timeTriggerMs = Math.max(500, (meta.groupSeconds && meta.groupSeconds > 0 ? meta.groupSeconds : this.defaultGroupSeconds) * 1000);

    if (state.bytesAccumulated >= state.thresholdBytes || timeSinceLastFlush >= timeTriggerMs) {
      this.flush(meta, key, state);
    }
  }

  clear(meta: AudioChunkMeta): void {
    const key = this.buildKey(meta);
    const state = this.keyToState.get(key);
    if (state) {
      this.keyToState.delete(key);
    }
  }

  private flush(meta: AudioChunkMeta, key: string, state: BufferState): void {
    if (state.bytesAccumulated === 0) {
      return;
    }
    const payload = Buffer.concat(state.buffers, state.bytesAccumulated);
    state.buffers = [];
    state.bytesAccumulated = 0;
    state.lastFlushAt = Date.now();

    this.dispatchToHume(meta, payload).catch((err) => {
      this.logger.error(`Dispatch error for ${key}: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  private computeThresholdBytes(meta: AudioChunkMeta, seconds: number): number {
    const bytesPerSamplePerChannel = 2; // s16le
    return Math.floor(meta.sampleRate * bytesPerSamplePerChannel * meta.channels * seconds);
  }

  private buildKey(meta: AudioChunkMeta): string {
    return `${meta.meetingId}:${meta.participant}:${meta.track}`;
  }

  private async dispatchToHume(meta: AudioChunkMeta, pcm: Buffer): Promise<void> {
    const normalize = (process.env.AUDIO_PIPELINE_NORMALIZE || 'false') === 'true';
    const payloadFormat = (process.env.AUDIO_PIPELINE_PAYLOAD || 'wav').toLowerCase(); // prefer wav for WS
    const processedPcm = normalize ? this.normalizeVolume(pcm, meta.channels) : pcm;
    const wavBody = payloadFormat === 'wav' ? this.buildWav(processedPcm, meta.sampleRate, meta.channels) : this.buildWav(processedPcm, meta.sampleRate, meta.channels);
    await this.appendLocalLog(meta, wavBody.length);
    this.logger.log(`Streaming to Hume: meetingId=${meta.meetingId} participant=${meta.participant} track=${meta.track} bytes=${wavBody.length}`);
    await this.hume.sendChunk({
      meetingId: meta.meetingId,
      participant: meta.participant,
      track: meta.track,
      sampleRate: meta.sampleRate,
      channels: meta.channels,
    }, wavBody);
  }

  // Imentiv HTTP removed. WS-based real-time streaming via Hume.

  private async appendLocalLog(meta: AudioChunkMeta, size: number): Promise<void> {
    try {
      const baseDir = path.resolve(process.cwd(), 'storage', 'pipeline-logs');
      await fsp.mkdir(baseDir, { recursive: true });
      const filePath = path.join(baseDir, `${meta.meetingId}.log`);
      const line = `${new Date().toISOString()} meetingId=${meta.meetingId} participant=${meta.participant} track=${meta.track} size=${size}\n`;
      await fsp.appendFile(filePath, line);
    } catch {}
  }

  private buildWav(pcmS16le: Buffer, sampleRate: number, channels: number): Buffer {
    const bitsPerSample = 16;
    const blockAlign = (channels * bitsPerSample) / 8;
    const byteRate = sampleRate * blockAlign;
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcmS16le.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcmS16le.length, 40);
    return Buffer.concat([header, pcmS16le], 44 + pcmS16le.length);
  }

  private normalizeVolume(pcmS16le: Buffer, channels: number): Buffer {
    // Simple peak normalization to ~0.9 of full scale
    const view = new DataView(pcmS16le.buffer, pcmS16le.byteOffset, pcmS16le.byteLength);
    let peak = 0;
    for (let i = 0; i < pcmS16le.length; i += 2) {
      const sample = view.getInt16(i, true);
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }
    if (peak === 0) return pcmS16le;
    const target = Math.floor(0.9 * 32767);
    const gain = target / peak;
    if (gain >= 1) return pcmS16le;
    const out = Buffer.allocUnsafe(pcmS16le.length);
    const outView = new DataView(out.buffer, out.byteOffset, out.byteLength);
    for (let i = 0; i < pcmS16le.length; i += 2) {
      let sample = view.getInt16(i, true);
      let scaled = Math.max(-32768, Math.min(32767, Math.round(sample * gain)));
      outView.setInt16(i, scaled, true);
    }
    return out;
  }
}


