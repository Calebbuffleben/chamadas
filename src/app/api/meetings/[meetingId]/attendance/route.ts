import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { AttendanceAction } from '@/types/attendance';

export async function POST(
  request: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { action } = await request.json() as { action: AttendanceAction };
    const now = new Date();

    // Verify the meeting exists
    const meeting = await prisma.externalMeeting.findUnique({
      where: { id: params.meetingId },
    });

    if (!meeting) {
      return new NextResponse('Meeting not found', { status: 404 });
    }

    if (action === 'join') {
      // Create or update attendance record
      await prisma.attendance.upsert({
        where: {
          userId_meetingId: {
            userId: session.userId,
            meetingId: params.meetingId,
          },
        },
        create: {
          userId: session.userId,
          meetingId: params.meetingId,
          joinedAt: now,
          wasActive: true,
        },
        update: {
          joinedAt: now,
          wasActive: true,
        },
      });
    } else if (action === 'leave') {
      // Update attendance record with leave time
      const attendance = await prisma.attendance.findUnique({
        where: {
          userId_meetingId: {
            userId: session.userId,
            meetingId: params.meetingId,
          },
        },
      });

      if (attendance) {
        await prisma.attendance.update({
          where: {
            id: attendance.id,
          },
          data: {
            leftAt: now,
            wasActive: true,
          },
        });
      }
    } else {
      return new NextResponse('Invalid action', { status: 400 });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Error handling attendance:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 