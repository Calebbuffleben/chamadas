import { MeetingDetails } from "@/components/meetings/meeting-details"
import { ParticipantList } from "@/components/meetings/participant-list"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"

interface MeetingPageProps {
  params: {
    id: string
  }
}

export default async function MeetingPage({ params }: MeetingPageProps) {
  const meeting = await prisma.externalMeeting.findUnique({
    where: { id: params.id },
    include: {
      attendances: {
        include: {
          user: true
        },
        orderBy: {
          joinedAt: 'desc'
        }
      }
    }
  })

  if (!meeting) {
    notFound()
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <MeetingDetails meeting={meeting} />
      <ParticipantList meetingId={meeting.id} initialAttendance={meeting.attendances} />
    </div>
  )
} 