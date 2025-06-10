import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getZoomToken } from "@/lib/zoom";
import { prisma } from "@/lib/prisma";
import { withOrganization } from "@/lib/api-middleware";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return withOrganization(request, async (req, orgId) => {
    try {
      const session = await auth();
      if (!session.userId) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const { searchParams } = new URL(request.url);
      const code = searchParams.get("code");
      const state = searchParams.get("state");

      if (!code || !state) {
        return new NextResponse("Invalid request", { status: 400 });
      }

      const { userId: stateUserId, orgId: stateOrgId } = JSON.parse(state);
      if (stateUserId !== session.userId || stateOrgId !== orgId) {
        return new NextResponse("Invalid state", { status: 400 });
      }

      const tokens = await getZoomToken(code);

      await prisma.user.update({
        where: { 
          id: session.userId,
          organizationId: orgId,
        },
        data: {
          zoomAccessToken: tokens.access_token,
          zoomRefreshToken: tokens.refresh_token,
          zoomTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      });

      return NextResponse.redirect(new URL(`/${orgId}/dashboard`, request.url));
    } catch (error) {
      console.error("[ZOOM_CALLBACK]", error);
      return new NextResponse("Internal Error", { status: 500 });
    }
  });
} 