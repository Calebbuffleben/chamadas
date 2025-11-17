import type { OrganizationRole } from '@prisma/client';

export interface AuthUser {
  userId: string;
  organizationId: string;
  membershipId: string;
  role: OrganizationRole;
  email: string;
  name?: string | null;
}
