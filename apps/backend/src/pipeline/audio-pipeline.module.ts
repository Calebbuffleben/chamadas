import { Module } from '@nestjs/common';
import { AudioPipelineService } from './audio-pipeline.service';
import { HumeStreamService } from './hume-stream.service';

@Module({
  providers: [
    AudioPipelineService,
    HumeStreamService,
  ],
  exports: [AudioPipelineService],
})
export class AudioPipelineModule {}


