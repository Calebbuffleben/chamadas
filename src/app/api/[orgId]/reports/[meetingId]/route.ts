import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withOrganization } from "@/lib/api-middleware";
import { format as formatDate } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  return withOrganization(req, async (req, orgId) => {
    try {
      const meeting = await prisma.externalMeeting.findFirst({
        where: {
          id: params.meetingId,
          organizationId: orgId,
        },
        include: {
          attendances: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!meeting) {
        return new NextResponse("Meeting not found", { status: 404 });
      }

      const format = req.nextUrl.searchParams.get("format") || "json";

      const attendanceData = meeting.attendances.map((attendance) => ({
        name: attendance.user.name,
        email: attendance.user.email,
        joinedAt: formatDate(attendance.joinedAt, "yyyy-MM-dd HH:mm:ss"),
        leftAt: attendance.leftAt ? formatDate(attendance.leftAt, "yyyy-MM-dd HH:mm:ss") : null,
        duration: attendance.leftAt
          ? Math.round((attendance.leftAt.getTime() - attendance.joinedAt.getTime()) / 1000 / 60)
          : null,
        isActive: attendance.isActive,
        disconnects: attendance.disconnects,
        totalEngagementTime: attendance.totalEngagementTime,
        timeInMeeting: attendance.timeInMeeting,
        engagementScore: attendance.engagementScore,
      }));

      if (format === "csv") {
        const headers = [
          "Name",
          "Email",
          "Joined At",
          "Left At",
          "Duration (minutes)",
          "Active",
          "Disconnects",
          "Total Engagement Time (minutes)",
          "Time in Meeting (minutes)",
          "Engagement Score",
        ];

        const csvRows = [
          headers.join(","),
          ...attendanceData.map((row) =>
            [
              row.name,
              row.email,
              row.joinedAt,
              row.leftAt,
              row.duration,
              row.isActive,
              row.disconnects,
              row.totalEngagementTime,
              row.timeInMeeting,
              row.engagementScore,
            ].join(",")
          ),
        ];

        const csv = csvRows.join("\n");

        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="meeting-report-${meeting.id}.csv"`,
          },
        });
      }

      return NextResponse.json(attendanceData);
    } catch (error) {
      console.error("Error generating report:", error);
      return new NextResponse("Internal Server Error", { status: 500 });
    }
  });
} 