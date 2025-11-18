import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../api-connection/config';
import type { SessionPayload } from './types';
import { buildSessionPayload } from './session-utils';

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!accessToken || !refreshToken) {
    return null;
  }

  try {
    return await buildSessionPayload(accessToken);
  } catch {
    return null;
  }
}

