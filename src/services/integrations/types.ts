export interface Meeting {
  id: string
  externalId: string
  topic: string
  startAt: Date
  endAt: Date
  platform: "ZOOM" | "TEAMS"
}

export interface Participant {
  id: string
  name: string
  email: string
  joinedAt: Date
  leftAt?: Date
  isActive: boolean
}

export interface IntegrationService {
  fetchMeetings(): Promise<Meeting[]>
  fetchParticipants(meetingId: string): Promise<Participant[]>
} 