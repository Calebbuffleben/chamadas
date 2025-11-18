import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EncodedFileOutput, EgressClient, S3Upload } from 'livekit-server-sdk';

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);

  constructor(
    @Inject('LIVEKIT_API_URL') private readonly livekitApiUrl: string,
    @Inject('LIVEKIT_API_KEY') private readonly livekitApiKey: string | undefined,
    @Inject('LIVEKIT_API_SECRET') private readonly livekitApiSecret: string | undefined,
  ) {}

  private createClient(): EgressClient {
    if (!this.livekitApiKey || !this.livekitApiSecret) {
      throw new ConflictException('LIVEKIT_API_KEY/SECRET are not configured');
    }
    const hostURL = new URL(this.livekitApiUrl);
    hostURL.protocol = 'https:';
    return new EgressClient(hostURL.origin, this.livekitApiKey, this.livekitApiSecret);
  }

  async start(roomName: string): Promise<void> {
    const client = this.createClient();
    const existing = await client.listEgress({ roomName });
    if (existing.some((egress) => egress.status < 2)) {
      throw new ConflictException('Meeting is already being recorded');
    }

    const fileOutput = this.createFileOutput(roomName);
    await client.startRoomCompositeEgress(
      roomName,
      {
        file: fileOutput,
      },
      {
        layout: 'speaker',
      },
    );
    this.logger.log(`Started recording for room ${roomName}`);
  }

  async stop(roomName: string): Promise<void> {
    const client = this.createClient();
    const active = (await client.listEgress({ roomName })).filter((info) => info.status < 2);
    if (active.length === 0) {
      throw new NotFoundException('No active recording found');
    }
    await Promise.all(active.map((info) => client.stopEgress(info.egressId)));
    this.logger.log(`Stopped ${active.length} recording(s) for room ${roomName}`);
  }

  private createFileOutput(roomName: string): EncodedFileOutput {
    const {
      S3_ENDPOINT,
      S3_KEY_ID,
      S3_KEY_SECRET,
      S3_REGION,
      S3_BUCKET,
    } = process.env;
    if (!S3_BUCKET || !S3_KEY_ID || !S3_KEY_SECRET) {
      throw new ConflictException('S3 recording storage is not fully configured');
    }
    const filepath = `${new Date().toISOString()}-${roomName}.mp4`;
    return new EncodedFileOutput({
      filepath,
      output: {
        case: 's3',
        value: new S3Upload({
          endpoint: S3_ENDPOINT,
          accessKey: S3_KEY_ID,
          secret: S3_KEY_SECRET,
          region: S3_REGION,
          bucket: S3_BUCKET,
        }),
      },
    });
  }
}


