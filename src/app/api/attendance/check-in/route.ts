import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyDynamicToken, calculateHaversineDistance } from "@/lib/attendance-security";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      token,
      latitude,
      longitude,
      deviceHash,
      studentId,
      studentName,
      isManualOverride,
    } = body;

    if (!sessionId || !studentId) {
      return NextResponse.json(
        { error: "Missing required parameters (sessionId, studentId)" },
        { status: 400 }
      );
    }

    // 1. Fetch Course Session
    const session = await prisma.courseSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Course session does not exist" }, { status: 404 });
    }

    // Handle Faculty Manual Override (Safety mode when student phone dies)
    if (isManualOverride) {
      const auth = await getSessionFromRequest(req);
      if (!auth || auth.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Unauthorized: Administrator or Faculty privileges required for manual override." },
          { status: 403 }
        );
      }

      // Check if already checked in
      const existingStudent = await prisma.attendance.findUnique({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId,
          },
        },
      });

      if (existingStudent) {
        return NextResponse.json(
          { error: "Attendance already recorded for this student ID." },
          { status: 400 }
        );
      }

      // Fetch student name if missing
      let finalStudentName = studentName;
      if (!finalStudentName) {
        const studentUser = await prisma.user.findUnique({
          where: { id: studentId },
          select: { name: true },
        });
        finalStudentName = studentUser?.name || "Student";
      }

      const overrideRecord = await prisma.attendance.create({
        data: {
          sessionId,
          studentId,
          studentName: finalStudentName,
          deviceHash: `MANUAL_OVERRIDE_${Date.now()}_${studentId.slice(-4)}`,
          ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1",
          clientLatitude: session.targetLatitude,
          clientLongitude: session.targetLongitude,
          distanceMeters: 0,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: "Manual attendance override recorded successfully by faculty.",
          attendance: overrideRecord,
        },
        { status: 201 }
      );
    }

    // Validate standard mobile scanner parameters
    if (!token || !deviceHash || latitude == null || longitude == null) {
      return NextResponse.json(
        { error: "Missing required scanner parameters (token, deviceHash, GPS coordinates)" },
        { status: 400 }
      );
    }

    // Validate Session Time Window
    const now = new Date();
    if (now < session.startTime || now > session.endTime) {
      return NextResponse.json(
        { error: "Attendance session is currently closed. Please contact your instructor." },
        { status: 400 }
      );
    }

    // 2. Anti-Screenshot Gate: Token Verification (~8-10s valid window)
    const isTokenValid = verifyDynamicToken(session.id, session.secretKey, token);
    if (!isTokenValid) {
      return NextResponse.json(
        {
          error: "QR token has expired. Scan the current live QR code on the classroom screen.",
        },
        { status: 400 }
      );
    }

    // 3. Geofence Gate: Distance Calculation via Haversine Formula
    const distance = calculateHaversineDistance(
      Number(latitude),
      Number(longitude),
      session.targetLatitude,
      session.targetLongitude
    );

    if (distance > session.radiusMeters) {
      return NextResponse.json(
        {
          error: `Out of classroom bounds. You are ${Math.round(distance)}m away (Maximum allowed radius: ${session.radiusMeters}m).`,
        },
        { status: 403 }
      );
    }

    // 4. Anti-Proxy Gate: Device Hardware Lock check
    const existingDevice = await prisma.attendance.findUnique({
      where: {
        sessionId_deviceHash: {
          sessionId,
          deviceHash,
        },
      },
    });

    if (existingDevice) {
      return NextResponse.json(
        {
          error: "Proxy detected: This physical device has already marked attendance for another student in this session.",
        },
        { status: 403 }
      );
    }

    // 5. Single Check-In: Duplicate Student Check
    const existingStudent = await prisma.attendance.findUnique({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId,
        },
      },
    });

    if (existingStudent) {
      return NextResponse.json(
        { error: "Attendance already recorded for this student ID." },
        { status: 400 }
      );
    }

    // 6. Record Verified Attendance
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    let finalStudentName = studentName;
    if (!finalStudentName) {
      const studentUser = await prisma.user.findUnique({
        where: { id: studentId },
        select: { name: true },
      });
      finalStudentName = studentUser?.name || "Student";
    }

    const attendanceRecord = await prisma.attendance.create({
      data: {
        sessionId,
        studentId,
        studentName: finalStudentName,
        deviceHash,
        ipAddress,
        clientLatitude: Number(latitude),
        clientLongitude: Number(longitude),
        distanceMeters: Math.round(distance),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Attendance recorded successfully",
        attendance: attendanceRecord,
        courseCode: session.courseCode,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Attendance Verification Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
