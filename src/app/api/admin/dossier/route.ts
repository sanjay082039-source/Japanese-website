import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin authority required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        deviceSessions: { orderBy: { lastActive: "desc" } },
        biometricCredentials: true,
        attendances: {
          orderBy: { date: "desc" },
          include: { liveSession: true },
        },
        examAttempts: {
          orderBy: { startedAt: "desc" },
          include: {
            exam: true,
            violations: { orderBy: { timestamp: "desc" } },
          },
        },
        assignmentSubmissions: {
          orderBy: { submittedAt: "desc" },
          include: { assignment: true },
        },
        chapterProgresses: {
          orderBy: { updatedAt: "desc" },
          include: { chapter: true },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    // Compute key analytics
    const totalClasses = student.attendances.length;
    const presentCount = student.attendances.filter((a) => a.status === "PRESENT").length;
    const biometricVerifiedCount = student.attendances.filter((a) => a.verifiedByBiometric).length;
    const attendanceRate = totalClasses > 0 ? Number(((presentCount / totalClasses) * 100).toFixed(1)) : 100;

    const completedExams = student.examAttempts.filter((a) => a.status === "SUBMITTED" || a.status === "AUTO_SUBMITTED");
    const avgExamScore =
      completedExams.length > 0
        ? Number(
            (
              completedExams.reduce((acc, a) => acc + (a.score || 0), 0) /
              completedExams.length
            ).toFixed(1)
          )
        : null;

    const totalInfractions = student.examAttempts.reduce((acc, a) => acc + a.cheatCount, 0);

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        courseLevel: student.courseLevel,
        section: student.section,
        role: student.role,
        createdAt: student.createdAt,
      },
      metrics: {
        attendanceRate,
        totalClasses,
        presentCount,
        biometricVerifiedCount,
        avgExamScore,
        examsAttemptedCount: student.examAttempts.length,
        totalInfractions,
        chaptersCount: student.chapterProgresses.length,
        assignmentsCount: student.assignmentSubmissions.length,
      },
      deviceSessions: student.deviceSessions,
      biometricCredentials: student.biometricCredentials.map((c) => ({
        id: c.id,
        credentialId: c.credentialId,
        deviceType: c.deviceType,
        counter: c.counter,
        createdAt: c.createdAt,
      })),
      attendances: student.attendances,
      examAttempts: student.examAttempts,
      assignmentSubmissions: student.assignmentSubmissions,
      chapterProgresses: student.chapterProgresses,
    });
  } catch (error: any) {
    console.error("Dossier GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to load dossier" }, { status: 500 });
  }
}
