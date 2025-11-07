import { Module } from '@nestjs/common';
import { SessionsModule } from '../sessions/sessions.module';
import { LiveKitWebhookController } from './livekit-webhook.controller';
import { LiveKitEgressService } from './livekit-egress.service';

@Module({
  imports: [SessionsModule],
  controllers: [LiveKitWebhookController],
  providers: [LiveKitEgressService],
})
export class LiveKitWebhookModule {}


