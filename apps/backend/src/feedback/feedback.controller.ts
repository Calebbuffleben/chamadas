import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FeedbackAggregatorService } from './feedback.aggregator.service';
import { FeedbackDeliveryService } from './feedback.delivery.service';
import { SessionsService } from '../sessions/sessions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { OrganizationRole } from '@prisma/client';

@Controller('feedback')
export class FeedbackController {
  constructor(
    private readonly aggregator: FeedbackAggregatorService,
    private readonly delivery: FeedbackDeliveryService,
    private readonly sessions: SessionsService,
  ) {}

  @Get('debug/:meetingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrganizationRole.owner, OrganizationRole.admin, OrganizationRole.host)
  async getDebug(@Param('meetingId') meetingId: string, @CurrentUser() user: AuthUser) {
    await this.sessions.assertMeetingBelongsToOrganization(meetingId, user.organizationId);
    return this.aggregator.getMeetingDebug(meetingId);
  }

  @Get('metrics/:meetingId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrganizationRole.owner, OrganizationRole.admin, OrganizationRole.host)
  async getMetrics(@Param('meetingId') meetingId: string, @CurrentUser() user: AuthUser) {
    await this.sessions.assertMeetingBelongsToOrganization(meetingId, user.organizationId);
    return this.delivery.getMetrics(meetingId);
  }
}
