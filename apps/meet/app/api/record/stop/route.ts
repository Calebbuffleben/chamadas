import { EgressClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ROLES = new Set(['owner', 'admin', 'host']);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    await authorizeRequest(authHeader);

    const roomName = req.nextUrl.searchParams.get('roomName');

    if (roomName === null) {
      return new NextResponse('Missing roomName parameter', { status: 403 });
    }

    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;

    const hostURL = new URL(LIVEKIT_URL!);
    hostURL.protocol = 'https:';

    const egressClient = new EgressClient(hostURL.origin, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const activeEgresses = (await egressClient.listEgress({ roomName })).filter(
      (info) => info.status < 2,
    );
    if (activeEgresses.length === 0) {
      return new NextResponse('No active recording found', { status: 404 });
    }
    await Promise.all(activeEgresses.map((info) => egressClient.stopEgress(info.egressId)));

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

async function authorizeRequest(authorization: string): Promise<void> {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    throw new Error('BACKEND_URL is not configured');
  }
  const res = await fetch(`${backendUrl}/auth/me`, {
    headers: {
      Authorization: authorization,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Unauthorized');
  }
  const data = (await res.json()) as {
    membership?: { role?: string | null };
  };
  const role = data.membership?.role?.toLowerCase();
  if (!role || !ALLOWED_ROLES.has(role)) {
    throw new Error('Forbidden');
  }
}
