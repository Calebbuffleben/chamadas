import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/microsoft-auth';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return new NextResponse('Missing code parameter', { status: 400 });
    }

    const accessToken = await getAccessToken(code);

    // Store the access token in the database
    await prisma.user.update({
      where: { id: session.userId },
      data: {
        microsoftAccessToken: accessToken,
      },
    });

    // Redirect to the meetings page
    return NextResponse.redirect(new URL('/meetings', request.url));
  } catch (error) {
    console.error('Error in Microsoft callback:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 