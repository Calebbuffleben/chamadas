import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { format as formatDate } from "date-fns"
import { ptBR } from "date-fns/locale"

export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const format = request.nextUrl.searchParams.get("format") || "json"

  const meeting = await prisma.externalMeeting.findUnique({
    where: { id: params.meetingId },
    include: {
      attendances: {
        include: {
          user: true
        },
        orderBy: {
          joinedAt: "desc"
        }
      }
    }
  })

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 })
  }

  const data = meeting.attendances.map((attendance) => ({
    name: attendance.user.name,
    email: attendance.user.email,
    joinedAt: attendance.joinedAt ? formatDate(attendance.joinedAt, "PPp", { locale: ptBR }) : null,
    leftAt: attendance.leftAt ? formatDate(attendance.leftAt, "PPp", { locale: ptBR }) : null,
    duration: attendance.duration ? `${Math.floor(attendance.duration / 60)} minutes` : null,
    wasActive: attendance.wasActive ? "Yes" : "No"
  }))

  if (format === "csv") {
    const headers = ["Name", "Email", "Joined At", "Left At", "Duration", "Was Active"]
    const csvRows = [
      headers.join(","),
      ...data.map((row) => [
        row.name,
        row.email,
        row.joinedAt || "",
        row.leftAt || "",
        row.duration || "",
        row.wasActive
      ].join(","))
    ].join("\n")

    return new NextResponse(csvRows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="meeting-report-${meeting.id}.csv"`
      }
    })
  }

  return NextResponse.json(data)
} 