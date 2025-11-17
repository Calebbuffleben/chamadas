import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';

export type CreateOrganizationInput = {
  name: string;
  slug: string;
  plan?: string;
};

const ORGANIZATION_ROLES = {
  owner: 'owner',
  admin: 'admin',
  host: 'host',
  member: 'member',
} as const;
type OrganizationRole = (typeof ORGANIZATION_ROLES)[keyof typeof ORGANIZATION_ROLES];

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  async create(input: CreateOrganizationInput) {
    try {
      return await this.prismaClient.organization.create({
        data: {
          name: input.name.trim(),
          slug: input.slug,
          plan: input.plan ?? 'standard',
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Organization slug already in use');
      }
      throw error;
    }
  }

  async findBySlug(slug: string) {
    return this.prismaClient.organization.findUnique({ where: { slug } });
  }

  async getBySlugOrThrow(slug: string) {
    const organization = await this.findBySlug(slug);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async getByIdOrThrow(id: string) {
    const organization = await this.prismaClient.organization.findUnique({
      where: { id },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  async listMembers(organizationId: string) {
    return this.prismaClient.organizationMembership.findMany({
      where: { organizationId },
      select: {
        id: true,
        role: true,
        isDefault: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMemberRole(params: {
    organizationId: string;
    membershipId: string;
    role: OrganizationRole;
  }) {
    const { organizationId, membershipId, role } = params;
    return this.prismaClient.$transaction(
      async (tx: Parameters<Parameters<typeof this.prismaClient.$transaction>[0]>[0]) => {
        const membership = await tx.organizationMembership.findUnique({
          where: { id: membershipId },
        });
        if (!membership || membership.organizationId !== organizationId) {
          throw new NotFoundException('Membership not found in organization');
        }
        if (membership.role === ORGANIZATION_ROLES.owner && role !== ORGANIZATION_ROLES.owner) {
          const owners = await tx.organizationMembership.count({
            where: { organizationId, role: ORGANIZATION_ROLES.owner },
          });
          if (owners <= 1) {
            throw new ConflictException('Organization must have at least one owner');
          }
        }
        return tx.organizationMembership.update({
          where: { id: membershipId },
          data: { role },
        });
      },
    );
  }

  async getPlanLimits(organizationId: string) {
    const organization = await this.getByIdOrThrow(organizationId);
    const plan = organization.plan ?? 'standard';
    const limits =
      plan === 'enterprise'
        ? { maxMembers: 500, maxRooms: 200 }
        : plan === 'pro'
          ? { maxMembers: 150, maxRooms: 60 }
          : { maxMembers: 50, maxRooms: 20 };
    return {
      plan,
      limits,
    };
  }

  async createInvitation(input: {
    organizationId: string;
    email: string;
    role?: OrganizationRole;
    expiresInHours?: number;
    createdByUserId: string;
  }) {
    const expiresHours =
      input.expiresInHours && input.expiresInHours > 0 ? input.expiresInHours : 72;
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);
    const token = randomBytes(24).toString('hex');
    const tokenHash = this.hashToken(token);
    const invitation = await this.prismaClient.organizationInvitation.create({
      data: {
        organizationId: input.organizationId,
        email: input.email.toLowerCase(),
        role: input.role ?? ORGANIZATION_ROLES.member,
        tokenHash,
        expiresAt,
        createdByUserId: input.createdByUserId,
      },
    });
    return { invitation, token };
  }

  async getDefaultSecretOrThrow(organizationId: string) {
    const secret = await this.prismaClient.organizationSecret.findFirst({
      where: { organizationId },
    });
    if (!secret) {
      throw new NotFoundException('Organization does not have LiveKit credentials configured');
    }
    return secret;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    const known = error as { code?: string };
    return known.code === 'P2002';
  }
}
