import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { auth } from "@clerk/nextjs/server";

export type NextApiResponseWithSocket = NextApiResponse & {
  socket: {
    server: NetServer & {
      io?: SocketIOServer;
    };
  };
};

interface UserPresence {
  userId: string;
  orgId: string;
  isActive: boolean;
  lastActive: Date;
}

interface MeetingState {
  participants: Map<string, UserPresence>;
  startTime: Date;
  organizationId: string;
}

const meetings = new Map<string, MeetingState>();

let io: SocketIOServer;

export function initSocketServer(httpServer: NetServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const orgId = socket.handshake.auth.orgId;

      if (!token || !orgId) {
        return next(new Error("Authentication error"));
      }

      const session = await auth();
      const { userId, orgId: sessionOrgId } = session;

      if (!userId || !sessionOrgId || sessionOrgId !== orgId) {
        return next(new Error("Unauthorized"));
      }

      socket.data.userId = userId;
      socket.data.orgId = orgId;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-meeting', async ({ meetingId }) => {
      try {
        const { userId, orgId } = socket.data;

        const meeting = await prisma.externalMeeting.findFirst({
          where: {
            id: meetingId,
            organizationId: orgId,
          },
        });

        if (!meeting) {
          socket.emit("error", "Meeting not found");
          return;
        }

        socket.join(`meeting:${meetingId}`);

        const attendance = await prisma.attendance.create({
          data: {
            userId,
            meetingId,
            joinedAt: new Date(),
            wasActive: true,
          },
          include: {
            user: true,
          },
        });

        // Initialize meeting state if not exists
        if (!meetings.has(meetingId)) {
          meetings.set(meetingId, {
            participants: new Map(),
            startTime: new Date(),
            organizationId: orgId,
          });
        }

        const meetingState = meetings.get(meetingId)!;
        meetingState.participants.set(userId, {
          userId,
          orgId,
          isActive: true,
          lastActive: new Date(),
        });

        io.to(`meeting:${meetingId}`).emit("user-joined", attendance);
      } catch (error) {
        console.error("Error joining meeting:", error);
        socket.emit("error", "Failed to join meeting");
      }
    });

    socket.on('update-presence', async ({ meetingId, isActive: wasActive }) => {
      try {
        const { userId, orgId } = socket.data;

        const meeting = await prisma.externalMeeting.findFirst({
          where: {
            id: meetingId,
            organizationId: orgId,
          },
        });

        if (!meeting) {
          socket.emit("error", "Meeting not found");
          return;
        }

        const meetingState = meetings.get(meetingId);
        if (!meetingState || meetingState.organizationId !== orgId) {
          socket.emit("error", "Invalid meeting state");
          return;
        }

        const attendance = await prisma.attendance.findUnique({
          where: {
            userId_meetingId: {
              userId,
              meetingId,
            },
          },
        });

        if (!attendance) {
          socket.emit("error", "Attendance record not found");
          return;
        }

        const updatedAttendance = await prisma.attendance.update({
          where: {
            id: attendance.id,
          },
          data: {
            wasActive,
            disconnects: wasActive ? attendance.disconnects : attendance.disconnects + 1,
            totalEngagementTime: wasActive
              ? attendance.totalEngagementTime + 1
              : attendance.totalEngagementTime,
          },
          include: {
            user: true,
          },
        });

        // Update meeting state
        const participant = meetingState.participants.get(userId);
        if (participant) {
          participant.isActive = wasActive;
          participant.lastActive = new Date();
        }

        io.to(`meeting:${meetingId}`).emit("presence-updated", updatedAttendance);
      } catch (error) {
        console.error("Error updating presence:", error);
        socket.emit("error", "Failed to update presence");
      }
    });

    socket.on('leave-meeting', async ({ meetingId }) => {
      try {
        const { userId, orgId } = socket.data;

        const meeting = await prisma.externalMeeting.findFirst({
          where: {
            id: meetingId,
            organizationId: orgId,
          },
        });

        if (!meeting) {
          socket.emit("error", "Meeting not found");
          return;
        }

        const meetingState = meetings.get(meetingId);
        if (!meetingState || meetingState.organizationId !== orgId) {
          socket.emit("error", "Invalid meeting state");
          return;
        }

        const attendance = await prisma.attendance.findUnique({
          where: {
            userId_meetingId: {
              userId,
              meetingId,
            },
          },
        });

        if (!attendance) {
          socket.emit("error", "Attendance record not found");
          return;
        }

        const updatedAttendance = await prisma.attendance.update({
          where: {
            id: attendance.id,
          },
          data: {
            leftAt: new Date(),
            wasActive: false,
            timeInMeeting: Math.round(
              (new Date().getTime() - attendance.joinedAt.getTime()) / 1000 / 60
            ),
            engagementScore: Math.round(
              (attendance.totalEngagementTime /
                Math.round(
                  (new Date().getTime() - attendance.joinedAt.getTime()) / 1000 / 60
                )) *
                100
            ),
          },
          include: {
            user: true,
          },
        });

        // Remove participant from meeting state
        meetingState.participants.delete(userId);

        // Clean up meeting state if no participants left
        if (meetingState.participants.size === 0) {
          meetings.delete(meetingId);
        }

        io.to(`meeting:${meetingId}`).emit("user-left", updatedAttendance);
        socket.leave(`meeting:${meetingId}`);
      } catch (error) {
        console.error("Error leaving meeting:", error);
        socket.emit("error", "Failed to leave meeting");
      }
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected:', socket.id);
      // Handle any cleanup if needed
    });
  });

  return io;
}

export function getSocketServer() {
  if (!io) {
    throw new Error("Socket server not initialized");
  }
  return io;
} 