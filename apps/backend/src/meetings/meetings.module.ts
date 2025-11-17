import { Module } from '@nestjs/common';
import { MeetingsController } from './meetings.controller';
import { SessionsModule } from '../sessions/sessions.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [SessionsModule, OrganizationsModule],
  controllers: [MeetingsController],
})
export class MeetingsModule {}
