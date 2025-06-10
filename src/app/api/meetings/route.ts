import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createMeetingSchema = z.object({
  title: z.string().min(1),
  platform: z.enum(["ZOOM", "TEAMS"]),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export async function GET() {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const meetings = await prisma.meeting.findMany({
      where: {
        createdById: userId,
      },
      include: {
        presences: true,
      },
      orderBy: {
        startAt: "desc",
      },
    });

    return NextResponse.json(meetings);
  } catch (error) {
    console.error("[MEETINGS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const validatedData = createMeetingSchema.parse(body);

    const meeting = await prisma.meeting.create({
      data: {
        ...validatedData,
        createdById: userId,
      },
    });

    return NextResponse.json(meeting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse("Invalid request data", { status: 400 });
    }
    console.error("[MEETINGS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 