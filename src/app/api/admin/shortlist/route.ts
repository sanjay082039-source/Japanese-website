import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized access. Administrator role required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseLevel = searchParams.get("courseLevel") || "ALL";
    const minAttendance = parseFloat(searchParams.get("minAttendance") || "0");
    const minScore = parseFloat(searchParams.get("minScore") || "0");
    const search = searchParams.get("search")?.toLowerCase() || "";

    const whereClause: Record<string, unknown> = {
      role: "STUDENT",
    };

    if (courseLevel && courseLevel !== "ALL") {
      whereClause.courseLevel = courseLevel;
    }

    const students = await prisma.user.findMany({
      where: whereClause,
      include: {
        attendances: true,
        examAttempts: {
          include: { exam: true },
        },
        assignmentSubmissions: true,
      },
      orderBy: [{ courseLevel: "asc" }, { name: "asc" }],
    });

    const totalAssignments = await prisma.assignment.count();

    const formatted = students
      .map((student) => {
        const totalClasses = student.attendances.length;
        const presentCount = student.attendances.filter((a) => a.status === "PRESENT").length;
        const absentCount = student.attendances.filter((a) => a.status === "ABSENT").length;
        const leaveCount = student.attendances.filter((a) => a.status === "ON_LEAVE").length;

        const attendanceRate = totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0;

        const gradedExams = student.examAttempts.filter((a) => a.score !== null);
        const totalExamScore = gradedExams.reduce((sum, curr) => sum + (curr.score || 0), 0);
        const averageExamScore = gradedExams.length > 0 ? totalExamScore / gradedExams.length : 0;

        let status: "ELIGIBLE" | "AT_RISK" | "NEEDS_ATTENTION" = "NEEDS_ATTENTION";
        if (attendanceRate >= 75 && averageExamScore >= 60) {
          status = "ELIGIBLE";
        } else if (attendanceRate < 60 || (gradedExams.length > 0 && averageExamScore < 40)) {
          status = "AT_RISK";
        }

        return {
          id: student.id,
          name: student.name,
          email: student.email,
          phone: student.phone || "N/A",
          courseLevel: student.courseLevel,
          section: student.section,
          totalClasses,
          presentCount,
          absentCount,
          leaveCount,
          attendanceRate: Number(attendanceRate.toFixed(1)),
          averageExamScore: Number(averageExamScore.toFixed(1)),
          examsAttempted: gradedExams.length,
          assignmentsCompleted: student.assignmentSubmissions.length,
          totalAssignments,
          status,
        };
      })
      .filter((s) => {
        if (search) {
          const matchName = s.name.toLowerCase().includes(search);
          const matchEmail = s.email.toLowerCase().includes(search);
          if (!matchName && !matchEmail) return false;
        }
        if (s.attendanceRate < minAttendance) return false;
        if (s.averageExamScore < minScore) return false;
        return true;
      });

    return NextResponse.json({ students: formatted });
  } catch (error: unknown) {
    console.error("Shortlist fetch error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
