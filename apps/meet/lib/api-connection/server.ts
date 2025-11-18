import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  BACKEND_BASE_URL,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  CURRENT_ORG_COOKIE,
  COOKIE_PATH,
  isSecureCookie,
} from './config';
import type { BackendFetchOptions } from './types';

export class BackendRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'BackendRequestError';
  }
}

export async function backendFetch(
  path: string,
  { body, auth = true, accessToken, throwOnError = true, headers, ...init }: BackendFetchOptions = {},
) {
  const url = new URL(path, BACKEND_BASE_URL);
  const resolvedHeaders = new Headers(headers);
  if (body !== undefined && !(body instanceof FormData)) {
    resolvedHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    let token = accessToken;
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
    }
    if (token) {
      resolvedHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers: resolvedHeaders,
    body:
      body === undefined || body instanceof FormData
        ? (body as RequestInit['body'])
        : JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok && throwOnError) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }
    throw new BackendRequestError(
      `Backend request failed with status ${response.status}`,
      response.status,
      payload,
    );
  }

  return response;
}

export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; accessTtl: number; refreshToken: string; refreshTtl: number },
) {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: tokens.accessToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(),
    maxAge: tokens.accessTtl,
    path: COOKIE_PATH,
  });
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: tokens.refreshToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureCookie(),
    maxAge: tokens.refreshTtl,
    path: COOKIE_PATH,
  });
}

export function setCurrentOrganizationCookie(response: NextResponse, organizationId: string) {
  response.cookies.set({
    name: CURRENT_ORG_COOKIE,
    value: organizationId,
    httpOnly: false,
    sameSite: 'lax',
    secure: isSecureCookie(),
    maxAge: 60 * 60 * 24 * 30,
    path: COOKIE_PATH,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  response.cookies.delete(CURRENT_ORG_COOKIE);
}

