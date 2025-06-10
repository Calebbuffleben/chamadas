import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimitMiddleware, securityHeadersMiddleware } from "./lib/rate-limit";
import { orgMiddleware } from "./lib/org-middleware";

export default clerkMiddleware((auth, req: NextRequest) => {
  // Apply rate limiting
  const rateLimitResponse = rateLimitMiddleware(req);
  if (rateLimitResponse) return rateLimitResponse;

  // Apply organization handling
  const orgResponse = orgMiddleware(auth, req);
  if (orgResponse) return orgResponse;

  // Apply security headers
  const response = NextResponse.next();
  return securityHeadersMiddleware(response);
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}; 