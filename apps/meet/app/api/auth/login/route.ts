import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_BASE_URL } from '@/lib/api-connection/config';
import {
  BackendRequestError,
  setAuthCookies,
  setCurrentOrganizationCookie,
} from '@/lib/api-connection/server';
import type { AuthResultPayload, SessionPayload } from '@/lib/auth/types';
import { buildSessionPayload } from '@/lib/auth/session-utils';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const backendResponse = await fetch(new URL('/auth/login', BACKEND_BASE_URL).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': req.headers.get('user-agent') ?? 'meet-app',
    },
    body: JSON.stringify(body),
  });

  if (!backendResponse.ok) {
    const errorPayload = await backendResponse.json().catch(() => ({}));
    return NextResponse.json(errorPayload, { status: backendResponse.status });
  }

  const authResult = (await backendResponse.json()) as AuthResultPayload;
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


