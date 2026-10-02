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
    const studentIdParam = searchParams.get("studentId");
    const mode = searchParams.get("mode");

    // =========================================================================
    // MODE 1: DAILY ATTENDANCE SHEET FOR CLASS / BATCH
    // =========================================================================
    if (session.role === "ADMIN" && mode === "dailySheet") {
      const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
      const courseLevel = searchParams.get("courseLevel") || "N3";
      const section = searchParams.get("section");
      const hourSlot = searchParams.get("hourSlot") || "09:00 AM - 10:00 AM";

      const studentWhere: any = { role: "STUDENT", courseLevel };
      if (section && section !== "ALL") {
        studentWhere.section = section;
      }

      const students = await prisma.user.findMany({
        where: studentWhere,
        orderBy: [{ section: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          courseLevel: true,
          section: true,
        },
      });

      // Find existing records for this day & hour slot
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

      const existingRecords = await prisma.attendance.findMany({
        where: {
          hourSlot,
          date: { gte: startOfDay, lte: endOfDay },
          studentId: { in: students.map((s) => s.id) },
        },
      });

      return NextResponse.json({
        students,
        existingRecords,
        date: dateStr,
        hourSlot,
        courseLevel,
        section: section || "ALL",
      });
    }

    // =========================================================================
    // MODE 2: FULL STUDENT ATTENDANCE LEDGER
    // =========================================================================
    if (session.role === "ADMIN" && mode === "ledger") {
      const students = await prisma.user.findMany({
        where: { role: "STUDENT" },
        orderBy: [{ courseLevel: "asc" }, { name: "asc" }],
        include: {
          attendances: {
            orderBy: { date: "desc" },
          },
        },
      });

      const formatted = students.map((s) => {
        const total = s.attendances.length;
        const present = s.attendances.filter((a) => a.status === "PRESENT").length;
        const absent = s.attendances.filter((a) => a.status === "ABSENT").length;
        const onLeave = s.attendances.filter((a) => a.status === "ON_LEAVE").length;
        const overallRate = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 100;

        return {
          id: s.id,
          name: s.name,
          email: s.email,
          courseLevel: s.courseLevel,
          section: s.section,
          totalHours: total,
          presentHours: present,
          absentHours: absent,
          leaveHours: onLeave,
          overallRate,
          recentLogs: s.attendances.slice(0, 5),
        };
      });

      return NextResponse.json({ students: formatted });
    }

    // =========================================================================
    // MODE 3: DETAILED ATTENDANCE LOGS HISTORY
    // =========================================================================
    if (session.role === "ADMIN" && mode === "logs") {
      const logs = await prisma.attendance.findMany({
        orderBy: { date: "desc" },
        take: 200,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              courseLevel: true,
              section: true,
            },
          },
        },
      });
      return NextResponse.json({ logs });
    }

    // =========================================================================
    // ADMIN OVERVIEW STATS (FOR OVERVIEW PAGE)
    // =========================================================================
    if (session.role === "ADMIN" && !studentIdParam) {
      const allAttendances = await prisma.attendance.findMany();
      const totalHours = allAttendances.length;
      const presentCount = allAttendances.filter((a) => a.status === "PRESENT").length;
      const absentCount = allAttendances.filter((a) => a.status === "ABSENT").length;
      const leaveCount = allAttendances.filter((a) => a.status === "ON_LEAVE").length;
      const overallRate = totalHours > 0 ? Number(((presentCount / totalHours) * 100).toFixed(1)) : 100;

      return NextResponse.json({
        overallRate,
        totalHours,
        presentCount,
        absentCount,
        leaveCount,
        isCohortOverview: true,
      });
    }

    // =========================================================================
    // STUDENT VIEW: INDIVIDUAL ATTENDANCE RECORDS
    // =========================================================================
    const targetStudentId =
      session.role === "STUDENT" ? session.id : studentIdParam || session.id;

    const attendances = await prisma.attendance.findMany({
      where: { studentId: targetStudentId },
      orderBy: { date: "desc" },
    });

    const totalHours = attendances.length;
    const presentCount = attendances.filter((a) => a.status === "PRESENT").length;
    const absentCount = attendances.filter((a) => a.status === "ABSENT").length;
    const leaveCount = attendances.filter((a) => a.status === "ON_LEAVE").length;

    const overallRate = totalHours > 0 ? Number(((presentCount / totalHours) * 100).toFixed(1)) : 0;

    // Subject-wise breakdown
    const subjectMap: Record<string, { present: number; absent: number; leave: number; total: number }> = {};
    attendances.forEach((att) => {
      const subj = att.subject || "General JLPT Class";
      if (!subjectMap[subj]) {
        subjectMap[subj] = { present: 0, absent: 0, leave: 0, total: 0 };
      }
      subjectMap[subj].total += 1;
      if (att.status === "PRESENT") subjectMap[subj].present += 1;
      else if (att.status === "ABSENT") subjectMap[subj].absent += 1;
      else if (att.status === "ON_LEAVE") subjectMap[subj].leave += 1;
    });

    const subjectBreakdown = Object.entries(subjectMap).map(([subject, stats]) => ({
      subject,
      totalHours: stats.total,
      present: stats.present,
      absent: stats.absent,
      onLeave: stats.leave,
      rate: Number(((stats.present / stats.total) * 100).toFixed(1)),
    }));

    return NextResponse.json({
      overallRate,
      totalHours,
      presentCount,
      absentCount,
      leaveCount,
      subjectBreakdown,
      logs: attendances,
    });
  } catch (error: unknown) {
    console.error("Attendance fetch error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator privilege required" }, { status: 403 });
    }

    const body = await request.json();
    const { date, hourSlot, subject, records, studentId, status, remarks } = body;

    const dateStr = date ? (typeof date === "string" ? date.split("T")[0] : new Date(date).toISOString().split("T")[0]) : new Date().toISOString().split("T")[0];
    const targetDate = new Date(`${dateStr}T12:00:00.000Z`);
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    // Case 1: Bulk Daily Register Submission
    if (records && Array.isArray(records) && records.length > 0) {
      if (!hourSlot) {
        return NextResponse.json({ error: "Hour slot is required" }, { status: 400 });
      }

      const classSubject = subject || "General Nihongo Session";

      // Process in transaction or parallel upserts
      const studentIds = records.map((r: any) => r.studentId);

      // Clean existing records for this session slot on this date
      await prisma.attendance.deleteMany({
        where: {
          hourSlot,
          date: { gte: startOfDay, lte: endOfDay },
          studentId: { in: studentIds },
        },
      });

      // Insert new verified daily records
      const toCreate = records.map((rec: any) => ({
        studentId: rec.studentId,
        date: targetDate,
        hourSlot,
        status: rec.status || "PRESENT",
        subject: classSubject,
        remarks: rec.remarks || null,
      }));

      await prisma.attendance.createMany({
        data: toCreate,
      });

      return NextResponse.json({
        success: true,
        count: toCreate.length,
        message: `Successfully saved daily attendance for ${toCreate.length} candidate(s).`,
      });
    }

    // Case 2: Single Student Submission
    if (!studentId || !hourSlot || !status) {
      return NextResponse.json({ error: "Missing required attendance parameters (studentId, hourSlot, status)" }, { status: 400 });
    }

    // Check & replace if existing on same day & slot
    await prisma.attendance.deleteMany({
      where: {
        studentId,
        hourSlot,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    const record = await prisma.attendance.create({
      data: {
        studentId,
        date: targetDate,
        hourSlot,
        status,
        subject: subject || "General Nihongo Session",
        remarks: remarks || null,
      },
    });

    return NextResponse.json({ success: true, count: 1, record });
  } catch (error: unknown) {
    console.error("Attendance post error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
