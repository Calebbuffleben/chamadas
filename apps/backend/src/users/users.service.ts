import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Organization, OrganizationMembership, User } from '@prisma/client';
import { OrganizationRole, UserStatus } from '@prisma/client';

export type CreateUserWithMembershipInput = {
  email: string;
  passwordHash: string;
  name?: string;
  organizationId: string;
  role: OrganizationRole;
  status?: UserStatus;
  isDefault?: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUserWithMembership(
    input: CreateUserWithMembershipInput,
  ): Promise<{ user: User; membership: OrganizationMembership }> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          name: input.name,
          status: input.status ?? UserStatus.active,
        },
      });

      const membership = await tx.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: input.organizationId,
          role: input.role,
          isDefault: input.isDefault ?? false,
        },
      });

      return { user, membership };
    });
  }

  async findByEmailInOrganization(
    email: string,
    organizationId: string,
  ): Promise<
    | (User & {
        memberships: OrganizationMembership[];
      })
    | null
  > {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        memberships: { some: { organizationId } },
      },
      include: {
        memberships: {
          where: { organizationId },
          take: 1,
        },
      },
    });
  }

  async getProfile(
    userId: string,
    organizationId: string,
  ): Promise<{
    id: string;
    email: string;
    name: string | null;
    status: UserStatus;
    lastLoginAt: Date | null;
    organization: Pick<Organization, 'id' | 'name' | 'slug' | 'plan'>;
    membership: Pick<OrganizationMembership, 'id' | 'role'>;
  } | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        memberships: { some: { organizationId } },
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        lastLoginAt: true,
        memberships: {
          where: { organizationId },
          take: 1,
          select: {
            id: true,
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.memberships.length === 0) {
      return null;
    }

    const [membership] = user.memberships;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      lastLoginAt: user.lastLoginAt ?? null,
      organization: membership.organization,
      membership: {
        id: membership.id,
        role: membership.role,
      },
    };
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async listOrganizations(userId: string) {
    return this.prisma.organizationMembership.findMany({
      where: { userId },
      select: {
        id: true,
        role: true,
        isDefault: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getMembership(userId: string, organizationId: string) {
    return this.prisma.organizationMembership.findFirst({
      where: { userId, organizationId },
    });
  }
}
