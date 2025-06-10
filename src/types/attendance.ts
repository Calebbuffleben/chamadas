export type AttendanceAction = 'join' | 'leave' | 'update';

export interface AttendanceRecord {
  userId: string;
  meetingId: string;
  joinedAt: Date;
  leftAt?: Date;
  wasActive: boolean;
  duration?: number; // Duration in seconds
  engagementScore?: number; // 0-100 score based on activity
  lastActiveAt?: Date;
}

export interface UserPresence {
  userId: string;
  meetingId: string;
  isActive: boolean;
  lastActiveAt: Date;
} 