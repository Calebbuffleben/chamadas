export type OrganizationSummary = {
  organizationId: string;
  membershipId: string;
  name: string;
  slug: string;
  plan: string | null;
  role: string;
  isDefault: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  lastLoginAt: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string | null;
  };
  membership: {
    id: string;
    role: string;
  };
};

export type SessionPayload = {
  user: UserProfile;
  organizations: OrganizationSummary[];
  currentOrganizationId: string;
  accessToken: string;
};

export type AuthResultPayload = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: {
    id: string;
    email: string;
    name: string | null;
    organizationId: string;
    membershipId: string;
    role: string;
  };
};

