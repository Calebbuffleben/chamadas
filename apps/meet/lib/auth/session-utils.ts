import { cookies } from 'next/headers';
import { backendFetch } from '../api-connection/server';
import type { OrganizationSummary, SessionPayload, UserProfile } from './types';
import { CURRENT_ORG_COOKIE } from '../api-connection/config';

type TenantsResponse = {
  organizations: Array<{
    membershipId: string;
    role: string;
    isDefault: boolean;
    organization: {
      id: string;
      name: string;
      slug: string;
      plan: string | null;
    };
  }>;
};

export async function buildSessionPayload(
  accessToken: string,
  overrideOrganizationId?: string,
): Promise<SessionPayload> {
  const profileResponse = await backendFetch('/auth/me', {
    accessToken,
    throwOnError: true,
  });
  const profile = (await profileResponse.json()) as UserProfile;

  const tenantsResponse = await backendFetch('/auth/me/tenants', {
    accessToken,
    throwOnError: true,
  });
  const tenantsJson = (await tenantsResponse.json()) as TenantsResponse;
  const organizations: OrganizationSummary[] = tenantsJson.organizations.map((entry) => ({
    organizationId: entry.organization.id,
    membershipId: entry.membershipId,
    name: entry.organization.name,
    slug: entry.organization.slug,
    plan: entry.organization.plan,
    role: entry.role,
    isDefault: entry.isDefault,
  }));

  const cookieStore = await cookies();
  const cookieOrg = cookieStore.get(CURRENT_ORG_COOKIE)?.value;
  const currentOrganizationId = overrideOrganizationId ?? cookieOrg ?? profile.organization.id;

  return {
    user: profile,
    organizations,
    currentOrganizationId,
    accessToken,
  };
}


