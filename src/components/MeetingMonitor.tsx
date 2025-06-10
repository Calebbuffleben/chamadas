import { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useUser } from '@clerk/nextjs';

interface MeetingMonitorProps {
  meetingId: string;
  onConnectionStatusChange?: (isConnected: boolean) => void;
}

export function MeetingMonitor({ meetingId, onConnectionStatusChange }: MeetingMonitorProps) {
  const { socket, isConnected } = useSocket(meetingId);
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onConnectionStatusChange?.(isConnected);
  }, [isConnected, onConnectionStatusChange]);

  useEffect(() => {
    if (!socket || !user) return;

    // Join meeting with user info
    socket.emit('join-meeting', {
      meetingId,
      userInfo: {
        email: user.emailAddresses[0]?.emailAddress || 'guest@example.com',
        name: user.fullName || 'Guest User',
      },
    });

    // Set up presence tracking
    const handleVisibilityChange = () => {
      socket.emit('update-presence', {
        isActive: !document.hidden,
      });
    };

    // Track tab visibility
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial presence update
    handleVisibilityChange();

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      socket.emit('leave-meeting');
    };
  }, [meetingId, socket, user]);

  if (error) {
    console.error('MeetingMonitor error:', error);
  }

  return null; // This component doesn't render anything
} 