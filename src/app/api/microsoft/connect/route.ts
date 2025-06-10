import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/microsoft-auth";
import { withOrganization } from "@/lib/api-middleware";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return withOrganization(request, async (req, orgId) => {
    try {
      const session = await auth();
      if (!session.userId) {
        return new NextResponse("Unauthorized", { status: 401 });
      }

      const state = JSON.stringify({ userId: session.userId, orgId });
      const authUrl = await getAuthUrl();
      const urlWithState = `${authUrl}&state=${encodeURIComponent(state)}`;

      return NextResponse.json({ url: urlWithState });
    } catch (error) {
      console.error("[MICROSOFT_CONNECT]", error);
      return new NextResponse("Internal Error", { status: 500 });
    }
  });
} 