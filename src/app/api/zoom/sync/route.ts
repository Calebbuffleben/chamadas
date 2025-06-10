import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getZoomMeetings, refreshZoomToken } from "@/lib/zoom";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        zoomAccessToken: true,
        zoomRefreshToken: true,
        zoomTokenExpiresAt: true,
      },
    });

    if (!user?.zoomAccessToken || !user?.zoomRefreshToken) {
      return new NextResponse("Zoom not connected", { status: 400 });
    }

    // Check if token needs refresh
    let accessToken = user.zoomAccessToken;
    if (user.zoomTokenExpiresAt && user.zoomTokenExpiresAt < new Date()) {
      const tokens = await refreshZoomToken(user.zoomRefreshToken);
      accessToken = tokens.access_token;

      await prisma.user.update({
        where: { id: userId },
        data: {
          zoomAccessToken: tokens.access_token,
          zoomRefreshToken: tokens.refresh_token,
          zoomTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });
    }

    // Fetch and store meetings
    const meetings = await getZoomMeetings(accessToken);
    
    for (const meeting of meetings) {
      await prisma.externalMeeting.upsert({
        where: {
          externalId_platform: {
            externalId: meeting.id,
            platform: "ZOOM",
          },
        },
        create: {
          externalId: meeting.id,
          platform: "ZOOM",
          topic: meeting.topic,
          startAt: new Date(meeting.start_time),
          endAt: new Date(new Date(meeting.start_time).getTime() + meeting.duration * 60000),
          createdById: userId,
        },
        update: {
          topic: meeting.topic,
          startAt: new Date(meeting.start_time),
          endAt: new Date(new Date(meeting.start_time).getTime() + meeting.duration * 60000),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ZOOM_SYNC]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 