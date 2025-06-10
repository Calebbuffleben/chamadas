import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ExternalMeeting } from "@prisma/client"

interface MeetingDetailsProps {
  meeting: ExternalMeeting
}

export function MeetingDetails({ meeting }: MeetingDetailsProps) {
  const handleDownload = async (format: "json" | "csv") => {
    const response = await fetch(`/api/reports/${meeting.id}?format=${format}`)
    if (format === "csv") {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `meeting-report-${meeting.id}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } else {
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `meeting-report-${meeting.id}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>{meeting.topic}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {meeting.platform === "TEAMS" ? "Teams" : "Zoom"}
              </Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDownload("json")}>
                  Download JSON
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownload("csv")}>
                  Download CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-medium">Start:</span>
            <span>{format(new Date(meeting.startAt), "PPp", { locale: ptBR })}</span>
          </div>
          {meeting.endAt && (
            <div className="flex items-center gap-2">
              <span className="font-medium">End:</span>
              <span>{format(new Date(meeting.endAt), "PPp", { locale: ptBR })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 