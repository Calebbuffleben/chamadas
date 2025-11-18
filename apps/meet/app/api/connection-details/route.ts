import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/api-connection/server';
import type { ConnectionDetails } from '@/lib/types';

type ConnectionRequestBody = {
  meetingId?: string;
  participantName?: string;
  identity?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ConnectionRequestBody;
  if (!body.meetingId || !body.participantName || !body.identity) {
    return NextResponse.json(
      { message: 'meetingId, identity e participantName são obrigatórios' },
      { status: 400 },
    );
  }

  // Ensure the backend has an active session placeholder for this meeting.
  const search = new URLSearchParams({ roomName: body.meetingId });
  await backendFetch(`/sessions/resolve?${search.toString()}`, {
    method: 'GET',
    throwOnError: false,
  });

  const response = await backendFetch(`/meetings/${body.meetingId}/token`, {
    method: 'POST',
    body: {
      participantName: body.participantName,
      identity: body.identity,
      metadata: body.metadata,
      organizationId: body.organizationId,
    },
    throwOnError: false,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  }

  const payload = (await response.json()) as {
    serverUrl: string;
    roomName: string;
    participantToken: string;
  };

  const connectionDetails: ConnectionDetails = {
    serverUrl: payload.serverUrl,
    roomName: payload.roomName,
    participantToken: payload.participantToken,
    participantName: body.participantName,
  };

  return NextResponse.json(connectionDetails);
}
