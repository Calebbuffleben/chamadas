import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateMeetingSchema = z.object({
  title: z.string().min(1).optional(),
  platform: z.enum(["ZOOM", "TEAMS"]).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const meeting = await prisma.meeting.findUnique({
      where: {
        id: params.meetingId,
        createdById: userId,
      },
      include: {
        presences: true,
      },
    });

    if (!meeting) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.json(meeting);
  } catch (error) {
    console.error("[MEETING_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const validatedData = updateMeetingSchema.parse(body);

    const meeting = await prisma.meeting.update({
      where: {
        id: params.meetingId,
        createdById: userId,
      },
      data: validatedData,
    });

    return NextResponse.json(meeting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse("Invalid request data", { status: 400 });
    }
    console.error("[MEETING_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { meetingId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await prisma.meeting.delete({
      where: {
        id: params.meetingId,
        createdById: userId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[MEETING_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 