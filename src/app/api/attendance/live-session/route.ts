import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET active session or check status & day-by-day historical records
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseLevel = searchParams.get("courseLevel");
    const section = searchParams.get("section");
    const dateStr = searchParams.get("date");

    const whereClause: any = { isOpen: true };
    if (courseLevel && courseLevel !== "ALL") whereClause.courseLevel = courseLevel;
    if (section && section !== "ALL") whereClause.section = section;

    const activeSession = await prisma.liveClassSession.findFirst({
      where: whereClause,
      include: {
        openedBy: { select: { id: true, name: true } },
        attendances: {
          select: {
            id: true,
            studentId: true,
            status: true,
            verifiedByBiometric: true,
            biometricVerifiedAt: true,
            remarks: true,
            student: { select: { id: true, name: true, email: true, courseLevel: true, section: true } },
          },
          orderBy: { biometricVerifiedAt: "desc" },
        },
      },
      orderBy: { openedAt: "desc" },
    });

    let dayRecords: any[] = [];
    if (dateStr && session.role === "ADMIN") {
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

      const queryWhere: any = {
        date: { gte: startOfDay, lte: endOfDay },
      };
      if (courseLevel && courseLevel !== "ALL") {
        queryWhere.student = { courseLevel };
      }
      if (section && section !== "ALL") {
        queryWhere.student = { ...queryWhere.student, section };
      }

      dayRecords = await prisma.attendance.findMany({
        where: queryWhere,
        include: {
          student: { select: { id: true, name: true, email: true, courseLevel: true, section: true } },
          liveSession: true,
        },
        orderBy: [{ hourSlot: "asc" }, { student: { name: "asc" } }],
      });
    }

    return NextResponse.json({ activeSession, dayRecords });
  } catch (error: any) {
    console.error("Live session query error:", error);
    return NextResponse.json({ error: error.message || "Failed to load live session" }, { status: 500 });
  }
}

