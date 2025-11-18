import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import type { AuthResult } from './interfaces/auth-result.interface';
import { InvitationStatus, OrganizationRole, UserStatus } from '@prisma/client';
import { hash, compare } from 'bcryptjs';
import { createHash } from 'crypto';
import type { Organization, OrganizationMembership, User } from '@prisma/client';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

type IssueTokenParams = {
  user: User;
  membership: OrganizationMembership;
  organization: Organization;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly prisma: PrismaService,
    @Inject('JWT_REFRESH_SECRET') private readonly refreshSecret: string,
    @Inject('JWT_ACCESS_TTL') private readonly accessTtlSeconds: number,
    @Inject('JWT_REFRESH_TTL') private readonly refreshTtlSeconds: number,
  ) {}

  async register(dto: RegisterDto, userAgent?: string): Promise<AuthResult> {
    const organizationSlug = this.normalizeSlug(dto.organizationSlug);
    const existing = await this.organizationsService.findBySlug(organizationSlug);
    if (existing) {
      throw new ConflictException('Organization slug already registered');
    }

    const organizationName = dto.organizationName.trim();
    if (!organizationName) {
      throw new BadRequestException('Organization name is required');
    }

    const organization = await this.organizationsService.create({
      name: organizationName,
      slug: organizationSlug,
    });

    const normalizedEmail = dto.email.trim().toLowerCase();
    const sanitizedName = dto.name?.trim() ? dto.name.trim() : undefined;
    const passwordHash = await this.hashPassword(dto.password);
    const { user, membership } = await this.usersService.createUserWithMembership({
      email: normalizedEmail,
      passwordHash,
      name: sanitizedName,
      organizationId: organization.id,
      role: OrganizationRole.owner,
      isDefault: true,
    });

    return this.issueTokens({ user, membership, organization, userAgent });
  }

  async login(dto: LoginDto, userAgent?: string): Promise<AuthResult> {
    const organizationSlug = this.normalizeSlug(dto.organizationSlug);
    const organization = await this.organizationsService.getBySlugOrThrow(organizationSlug);
    const normalizedEmail = dto.email.trim().toLowerCase();
    const userWithMembership = await this.usersService.findByEmailInOrganization(
      normalizedEmail,
      organization.id,
    );

    if (!userWithMembership || userWithMembership.memberships.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (userWithMembership.status !== UserStatus.active) {
      throw new UnauthorizedException('User inactive');
    }

    const passwordValid = await this.verifyPassword(dto.password, userWithMembership.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const [membership] = userWithMembership.memberships;
    await this.usersService.updateLastLogin(userWithMembership.id);

    return this.issueTokens({
      user: userWithMembership,
      membership,
      organization,
      userAgent,
    });
  }

  async refresh(dto: RefreshDto, userAgent?: string): Promise<AuthResult> {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const tokenHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        userId: payload.sub,
        organizationId: payload.organizationId,
        revokedAt: null,
      },
    });

    if (!storedToken || storedToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const membership = await this.prisma.organizationMembership.findUnique({
      where: { id: payload.membershipId },
      include: { organization: true, user: true },
    });

    if (!membership) {
      throw new UnauthorizedException('Membership not found');
    }

    return this.issueTokens({
      user: membership.user,
      membership,
      organization: membership.organization,
      userAgent,
    });
  }

  async logout(dto: LogoutDto): Promise<void> {
    const tokenHash = this.hashToken(dto.refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(user: AuthUser) {
    const profile = await this.usersService.getProfile(user.userId, user.organizationId);
    if (!profile) {
      throw new UnauthorizedException();
    }
    return profile;
  }

  async switchOrganization(userId: string, membershipId: string, userAgent?: string): Promise<AuthResult> {
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { id: membershipId },
      include: {
        organization: true,
        user: true,
      },
    });

    if (!membership || membership.userId !== userId) {
      throw new ForbiddenException('Membership not found for current user');
    }

    if (membership.user.status !== UserStatus.active) {
      throw new UnauthorizedException('User inactive');
    }

    return this.issueTokens({
      user: membership.user,
      membership,
      organization: membership.organization,
      userAgent,
    });
  }

  async acceptInvitation(dto: AcceptInvitationDto, userAgent?: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(dto.token);
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: { tokenHash },
      include: {
        organization: true,
      },
    });

    if (
      !invitation ||
      invitation.status !== 'pending' ||
      (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now())
    ) {
      throw new BadRequestException('Convite inválido ou expirado');
    }

    const existingMembership = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId: invitation.organizationId,
        user: {
          email: invitation.email,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('Você já faz parte desta organização');
    }

    const normalizedEmail = invitation.email.toLowerCase();

    let user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });

    if (user) {
      const matches = await compare(dto.password, user.passwordHash);
      if (!matches) {
        throw new UnauthorizedException('Senha inválida para o usuário convidado');
      }
      if (user.status !== UserStatus.active) {
        throw new UnauthorizedException('Usuário inativo');
      }
    } else {
      const passwordHash = await this.hashPassword(dto.password);
      user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          name: dto.name,
          passwordHash,
          status: UserStatus.active,
        },
      });
    }

    const membership = await this.prisma.organizationMembership.create({
      data: {
        organizationId: invitation.organizationId,
        userId: user.id,
        role: invitation.role,
        isDefault: false,
      },
    });

    await this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted' },
    });

    return this.issueTokens({
      user,
      membership,
      organization: invitation.organization,
      userAgent,
    });
  }

  async getOrganizationsForUser(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return memberships.map((membership) => ({
      membershipId: membership.id,
      organizationId: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      plan: membership.organization.plan,
      role: membership.role,
      isDefault: membership.isDefault,
    }));
  }

  private async issueTokens(params: IssueTokenParams): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: params.user.id,
      organizationId: params.organization.id,
      membershipId: params.membership.id,
      role: params.membership.role,
      email: params.user.email,
      name: params.user.name,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.accessTtlSeconds,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtlSeconds,
    });

    await this.storeRefreshToken({
      token: refreshToken,
      userId: params.user.id,
      organizationId: params.organization.id,
      userAgent: params.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshTokenExpiresIn: this.refreshTtlSeconds,
      user: {
        id: params.user.id,
        email: params.user.email,
        name: params.user.name,
        organizationId: params.organization.id,
        membershipId: params.membership.id,
        role: params.membership.role,
      },
    };
  }

  private async storeRefreshToken(input: {
    token: string;
    userId: string;
    organizationId: string;
    userAgent?: string;
  }): Promise<void> {
    const tokenHash = this.hashToken(input.token);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: input.userId,
        organizationId: input.organizationId,
        userAgent: input.userAgent,
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return hash(password, 12);
  }

  private async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private normalizeSlug(slug: string): string {
    const normalized = slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!normalized) {
      throw new BadRequestException('Invalid organization slug');
    }
    return normalized;
  }
}
