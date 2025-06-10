import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganization } from "@/lib/api-middleware";
import { auth } from "@clerk/nextjs/server";
import { getCachedResponse, setCachedResponse, generateCacheKey } from "@/lib/cache";

export async function GET(req: NextRequest) {
  return withOrganization(req, async (req, orgId) => {
    try {
      // Check cache first
      const cacheKey = generateCacheKey(req);
      const cachedResponse = getCachedResponse(cacheKey);
      if (cachedResponse) return cachedResponse;

      const meetings = await prisma.externalMeeting.findMany({
        where: {
          organizationId: orgId,
        },
        include: {
          attendances: {
            include: {
              user: true,
            },
          },
          createdBy: true,
        },
        orderBy: {
          startAt: "desc",
        },
      });

      // Cache the response
      setCachedResponse(cacheKey, meetings);

      return NextResponse.json(meetings);
    } catch (error) {
      console.error("Error fetching meetings:", error);
      return new NextResponse("Internal Server Error", { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withOrganization(req, async (req, orgId) => {
    try {
      const session = await auth();
      const { userId } = session;

      if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const body = await req.json();
      const { topic, startAt, endAt, platform, externalId } = body;

      const meeting = await prisma.externalMeeting.create({
        data: {
          topic,
          startAt: new Date(startAt),
          endAt: new Date(endAt),
          platform,
          externalId,
          organizationId: orgId,
          createdById: userId,
        },
        include: {
          createdBy: true,
        },
      });

      // Clear cache for meetings list
      const cacheKey = generateCacheKey(req);
      setCachedResponse(cacheKey, null);

      return NextResponse.json(meeting);
    } catch (error) {
      console.error("Error creating meeting:", error);
      return new NextResponse("Internal Server Error", { status: 500 });
    }
  });
} 