import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  BACKEND_BASE_URL,
  CURRENT_ORG_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/api-connection/config';
import {
  BackendRequestError,
  clearAuthCookies,
  setAuthCookies,
  setCurrentOrganizationCookie,
} from '@/lib/api-connection/server';
import type { AuthResultPayload, SessionPayload } from '@/lib/auth/types';
import { buildSessionPayload } from '@/lib/auth/session-utils';

async function refreshTokens(refreshToken: string, userAgent?: string) {
  const response = await fetch(new URL('/auth/refresh', BACKEND_BASE_URL).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': userAgent ?? 'meet-app',
    },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AuthResultPayload;
}

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!accessToken || !refreshToken) {
    return NextResponse.json(null, { status: 401 });
  }

  const currentOrgCookie = req.cookies.get(CURRENT_ORG_COOKIE)?.value;

  try {
    const payload = await buildSessionPayload(accessToken, currentOrgCookie);
    const successResponse = NextResponse.json(payload);
    setCurrentOrganizationCookie(successResponse, payload.currentOrganizationId);
    return successResponse;
  } catch (error) {
    if (!(error instanceof BackendRequestError) || error.status !== 401) {
      throw error;
    }
  }

  const refreshed = await refreshTokens(refreshToken, req.headers.get('user-agent') ?? undefined);
  if (!refreshed) {
    const response = NextResponse.json(null, { status: 401 });
    clearAuthCookies(response);
    return response;
  }

  let payload: SessionPayload;
  try {
    payload = await buildSessionPayload(refreshed.accessToken, currentOrgCookie);
  } catch (sessionError) {
    if (sessionError instanceof BackendRequestError) {
      const response = NextResponse.json(sessionError.body ?? null, { status: sessionError.status });
      clearAuthCookies(response);
      return response;
    }
    throw sessionError;
  }

  const response = NextResponse.json(payload);
  setAuthCookies(response, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accessTtl: refreshed.accessTokenExpiresIn,
    refreshTtl: refreshed.refreshTokenExpiresIn,
  });
  setCurrentOrganizationCookie(response, payload.currentOrganizationId);
  return response;
}

