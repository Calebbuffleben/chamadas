import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function orgMiddleware(auth: any, req: NextRequest) {
  // If user is not signed in, let Clerk handle it
  if (!auth.userId) {
    return NextResponse.next();
  }

  // If user has no org and is not on select-org page, redirect to select-org
  if (!auth.orgId && !req.nextUrl.pathname.startsWith('/select-org')) {
    const selectOrgUrl = new URL('/select-org', req.url);
    return NextResponse.redirect(selectOrgUrl);
  }

  // If user has an org and is on select-org page, redirect to their dashboard
  if (auth.orgId && req.nextUrl.pathname === '/select-org') {
    const orgUrl = new URL(`/${auth.orgId}/dashboard`, req.url);
    return NextResponse.redirect(orgUrl);
  }

  return NextResponse.next();
} 