import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrganizationRole } from '@prisma/client';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get('resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    OrganizationRole.owner,
    OrganizationRole.admin,
    OrganizationRole.host,
    OrganizationRole.member,
  )
  async resolveByRoomName(@Query('roomName') roomName?: string, @CurrentUser() user?: AuthUser) {
    if (!roomName) {
      return { ok: false, error: 'roomName is required' };
    }
    const organizationId = user?.organizationId;
    const rec = await this.sessions.findActiveByRoomName(roomName, organizationId);
    if (rec) {
      return { ok: true, meetingId: rec.meetingId, roomName };
    }
    // Fallback: create a placeholder session scoped to the organization
    if (organizationId) {
      await this.sessions.ensurePlaceholderForRoom(roomName, organizationId);
    }
    return { ok: true, meetingId: roomName, roomName, pending: true };
  }
}
