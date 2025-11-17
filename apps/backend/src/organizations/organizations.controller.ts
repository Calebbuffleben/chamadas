import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { RegisterDto } from '../auth/dto/register.dto';
import { OrganizationsService } from './organizations.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { OrganizationRole } from '@prisma/client';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  @Post()
  async create(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post(':id/invitations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrganizationRole.owner, OrganizationRole.admin)
  async invite(
    @Param('id') organizationId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertSameOrganization(user, organizationId);
    const { invitation, token } = await this.organizationsService.createInvitation({
      organizationId,
      email: dto.email,
      role: dto.role,
      expiresInHours: dto.expiresInHours,
      createdByUserId: user.userId,
    });
    return {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      token,
    };
  }

  @Get(':id/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrganizationRole.owner, OrganizationRole.admin)
  async listMembers(@Param('id') organizationId: string, @CurrentUser() user: AuthUser) {
    this.assertSameOrganization(user, organizationId);
    const members = await this.organizationsService.listMembers(organizationId);
    return { members };
  }

  @Patch(':id/users/:membershipId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrganizationRole.owner, OrganizationRole.admin)
  async updateMemberRole(
    @Param('id') organizationId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertSameOrganization(user, organizationId);
    await this.organizationsService.updateMemberRole({
      organizationId,
      membershipId,
      role: dto.role,
    });
    return { ok: true };
  }

  @Get(':id/limits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(OrganizationRole.owner, OrganizationRole.admin)
  async getLimits(@Param('id') organizationId: string, @CurrentUser() user: AuthUser) {
    this.assertSameOrganization(user, organizationId);
    return this.organizationsService.getPlanLimits(organizationId);
  }

  private assertSameOrganization(user: AuthUser, organizationId: string) {
    if (user.organizationId !== organizationId) {
      throw new ForbiddenException('User is not acting on the selected organization');
    }
  }
}
