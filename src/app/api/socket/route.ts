import { NextResponse } from 'next/server';
import { initSocket } from '@/lib/socket';

export async function GET(req: Request, res: any) {
  try {
    const io = initSocket(res);
    return new NextResponse('Socket.IO server initialized', { status: 200 });
  } catch (error) {
    console.error('Error initializing Socket.IO:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 