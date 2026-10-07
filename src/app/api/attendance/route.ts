import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode");

    // =========================================================================
    // ADMIN COHORT & SESSION MANAGEMENT
    // =========================================================================
    if (session.role === "ADMIN") {
      // 1. Sessions List Mode
      if (mode === "sessions" || !mode) {
        const sessions = await prisma.courseSession.findMany({
          orderBy: { startTime: "desc" },
          include: {
            _count: { select: { attendances: true } },
            faculty: { select: { id: true, name: true, email: true } },
          },
          take: 50,
        });

        const totalStudents = await prisma.user.count({ where: { role: "STUDENT" } });
        const totalCheckins = await prisma.attendance.count();
        const totalSessions = sessions.length;

        const overallRate =
          totalSessions > 0 && totalStudents > 0
            ? Number(((totalCheckins / (totalSessions * totalStudents)) * 100).toFixed(1))
            : 85.0;

        return NextResponse.json({
          overallRate,
          totalSessions,
          totalCheckins,
          totalStudents,
          sessions,
        });
      }

      // 2. Daily Sheet / Students Roster for Manual Override Modal
      if (mode === "dailySheet" || mode === "roster") {
        const students = await prisma.user.findMany({
          where: { role: "STUDENT" },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            courseLevel: true,
            section: true,
          },
        });

        return NextResponse.json({ students });
      }

      // 3. Detailed Anti-Fraud Audit Logs
      if (mode === "logs") {
        const logs = await prisma.attendance.findMany({
          orderBy: { timestamp: "desc" },
          take: 100,
          include: {
            session: {
              select: {
                id: true,
                courseCode: true,
                courseName: true,
                radiusMeters: true,
              },
            },
          },
        });

        return NextResponse.json({ logs });
      }
    }

    // =========================================================================
    // STUDENT VIEW: INDIVIDUAL ATTENDANCE LEDGER & AUDIT LOGS
    // =========================================================================
    const studentId = session.id;

    const [studentAttendances, totalSessions] = await Promise.all([
      prisma.attendance.findMany({
        where: { studentId },
        orderBy: { timestamp: "desc" },
        include: {
          session: {
            select: {
              id: true,
              courseCode: true,
              courseName: true,
              date: true,
              startTime: true,
              endTime: true,
              radiusMeters: true,
            },
          },
        },
      }),
      prisma.courseSession.count(),
    ]);

    const presentCount = studentAttendances.length;
    const overallRate =
      totalSessions > 0
        ? Number(((presentCount / totalSessions) * 100).toFixed(1))
        : 100;

    return NextResponse.json({
      overallRate,
      totalSessions,
      presentCount,
      logs: studentAttendances,
    });
  } catch (error: any) {
    console.error("Attendance API fetch error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST: Faculty Create New Course Session with Geofencing
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator privilege required" }, { status: 403 });
    }

    const body = await request.json();
    const {
      courseCode,
      courseName,
      targetLatitude,
      targetLongitude,
      radiusMeters = 50.0,
      startTime,
      endTime,
    } = body;

    if (!courseCode || targetLatitude == null || targetLongitude == null) {
      return NextResponse.json(
        { error: "Missing required parameters (courseCode, targetLatitude, targetLongitude)" },
        { status: 400 }
      );
    }

    const now = new Date();
    const sStart = startTime ? new Date(startTime) : now;
    const sEnd = endTime ? new Date(endTime) : new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours default

    const newSession = await prisma.courseSession.create({
      data: {
        courseCode,
        courseName: courseName || "Japanese Course Lecture",
        facultyId: session.id,
        date: now,
        startTime: sStart,
        endTime: sEnd,
        targetLatitude: Number(targetLatitude),
        targetLongitude: Number(targetLongitude),
        radiusMeters: Number(radiusMeters) || 50.0,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Course session created successfully.",
      session: newSession,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Session creation error:", error);
    return NextResponse.json({ error: error.message || "Failed to create session" }, { status: 500 });
  }
}
