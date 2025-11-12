import { Module } from '@nestjs/common';
import { AudioPipelineService } from './audio-pipeline.service';
import { HumeStreamService } from './hume-stream.service';
import { LiveKitWebhookModule } from '../livekit/livekit-webhook.module';

@Module({
  imports: [LiveKitWebhookModule],
  providers: [AudioPipelineService, HumeStreamService],
  exports: [AudioPipelineService],
})
export class AudioPipelineModule {}
