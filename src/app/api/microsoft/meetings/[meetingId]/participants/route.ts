import { NextResponse } from 'next/server';
import { getGraphClient } from '@/lib/microsoft-auth';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { microsoftAccessToken: true },
    });

    if (!user?.microsoftAccessToken) {
      return new NextResponse('Microsoft not connected', { status: 400 });
    }

    const graphClient = getGraphClient(user.microsoftAccessToken);
    
    // Get meeting participants
    const meeting = await graphClient
      .api(`/me/events/${params.meetingId}`)
      .select('attendees')
      .get();

    // Get or create users for each participant
    const participants = await Promise.all(
      meeting.attendees.map(async (attendee: any) => {
        const user = await prisma.user.upsert({
          where: { email: attendee.emailAddress.address },
          create: {
            email: attendee.emailAddress.address,
            name: attendee.emailAddress.name,
            department: 'Unknown', // You might want to get this from Microsoft Graph API
          },
          update: {
            name: attendee.emailAddress.name,
          },
        });
        return user;
      })
    );

    return NextResponse.json(participants);
  } catch (error) {
    console.error('Error fetching meeting participants:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 