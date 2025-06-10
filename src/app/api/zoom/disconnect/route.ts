import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { revokeZoomToken } from "@/lib/zoom";
import { prisma } from "@/lib/prisma";
import { withOrganization } from "@/lib/api-middleware";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return withOrganization(request, async (req, orgId) => {
    try {
      const session = await auth();
      if (!session.userId) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: {
          id: session.userId,
          organizationId: orgId,
        },
        select: {
          zoomAccessToken: true,
        },
      });

      if (!user?.zoomAccessToken) {
        return new NextResponse("Zoom not connected", { status: 400 });
      }

      // Revoke the token
      await revokeZoomToken(user.zoomAccessToken);

      // Clear Zoom tokens from user
      await prisma.user.update({
        where: {
          id: session.userId,
          organizationId: orgId,
        },
        data: {
          zoomAccessToken: null,
          zoomRefreshToken: null,
          zoomTokenExpiresAt: null,
        },
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("[ZOOM_DISCONNECT]", error);
      return new NextResponse("Internal Error", { status: 500 });
    }
  });
} 