import { Body, Controller, ForbiddenException, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrganizationRole } from '@prisma/client';
import { SessionsService } from '../sessions/sessions.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { RequestMeetingTokenDto } from './dto/request-meeting-token.dto';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';

@Controller('meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeetingsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Post(':meetingId/token')
  @Roles(OrganizationRole.owner, OrganizationRole.admin, OrganizationRole.host)
  async issueToken(
    @Param('meetingId') meetingId: string,
    @Body() dto: RequestMeetingTokenDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (dto.organizationId && dto.organizationId !== user.organizationId) {
      throw new ForbiddenException('Organization mismatch with current session');
    }
    await this.sessionsService.assertMeetingBelongsToOrganization(meetingId, user.organizationId);
    const session = await this.sessionsService.getByMeetingId(meetingId);
    if (!session) {
      throw new NotFoundException('Meeting not found');
    }
    const secret = await this.organizationsService.getDefaultSecretOrThrow(user.organizationId);
    const identity = dto.identity ?? `${user.userId}:${Date.now()}`;
    const participantName = dto.participantName ?? user.name ?? user.email;
    const accessToken = new AccessToken(secret.livekitApiKey, secret.livekitApiSecret, {
      identity,
      name: participantName ?? identity,
    });
    const grant: VideoGrant = {
      room: session.roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };
    accessToken.addGrant(grant);
    if (dto.metadata) {
      accessToken.metadata = JSON.stringify(dto.metadata);
    }
    return {
      meetingId,
      roomName: session.roomName,
      serverUrl: secret.livekitUrl,
      participantToken: accessToken.toJwt(),
    };
  }
}
