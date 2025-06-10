import { NextResponse } from 'next/server';
import { getGraphClient } from '@/lib/microsoft-auth';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { withOrganization } from '@/lib/api-middleware';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return withOrganization(request, async (req, orgId) => {
    try {
      const session = await auth();
      if (!session?.userId) {
        return new NextResponse('Unauthorized', { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: { 
          id: session.userId,
          organizationId: orgId,
        },
        select: { microsoftAccessToken: true },
      });

      if (!user?.microsoftAccessToken) {
        return new NextResponse('Microsoft not connected', { status: 400 });
      }

      const graphClient = getGraphClient(user.microsoftAccessToken);
      
      // Get meetings for the next 7 days
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const meetings = await graphClient
        .api('/me/calendar/events')
        .filter(`start/dateTime ge '${startDate.toISOString()}' and end/dateTime le '${endDate.toISOString()}'`)
        .get();

      // Save meetings to database
      for (const meeting of meetings.value) {
        await prisma.externalMeeting.upsert({
          where: {
            externalId_platform: {
              externalId: meeting.id,
              platform: 'TEAMS',
            },
          },
          create: {
            externalId: meeting.id,
            platform: 'TEAMS',
            topic: meeting.subject,
            startAt: new Date(meeting.start.dateTime),
            endAt: new Date(meeting.end.dateTime),
            createdById: session.userId,
            organizationId: orgId,
          },
          update: {
            topic: meeting.subject,
            startAt: new Date(meeting.start.dateTime),
            endAt: new Date(meeting.end.dateTime),
          },
        });
      }

      return NextResponse.json(meetings.value);
    } catch (error) {
      console.error('Error fetching Microsoft meetings:', error);
      return new NextResponse('Internal Server Error', { status: 500 });
    }
  });
} 