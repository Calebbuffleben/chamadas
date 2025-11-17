import type { OrganizationRole } from '@prisma/client';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: {
    id: string;
    email: string;
    name?: string | null;
    organizationId: string;
    membershipId: string;
    role: OrganizationRole;
  };
}
