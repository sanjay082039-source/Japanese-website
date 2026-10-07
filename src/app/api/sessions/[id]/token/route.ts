import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateDynamicToken } from "@/lib/attendance-security";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const session = await prisma.courseSession.findUnique({
      where: { id },
      include: {
        _count: { select: { attendances: true } },
        attendances: {
          orderBy: { timestamp: "desc" },
          take: 50,
          select: {
            id: true,
            studentId: true,
            studentName: true,
            timestamp: true,
            distanceMeters: true,
            deviceHash: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const token = generateDynamicToken(session.id, session.secretKey);

    return NextResponse.json({
      token,
      attendanceCount: session._count.attendances,
      courseCode: session.courseCode,
      courseName: session.courseName,
      radiusMeters: session.radiusMeters,
      targetLatitude: session.targetLatitude,
      targetLongitude: session.targetLongitude,
      startTime: session.startTime,
      endTime: session.endTime,
      recentAttendances: session.attendances,
    });
  } catch (error: any) {
    console.error("Token generation error:", error);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
