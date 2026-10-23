import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateDynamicToken } from "@/lib/attendance-security";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: Returns current rotating token, or indicates session is ended/expired
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

    const now = new Date();
    const isExpired = session.isEnded || now > new Date(session.endTime);

    // If expired or manually ended, do NOT issue any active QR token
    if (isExpired) {
      return NextResponse.json({
        isExpired: true,
        isEnded: session.isEnded,
        token: null,
        message: session.isEnded
          ? "Attendance session was closed by the instructor."
          : "Attendance session has expired. The scheduled time window has ended.",
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
    }

    const token = generateDynamicToken(session.id, session.secretKey);

    return NextResponse.json({
      isExpired: false,
      isEnded: false,
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

// POST: Faculty End Session Immediately
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const sessionAuth = await getSessionFromRequest(req);
    if (!sessionAuth || sessionAuth.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator or Faculty privileges required" }, { status: 403 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await req.json().catch(() => ({}));
    if (body.action === "END_SESSION" || !body.action) {
      const updated = await prisma.courseSession.update({
        where: { id },
        data: {
          isEnded: true,
          endTime: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Attendance session successfully ended and closed.",
        session: updated,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("End session error:", error);
    return NextResponse.json({ error: error.message || "Failed to end session" }, { status: 500 });
  }
}
