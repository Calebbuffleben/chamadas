import type { OrganizationRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  organizationId: string;
  membershipId: string;
  role: OrganizationRole;
  email: string;
  name?: string | null;
  iat?: number;
  exp?: number;
}
