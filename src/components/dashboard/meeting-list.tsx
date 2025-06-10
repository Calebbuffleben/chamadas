import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOrganization } from "@clerk/nextjs";

interface Meeting {
  id: string;
  topic: string;
  startAt: string;
  endAt: string;
  platform: "teams" | "zoom";
  activeParticipants: number;
}

export function MeetingList() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const { organization } = useOrganization();

  useEffect(() => {
    if (!organization) return;

    const fetchMeetings = async () => {
      try {
        const response = await fetch(`/api/${organization.id}/microsoft/meetings`);
        const data = await response.json();
        setMeetings(data);
      } catch (error) {
        console.error("Failed to fetch meetings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
    const interval = setInterval(fetchMeetings, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [organization]);

  if (!organization) return null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meetings</CardTitle>
          <CardDescription>Loading meetings...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Meetings</CardTitle>
        <CardDescription>Your upcoming and active meetings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No meetings found</p>
        ) : (
          meetings.map((meeting) => (
            <div key={meeting.id} className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{meeting.topic}</h3>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(meeting.startAt), "PPp", { locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {meeting.platform === "teams" ? "Teams" : "Zoom"}
                </Badge>
                <Badge variant="outline">
                  {meeting.activeParticipants} participants
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
} 