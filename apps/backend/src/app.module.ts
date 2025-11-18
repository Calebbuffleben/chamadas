import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AppController } from './app.controller';
import { SessionsModule } from './sessions/sessions.module';
import { LiveKitWebhookModule } from './livekit/livekit-webhook.module';
import { AudioPipelineModule } from './pipeline/audio-pipeline.module';
import { FeedbackModule } from './feedback/feedback.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AuthModule } from './auth/auth.module';
import { MeetingsModule } from './meetings/meetings.module';
import { RecordingsModule } from './recordings/recordings.module';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule,
    PrismaModule,
    SessionsModule,
    LiveKitWebhookModule,
    AudioPipelineModule,
    WebSocketModule,
    FeedbackModule,
    UsersModule,
    OrganizationsModule,
    AuthModule,
    MeetingsModule,
    RecordingsModule,
  ],
  controllers: [AppController],
  providers: [RolesGuard],
})
export class AppModule {}
