import { NextRequest, NextResponse } from 'next/server';
import {
  BackendRequestError,
  backendFetch,
  setAuthCookies,
  setCurrentOrganizationCookie,
} from '@/lib/api-connection/server';
import type { AuthResultPayload, SessionPayload } from '@/lib/auth/types';
import { buildSessionPayload } from '@/lib/auth/session-utils';

export async function POST(req: NextRequest) {
  const { membershipId } = (await req.json()) as { membershipId?: string };
  if (!membershipId) {
    return NextResponse.json({ message: 'membershipId is required' }, { status: 400 });
  }

  let authResult: AuthResultPayload;
  try {
    const backendResponse = await backendFetch('/auth/switch', {
      method: 'POST',
      body: { membershipId },
    });
    authResult = (await backendResponse.json()) as AuthResultPayload;
  } catch (error) {
    if (error instanceof BackendRequestError) {
      return NextResponse.json(error.body ?? { message: error.message }, { status: error.status });
    }
    throw error;
  }
  let sessionPayload: SessionPayload;
  try {
    sessionPayload = await buildSessionPayload(authResult.accessToken, authResult.user.organizationId);
  } catch (error) {
    if (error instanceof BackendRequestError) {
      return NextResponse.json(error.body ?? { message: error.message }, { status: error.status });
    }
    throw error;
  }

  const response = NextResponse.json(sessionPayload);
  setAuthCookies(response, {
    accessToken: authResult.accessToken,
    refreshToken: authResult.refreshToken,
    accessTtl: authResult.accessTokenExpiresIn,
    refreshTtl: authResult.refreshTokenExpiresIn,
  });
  setCurrentOrganizationCookie(response, authResult.user.organizationId);
  return response;
}

