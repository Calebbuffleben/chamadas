import { NextRequest, NextResponse } from "next/server";
import { withOrganization } from "@/lib/api-middleware";
import { initSocketServer } from "@/lib/socket";
import { Server as HTTPServer } from "http";

let io: any;

export async function GET(req: NextRequest) {
  return withOrganization(req, async (req, orgId) => {
    try {
      if (!io) {
        const httpServer = (req as any).socket.server as HTTPServer;
        io = initSocketServer(httpServer);
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error initializing socket:", error);
      return new NextResponse("Internal Server Error", { status: 500 });
    }
  });
} 