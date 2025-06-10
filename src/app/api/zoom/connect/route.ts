import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { withOrganization } from "@/lib/api-middleware";
import { NextRequest } from "next/server";

const zoomConfig = {
  clientId: process.env.ZOOM_CLIENT_ID!,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/zoom/callback`,
};

export async function GET(request: NextRequest) {
  return withOrganization(request, async (req, orgId) => {
    try {
      const session = await auth();
      if (!session.userId) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const params = new URLSearchParams({
        response_type: "code",
        client_id: zoomConfig.clientId,
        redirect_uri: zoomConfig.redirectUri,
        state: JSON.stringify({ userId: session.userId, orgId }), // Pass both userId and orgId as state
      });

      const zoomAuthUrl = `https://zoom.us/oauth/authorize?${params.toString()}`;
      return NextResponse.json({ url: zoomAuthUrl });
    } catch (error) {
      console.error("[ZOOM_CONNECT]", error);
      return new NextResponse("Internal Error", { status: 500 });
    }
  });
} 