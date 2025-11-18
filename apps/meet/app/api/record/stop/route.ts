import { NextRequest, NextResponse } from 'next/server';
import { backendFetch } from '@/lib/api-connection/server';

export async function POST(req: NextRequest) {
  const { roomName } = (await req.json()) as { roomName?: string };
  if (!roomName) {
    return NextResponse.json({ message: 'roomName é obrigatório' }, { status: 400 });
  }

  const response = await backendFetch('/recordings/stop', {
    method: 'POST',
    body: { roomName },
    throwOnError: false,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  }

  return NextResponse.json(await response.json().catch(() => ({ ok: true })));
}
