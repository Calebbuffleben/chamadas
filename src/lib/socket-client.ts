import { io, Socket } from "socket.io-client";
import { useAuth, useOrganization } from "@clerk/nextjs";

let socket: Socket | null = null;

export function useSocket() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();

  const connect = async () => {
    if (socket?.connected) return;
    if (!organization?.id) return;

    const token = await getToken();
    if (!token) return;

    socket = io(process.env.NEXT_PUBLIC_APP_URL!, {
      auth: {
        token,
        orgId: organization.id,
      },
    });

    socket.on("connect", () => {
      console.log("Connected to socket server");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };

  const joinMeeting = (meetingId: string) => {
    if (!socket?.connected) return;
    socket.emit("join-meeting", { meetingId });
  };

  const updatePresence = (meetingId: string, isActive: boolean) => {
    if (!socket?.connected) return;
    socket.emit("update-presence", { meetingId, isActive });
  };

  const leaveMeeting = (meetingId: string) => {
    if (!socket?.connected) return;
    socket.emit("leave-meeting", { meetingId });
  };

  return {
    connect,
    disconnect,
    joinMeeting,
    updatePresence,
    leaveMeeting,
    socket,
  };
} 