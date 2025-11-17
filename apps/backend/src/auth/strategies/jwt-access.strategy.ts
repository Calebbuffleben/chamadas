import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';

type MembershipRecord = {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  user: {
    email: string;
    name: string | null;
    status: string;
  };
};

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('JWT_ACCESS_SECRET') private readonly accessSecret: string,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const prismaWithMembership = this.prisma as PrismaService & {
      organizationMembership: {
        findUnique(args: {
          where: { id: string };
          include: { user: true };
        }): Promise<MembershipRecord | null>;
      };
    };

    const membership = await prismaWithMembership.organizationMembership.findUnique({
      where: { id: payload.membershipId },
      include: { user: true },
    });

    if (!membership) {
      throw new UnauthorizedException('Membership not found');
    }

    if (membership.user.status !== 'active') {
      throw new UnauthorizedException('User is inactive');
    }

    return {
      userId: membership.userId,
      organizationId: membership.organizationId,
      membershipId: membership.id,
      role: membership.role,
      email: membership.user.email,
      name: membership.user.name,
    };
  }
}
