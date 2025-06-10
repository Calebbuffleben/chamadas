import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/microsoft-auth';

export async function GET() {
  try {
    const authUrl = await getAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Microsoft auth:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 