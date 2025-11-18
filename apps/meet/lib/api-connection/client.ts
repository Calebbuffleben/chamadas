'use client';

import type { BackendFetchOptions } from './types';
import { BACKEND_BASE_URL } from './config';

export async function backendClientFetch(
  path: string,
  token: string,
  options: BackendFetchOptions = {},
) {
  const { body, headers, auth: _auth, accessToken: _accessToken, throwOnError: _throwOnError, ...init } =
    options;
  const url = new URL(path, BACKEND_BASE_URL);
  const resolvedHeaders = new Headers(headers);
  resolvedHeaders.set('Authorization', `Bearer ${token}`);
  if (body !== undefined && !(body instanceof FormData)) {
    resolvedHeaders.set('Content-Type', 'application/json');
  }

  return fetch(url.toString(), {
    ...init,
    headers: resolvedHeaders,
    body:
      body === undefined || body instanceof FormData
        ? (body as RequestInit['body'])
        : JSON.stringify(body),
  });
}

