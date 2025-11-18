import { Module } from '@nestjs/common';
import { RecordingsController } from './recordings.controller';
import { RecordingsService } from './recordings.service';
import { SessionsModule } from '../sessions/sessions.module';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule, SessionsModule],
  controllers: [RecordingsController],
  providers: [RecordingsService],
})
export class RecordingsModule {}


