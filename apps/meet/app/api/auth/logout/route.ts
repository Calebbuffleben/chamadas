import { NextRequest, NextResponse } from 'next/server';
import {
  BACKEND_BASE_URL,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/api-connection/config';
import { clearAuthCookies } from '@/lib/api-connection/server';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    await fetch(new URL('/auth/logout', BACKEND_BASE_URL).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}


