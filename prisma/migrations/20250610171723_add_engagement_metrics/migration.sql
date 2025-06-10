-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "disconnects" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "engagementScore" DOUBLE PRECISION,
ADD COLUMN     "timeInMeeting" INTEGER,
ADD COLUMN     "totalEngagementTime" INTEGER;
