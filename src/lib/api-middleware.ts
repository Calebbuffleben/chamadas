import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimitMiddleware, securityHeadersMiddleware } from "./rate-limit";

export async function withOrganization(
  req: NextRequest,
  handler: (req: NextRequest, orgId: string) => Promise<NextResponse>
) {
  try {
    // Apply rate limiting
    const rateLimitResponse = rateLimitMiddleware(req);
    if (rateLimitResponse) return rateLimitResponse;

    const session = await auth();
    const { orgId } = session;

    if (!orgId) {
      return new NextResponse("Unauthorized - No organization selected", { status: 401 });
    }

    // Extract organization ID from the URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const urlOrgId = pathParts[2]; // /api/[orgId]/...

    if (urlOrgId !== orgId) {
      return new NextResponse("Unauthorized - Invalid organization", { status: 401 });
    }

    const response = await handler(req, orgId);
    return securityHeadersMiddleware(response);
  } catch (error) {
    console.error("API Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 