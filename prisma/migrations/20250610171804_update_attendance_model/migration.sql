/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `lastActiveAt` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `wasActive` on the `Attendance` table. All the data in the column will be lost.
  - You are about to alter the column `engagementScore` on the `Attendance` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Made the column `joinedAt` on table `Attendance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `engagementScore` on table `Attendance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `timeInMeeting` on table `Attendance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `totalEngagementTime` on table `Attendance` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Attendance_joinedAt_idx";

-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "createdAt",
DROP COLUMN "duration",
DROP COLUMN "lastActiveAt",
DROP COLUMN "updatedAt",
DROP COLUMN "wasActive",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "joinedAt" SET NOT NULL,
ALTER COLUMN "engagementScore" SET NOT NULL,
ALTER COLUMN "engagementScore" SET DEFAULT 0,
ALTER COLUMN "engagementScore" SET DATA TYPE INTEGER,
ALTER COLUMN "timeInMeeting" SET NOT NULL,
ALTER COLUMN "timeInMeeting" SET DEFAULT 0,
ALTER COLUMN "totalEngagementTime" SET NOT NULL,
ALTER COLUMN "totalEngagementTime" SET DEFAULT 0;
