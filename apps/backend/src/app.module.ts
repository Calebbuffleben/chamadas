import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AppController } from './app.controller';
import { SessionsModule } from './sessions/sessions.module';
import { LiveKitWebhookModule } from './livekit/livekit-webhook.module';
import { AudioPipelineModule } from './pipeline/audio-pipeline.module';

@Module({
  imports: [ConfigModule, PrismaModule, SessionsModule, LiveKitWebhookModule, AudioPipelineModule, WebSocketModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}

