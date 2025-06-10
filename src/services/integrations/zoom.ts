import { IntegrationService, Meeting, Participant } from "./types"

export class ZoomService implements IntegrationService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async fetchMeetings(): Promise<Meeting[]> {
    const response = await fetch(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error("Failed to fetch Zoom meetings")
    }

    const data = await response.json()
    return data.meetings.map((meeting: any) => ({
      id: meeting.id,
      externalId: meeting.join_url,
      topic: meeting.topic,
      startAt: new Date(meeting.start_time),
      endAt: new Date(meeting.start_time + meeting.duration * 60 * 1000),
      platform: "ZOOM" as const,
    }))
  }

  async fetchParticipants(meetingId: string): Promise<Participant[]> {
    const response = await fetch(
      `https://api.zoom.us/v2/report/meetings/${meetingId}/participants`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error("Failed to fetch Zoom participants")
    }

    const data = await response.json()
    return data.participants.map((participant: any) => ({
      id: participant.id,
      name: participant.name,
      email: participant.user_email,
      joinedAt: new Date(participant.join_time),
      leftAt: participant.leave_time ? new Date(participant.leave_time) : undefined,
      isActive: !participant.leave_time,
    }))
  }
} 