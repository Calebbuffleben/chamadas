import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RecordingsService } from './recordings.service';
import { RecordingRequestDto } from './dto/recording-request.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrganizationRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { SessionsService } from '../sessions/sessions.service';

@Controller('recordings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecordingsController {
  constructor(
    private readonly recordingsService: RecordingsService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Post('start')
  @Roles(OrganizationRole.owner, OrganizationRole.admin, OrganizationRole.host)
  async startRecording(@Body() dto: RecordingRequestDto, @CurrentUser() user: AuthUser) {
    await this.sessionsService.assertMeetingBelongsToOrganization(dto.roomName, user.organizationId);
    await this.recordingsService.start(dto.roomName);
    return { ok: true };
  }

  @Post('stop')
  @Roles(OrganizationRole.owner, OrganizationRole.admin, OrganizationRole.host)
  async stopRecording(@Body() dto: RecordingRequestDto, @CurrentUser() user: AuthUser) {
    await this.sessionsService.assertMeetingBelongsToOrganization(dto.roomName, user.organizationId);
    await this.recordingsService.stop(dto.roomName);
    return { ok: true };
  }
}


