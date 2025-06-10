import { IntegrationService, Meeting, Participant } from "./types"
import { prisma } from "@/lib/prisma"

export class TeamsService implements IntegrationService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async fetchMeetings(): Promise<Meeting[]> {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/me/calendar/events",
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error("Failed to fetch Teams meetings")
    }

    const data = await response.json()
    return data.value
      .filter((event: any) => event.onlineMeeting)
      .map((event: any) => ({
        id: event.id,
        externalId: event.onlineMeeting.joinUrl,
        topic: event.subject,
        startAt: new Date(event.start.dateTime),
        endAt: new Date(event.end.dateTime),
        platform: "TEAMS" as const,
      }))
  }

  async fetchParticipants(meetingId: string): Promise<Participant[]> {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/communications/callRecords/${meetingId}/participants`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error("Failed to fetch Teams participants")
    }

    const data = await response.json()
    return data.value.map((participant: any) => ({
      id: participant.id,
      name: participant.user.displayName,
      email: participant.user.email,
      joinedAt: new Date(participant.startDateTime),
      leftAt: participant.endDateTime ? new Date(participant.endDateTime) : undefined,
      isActive: !participant.endDateTime,
    }))
  }
} 