import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'] ?? undefined;
    return this.authService.register(dto, userAgent);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'] ?? undefined;
    return this.authService.login(dto, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'] ?? undefined;
    return this.authService.refresh(dto, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutDto) {
    await this.authService.logout(dto);
  }

  @Post('invitations/accept')
  async acceptInvitation(@Body() dto: AcceptInvitationDto, @Req() req: Request) {
    const userAgent = req.headers['user-agent'] ?? undefined;
    return this.authService.acceptInvitation(dto, userAgent);
  }

  @Post('switch')
  @UseGuards(JwtAuthGuard)
  async switchOrganization(
    @CurrentUser() user: AuthUser,
    @Body() dto: SwitchOrganizationDto,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'] ?? undefined;
    return this.authService.switchOrganization(user.userId, dto.membershipId, userAgent);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser | undefined) {
    if (!user) {
      return null;
    }
    return this.authService.getProfile(user);
  }

  @Get('me/tenants')
  @UseGuards(JwtAuthGuard)
  async listTenants(@CurrentUser() user: AuthUser) {
    const memberships = await this.usersService.listOrganizations(user.userId);
    return {
      organizations: memberships.map((membership) => ({
        membershipId: membership.id,
        role: membership.role,
        isDefault: membership.isDefault,
        organization: membership.organization,
      })),
    };
  }
}