// POST Open Class, Close Class, Biometric Scan, or Manual Override (Admin Only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin authority required." }, { status: 403 });
    }

    const body = await request.json();
    const { action, courseLevel, section, hourSlot, subject, sessionId, studentId, status, remarks } = body;

    // 1. OPEN CLASS (Opens live biometric fingerprint reader session)
    if (action === "OPEN_CLASS") {
      if (!courseLevel || !hourSlot || !subject) {
        return NextResponse.json({ error: "courseLevel, hourSlot, and subject are required." }, { status: 400 });
      }

      // Close any previously hanging open sessions for this level/section
      await prisma.liveClassSession.updateMany({
        where: { courseLevel, section: section || "A", isOpen: true },
        data: { isOpen: false, closedAt: new Date() },
      });

      const newSession = await prisma.liveClassSession.create({
        data: {
          courseLevel,
          section: section || "A",
          hourSlot,
          subject,
          isOpen: true,
          openedById: session.id,
          openedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Class for JLPT ${courseLevel} (${section || "A"}) is now OPEN. Biometric scanner unlocked.`,
        session: newSession,
      });
    }

    // 2. CLOSE CLASS & FINALIZE DAY'S ATTENDANCE
    if (action === "CLOSE_CLASS") {
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required to close class." }, { status: 400 });
      }

      const active = await prisma.liveClassSession.findUnique({
        where: { id: sessionId },
      });

      if (!active) {
        return NextResponse.json({ error: "Session not found." }, { status: 404 });
      }

      // Automatically mark all remaining enrolled students in this level/section who weren't verified as ABSENT
      const enrolledStudents = await prisma.user.findMany({
        where: { role: "STUDENT", courseLevel: active.courseLevel, section: active.section },
        select: { id: true },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingAttendances = await prisma.attendance.findMany({
        where: {
          sessionId: active.id,
        },
        select: { studentId: true },
      });

      const presentStudentIds = new Set(existingAttendances.map((a) => a.studentId));
      const absentStudentsToRecord = enrolledStudents.filter((s) => !presentStudentIds.has(s.id));

      if (absentStudentsToRecord.length > 0) {
        await prisma.attendance.createMany({
          data: absentStudentsToRecord.map((s) => ({
            studentId: s.id,
            sessionId: active.id,
            date: new Date(),
            hourSlot: active.hourSlot,
            subject: active.subject,
            status: "ABSENT",
            verifiedByBiometric: false,
            remarks: "Marked absent upon scanner close.",
          })),
        });
      }

      const closed = await prisma.liveClassSession.update({
        where: { id: sessionId },
        data: {
          isOpen: false,
          closedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Day's attendance finalized and locked. ${absentStudentsToRecord.length} unverified student(s) logged as ABSENT.`,
        session: closed,
      });
    }

    // 3. RECORD BIOMETRIC ATTENDANCE IN ACTIVE CLASS
    if (action === "RECORD_BIOMETRIC_ATTENDANCE") {
      const targetSessionId = body.targetSessionId || sessionId;
      if (!studentId || !targetSessionId) {
        return NextResponse.json({ error: "studentId and targetSessionId required." }, { status: 400 });
      }

      const active = await prisma.liveClassSession.findUnique({
        where: { id: targetSessionId },
      });

      if (!active || !active.isOpen) {
        return NextResponse.json({ error: "Cannot mark attendance: Class scanner is closed or locked." }, { status: 403 });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingRecord = await prisma.attendance.findFirst({
        where: {
          studentId,
          date: { gte: today },
          hourSlot: active.hourSlot,
        },
      });

      if (existingRecord) {
        const updated = await prisma.attendance.update({
          where: { id: existingRecord.id },
          data: {
            sessionId: active.id,
            status: "PRESENT",
            verifiedByBiometric: true,
            biometricVerifiedAt: new Date(),
            subject: active.subject,
            remarks: remarks || "Biometric sensor verified (FIDO2)",
          },
        });
        return NextResponse.json({ success: true, record: updated, message: "Attendance verified and updated." });
      } else {
        const created = await prisma.attendance.create({
          data: {
            studentId,
            sessionId: active.id,
            date: new Date(),
            hourSlot: active.hourSlot,
            status: "PRESENT",
            subject: active.subject,
            verifiedByBiometric: true,
            biometricVerifiedAt: new Date(),
            remarks: remarks || "Biometric sensor verified (FIDO2)",
          },
        });
        return NextResponse.json({ success: true, record: created, message: "Biometric attendance recorded instantly." });
      }
    }

    // 3B. OFFICE KIOSK FINGERPRINT SCAN (Continuous terminal scanner - anyone touches finger)
    if (action === "OFFICE_FINGERPRINT_SCAN") {
      const { credentialId, candidateStudentId, isInvalidFinger } = body;

      const targetSessionId = body.targetSessionId || sessionId;
      const active = targetSessionId
        ? await prisma.liveClassSession.findUnique({ where: { id: targetSessionId } })
        : await prisma.liveClassSession.findFirst({ where: { isOpen: true } });

      if (!active || !active.isOpen) {
        return NextResponse.json({
          verified: false,
          error: "SCANNER_LOCKED",
          message: "Attendance scanner is locked. Instructor must open the class session first.",
        }, { status: 403 });
      }

      // If simulated invalid finger or unrecognized
      if (isInvalidFinger) {
        return NextResponse.json({
          verified: false,
          error: "INVALID_OR_NOT_REGISTERED",
          message: "Fingerprint rejected: Biometric pattern is invalid or not registered in the academy directory.",
        }, { status: 404 });
      }

      let matchedStudent: any = null;

      if (credentialId) {
        const cred = await prisma.biometricCredential.findUnique({
          where: { credentialId },
          include: {
            user: { select: { id: true, name: true, email: true, courseLevel: true, section: true } },
          },
        });
        if (cred && cred.user) {
          matchedStudent = cred.user;
        }
      } else if (candidateStudentId) {
        const user = await prisma.user.findUnique({
          where: { id: candidateStudentId },
          select: { id: true, name: true, email: true, courseLevel: true, section: true, biometricCredentials: true },
        });
        if (user && user.biometricCredentials && user.biometricCredentials.length > 0) {
          matchedStudent = user;
        }
      }

      if (!matchedStudent) {
        return NextResponse.json({
          verified: false,
          error: "INVALID_OR_NOT_REGISTERED",
          message: "Fingerprint unrecognized: No registered biometric profile matches this finger. Please enroll in settings or contact instructor.",
        }, { status: 404 });
      }

      // Check if already checked in today for this session
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingRecord = await prisma.attendance.findFirst({
        where: {
          studentId: matchedStudent.id,
          date: { gte: today },
          sessionId: active.id,
        },
      });

      if (existingRecord && existingRecord.status === "PRESENT") {
        return NextResponse.json({
          success: true,
          verified: true,
          alreadyMarked: true,
          student: matchedStudent,
          record: existingRecord,
          message: `Notice: ${matchedStudent.name} is ALREADY verified today (${existingRecord.biometricVerifiedAt ? new Date(existingRecord.biometricVerifiedAt).toLocaleTimeString() : "earlier"}).`,
        });
      }

      const now = new Date();
      const attendanceRecord = existingRecord
        ? await prisma.attendance.update({
            where: { id: existingRecord.id },
            data: {
              status: "PRESENT",
              verifiedByBiometric: true,
              biometricVerifiedAt: now,
              subject: active.subject,
              remarks: "Office Kiosk Fingerprint Scanner Verified",
            },
          })
        : await prisma.attendance.create({
            data: {
              studentId: matchedStudent.id,
              sessionId: active.id,
              date: now,
              hourSlot: active.hourSlot,
              status: "PRESENT",
              subject: active.subject,
              verifiedByBiometric: true,
              biometricVerifiedAt: now,
              remarks: "Office Kiosk Fingerprint Scanner Verified",
            },
          });

      return NextResponse.json({
        success: true,
        verified: true,
        alreadyMarked: false,
        student: matchedStudent,
        record: attendanceRecord,
        timestamp: now.toISOString(),
        message: `Verified: ${matchedStudent.name} (${matchedStudent.courseLevel}-${matchedStudent.section}) marked PRESENT at ${now.toLocaleTimeString()}.`,
      });
    }

    // 4. MANUAL OVERRIDE (FOR SAFETY REASONS - Sensor failure, excuse, hardware issue)
    if (action === "MANUAL_OVERRIDE_ATTENDANCE") {
      if (!studentId) {
        return NextResponse.json({ error: "studentId required." }, { status: 400 });
      }

      const targetStatus = status || "PRESENT";
      const manualRemark = remarks || "Manual faculty override for safety reason";

      // If active session exists, bind to it
      const targetSession = sessionId
        ? await prisma.liveClassSession.findUnique({ where: { id: sessionId } })
        : null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingRecord = await prisma.attendance.findFirst({
        where: {
          studentId,
          date: { gte: today },
          hourSlot: targetSession?.hourSlot || hourSlot || "09:00 AM - 10:00 AM",
        },
      });

      if (existingRecord) {
        const updated = await prisma.attendance.update({
          where: { id: existingRecord.id },
          data: {
            status: targetStatus,
            verifiedByBiometric: false, // Manual override
            remarks: manualRemark,
          },
        });
        return NextResponse.json({ success: true, record: updated, message: `Student marked as ${targetStatus} (Manual Safety Override).` });
      } else {
        const created = await prisma.attendance.create({
          data: {
            studentId,
            sessionId: targetSession?.id || null,
            date: new Date(),
            hourSlot: targetSession?.hourSlot || hourSlot || "09:00 AM - 10:00 AM",
            status: targetStatus,
            subject: targetSession?.subject || subject || "Japanese Language",
            verifiedByBiometric: false,
            remarks: manualRemark,
          },
        });
        return NextResponse.json({ success: true, record: created, message: `Student marked as ${targetStatus} (Manual Safety Override).` });
      }
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("Live class session error:", error);
    return NextResponse.json({ error: error.message || "Session error" }, { status: 500 });
  }
}
