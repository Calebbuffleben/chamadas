import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Attendance, User } from "@prisma/client"
import { io } from "socket.io-client"

interface ParticipantListProps {
  meetingId: string
  initialAttendance: (Attendance & { user: User })[]
}

type AttendanceWithUser = Attendance & { user: User }

export function ParticipantList({ meetingId, initialAttendance }: ParticipantListProps) {
  const [attendance, setAttendance] = useState<AttendanceWithUser[]>(initialAttendance)

  useEffect(() => {
    const socket = io({
      path: "/api/socket",
    })

    socket.emit("join-meeting", { meetingId })

    socket.on("attendance-update", (updatedAttendance: AttendanceWithUser) => {
      setAttendance((current) => {
        const index = current.findIndex(
          (a) => a.userId === updatedAttendance.userId
        )
        if (index === -1) {
          return [...current, updatedAttendance]
        }
        const newAttendance = [...current]
        newAttendance[index] = updatedAttendance
        return newAttendance
      })
    })

    return () => {
      socket.emit("leave-meeting")
      socket.disconnect()
    }
  }, [meetingId])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Participants</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {attendance.map((record) => (
            <div
              key={`${record.userId}-${record.joinedAt}`}
              className="flex items-center justify-between"
            >
              <div>
                <h3 className="font-medium">{record.user.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {record.user.email}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={record.wasActive ? "default" : "secondary"}>
                  {record.wasActive ? "Active" : "Inactive"}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {record.joinedAt && (
                    <div>
                      Joined: {format(new Date(record.joinedAt), "HH:mm")}
                    </div>
                  )}
                  {record.leftAt && (
                    <div>
                      Left: {format(new Date(record.leftAt), "HH:mm")}
                    </div>
                  )}
                  {record.duration && (
                    <div>
                      Duration: {formatDistanceToNow(record.duration * 1000, { locale: ptBR })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 