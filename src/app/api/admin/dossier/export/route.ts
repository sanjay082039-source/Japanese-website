import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin authority required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "RIT Japanese LMS";
    workbook.created = new Date();

    if (studentId) {
      // SINGLE STUDENT COMPREHENSIVE DOSSIER EXPORT
      const student = await prisma.user.findUnique({
        where: { id: studentId },
        include: {
          deviceSessions: true,
          biometricCredentials: true,
          attendances: { orderBy: { date: "desc" } },
          examAttempts: { include: { exam: true }, orderBy: { startedAt: "desc" } },
          assignmentSubmissions: { include: { assignment: true }, orderBy: { submittedAt: "desc" } },
          chapterProgresses: { include: { chapter: true } },
        },
      });

      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 });
      }

      // Sheet 1: Overview
      const overviewSheet = workbook.addWorksheet("Profile & Devices");
      overviewSheet.columns = [
        { header: "Field", key: "field", width: 25 },
        { header: "Value", key: "value", width: 45 },
      ];
      overviewSheet.addRow({ field: "Full Name", value: student.name });
      overviewSheet.addRow({ field: "Email Address", value: student.email });
      overviewSheet.addRow({ field: "JLPT Level", value: student.courseLevel });
      overviewSheet.addRow({ field: "Section / Batch", value: student.section });
      overviewSheet.addRow({ field: "Biometric Enrolled", value: student.biometricCredentials.length > 0 ? "YES (FIDO2)" : "NO" });
      overviewSheet.addRow({ field: "Active Devices", value: student.deviceSessions.map((d) => `${d.deviceType} (${d.ipAddress})`).join(", ") || "None" });

      // Sheet 2: Attendance Ledger
      const attSheet = workbook.addWorksheet("Attendance Logs");
      attSheet.columns = [
        { header: "Date", key: "date", width: 15 },
        { header: "Hour Slot", key: "hourSlot", width: 22 },
        { header: "Subject", key: "subject", width: 25 },
        { header: "Status", key: "status", width: 15 },
        { header: "Biometric Verified", key: "bio", width: 20 },
      ];
      student.attendances.forEach((a) => {
        attSheet.addRow({
          date: new Date(a.date).toLocaleDateString(),
          hourSlot: a.hourSlot,
          subject: a.subject || "Japanese Language",
          status: a.status,
          bio: a.verifiedByBiometric ? "VERIFIED (Touch ID/Hello)" : "Manual / Standard",
        });
      });

      // Sheet 3: Assessments
      const examSheet = workbook.addWorksheet("Exam Performance");
      examSheet.columns = [
        { header: "Exam Title", key: "title", width: 35 },
        { header: "Date", key: "date", width: 15 },
        { header: "Score", key: "score", width: 12 },
        { header: "Total Marks", key: "total", width: 12 },
        { header: "Status", key: "status", width: 15 },
        { header: "Infraction Count", key: "cheats", width: 18 },
      ];
      student.examAttempts.forEach((ea) => {
        examSheet.addRow({
          title: ea.exam.title,
          date: new Date(ea.startedAt).toLocaleDateString(),
          score: ea.score ?? "Pending",
          total: ea.exam.totalMarks,
          status: ea.status,
          cheats: ea.cheatCount,
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const safeName = student.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || `Student_${student.id.slice(-6)}`;
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="RIT_Dossier_${safeName}.xlsx"`,
        },
      });
    }

    // COHORT FULL ROSTER EXPORT
    const students = await prisma.user.findMany({
      where: { role: "STUDENT" },
      include: {
        attendances: true,
        examAttempts: true,
        deviceSessions: true,
        biometricCredentials: true,
      },
      orderBy: [{ courseLevel: "asc" }, { name: "asc" }],
    });

    const sheet = workbook.addWorksheet("Cohort Directory");
    sheet.columns = [
      { header: "Student Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "JLPT Level", key: "level", width: 12 },
      { header: "Section", key: "sec", width: 10 },
      { header: "Attendance %", key: "attRate", width: 15 },
      { header: "Biometric Registered", key: "bio", width: 20 },
      { header: "Active Devices", key: "devs", width: 15 },
      { header: "Total Infractions", key: "infractions", width: 18 },
    ];

    students.forEach((s) => {
      const totalAtt = s.attendances.length;
      const present = s.attendances.filter((a) => a.status === "PRESENT").length;
      const rate = totalAtt > 0 ? ((present / totalAtt) * 100).toFixed(1) + "%" : "100%";
      const infractions = s.examAttempts.reduce((acc, a) => acc + a.cheatCount, 0);

      sheet.addRow({
        name: s.name,
        email: s.email,
        level: s.courseLevel,
        sec: s.section,
        attRate: rate,
        bio: s.biometricCredentials.length > 0 ? "YES" : "NO",
        devs: s.deviceSessions.length,
        infractions,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="RIT_Cohort_Master_Ledger.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Dossier export error:", error);
    return NextResponse.json({ error: error.message || "Export failed" }, { status: 500 });
  }
}
