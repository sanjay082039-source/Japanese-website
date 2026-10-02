import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import prisma from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. RBAC Verification (Admin Role Only)
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized. Administrator privilege required." },
        { status: 403 }
      );
    }

    // 2. Query Parameters Extraction
    const { searchParams } = new URL(request.url);
    const courseLevel = searchParams.get("courseLevel") || "ALL"; // "N1", "N2", "N3", "N4", "N5", or "ALL"
    const minAttendance = parseFloat(searchParams.get("minAttendance") || "75");
    const minScore = parseFloat(searchParams.get("minScore") || "0");
    const section = searchParams.get("section") || "";
    const search = searchParams.get("search")?.toLowerCase() || "";

    // 3. Database Query
    const whereClause: Record<string, unknown> = {
      role: "STUDENT",
    };

    if (courseLevel && courseLevel !== "ALL") {
      whereClause.courseLevel = courseLevel;
    }

    if (section) {
      whereClause.section = section;
    }

    const students = await prisma.user.findMany({
      where: whereClause,
      include: {
        attendances: true,
        examAttempts: {
          include: {
            exam: true,
          },
        },
        assignmentSubmissions: true,
      },
      orderBy: [{ courseLevel: "asc" }, { name: "asc" }],
    });

    // 4. Compute Metrics & Apply Multi-parameter Shortlisting
    const totalAssignmentsCount = await prisma.assignment.count({
      where: courseLevel && courseLevel !== "ALL" ? { courseLevel } : {},
    });

    const shortlistedStudents = students
      .map((student) => {
        const totalClasses = student.attendances.length;
        const presentCount = student.attendances.filter(
          (a) => a.status === "PRESENT"
        ).length;
        const absentCount = student.attendances.filter(
          (a) => a.status === "ABSENT"
        ).length;
        const leaveCount = student.attendances.filter(
          (a) => a.status === "ON_LEAVE"
        ).length;

        const attendanceRate =
          totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0;

        const gradedExams = student.examAttempts.filter(
          (attempt) => attempt.score !== null
        );
        const totalExamScore = gradedExams.reduce(
          (acc, curr) => acc + (curr.score || 0),
          0
        );
        const avgExamScore =
          gradedExams.length > 0 ? totalExamScore / gradedExams.length : 0;

        const assignmentsCompleted = student.assignmentSubmissions.length;

        let status: "ELIGIBLE" | "AT_RISK" | "NEEDS_ATTENTION" = "NEEDS_ATTENTION";
        if (attendanceRate >= minAttendance && avgExamScore >= minScore) {
          status = "ELIGIBLE";
        } else if (attendanceRate < 60 || (gradedExams.length > 0 && avgExamScore < 40)) {
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
          averageExamScore: Number(avgExamScore.toFixed(1)),
          examsAttempted: gradedExams.length,
          assignmentsCompleted,
          totalAssignments: totalAssignmentsCount,
          status,
        };
      })
      .filter((student) => {
        if (search) {
          const matchesName = student.name.toLowerCase().includes(search);
          const matchesEmail = student.email.toLowerCase().includes(search);
          if (!matchesName && !matchesEmail) return false;
        }
        if (student.attendanceRate < minAttendance) return false;
        if (student.averageExamScore < minScore) return false;
        return true;
      });

    // 5. Build Excel Workbook with ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "RIT Japanese Portal - Admin Center";
    workbook.created = new Date();

    // Sheet 1: Shortlisted Students
    const sheet = workbook.addWorksheet("Shortlisted Students", {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: "FFE11D48" } },
    });

    // Title Block
    sheet.mergeCells("A1:N1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = "RIT JAPANESE PORTAL - CANDIDATE SHORTLIST REPORT";
    titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Dark Slate
    };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 36;

    // Subtitle / Filter Metadata Block
    sheet.mergeCells("A2:N2");
    const metaCell = sheet.getCell("A2");
    metaCell.value = `Exported by Administrator: ${session.name} | Course Tier: ${courseLevel} | Min Attendance: ${minAttendance}% | Records: ${shortlistedStudents.length} | Date: ${new Date().toLocaleString()}`;
    metaCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
    metaCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(2).height = 22;

    sheet.getRow(3).height = 10;

    // Headers Row (Row 4)
    const headers = [
      "Student ID",
      "Candidate Name",
      "RIT Student Email",
      "Phone",
      "JLPT Tier",
      "Section",
      "Total Hours",
      "Present Hours",
      "Absent Hours",
      "On Leave",
      "Attendance %",
      "Avg Exam %",
      "Exams Done",
      "Assignments Done",
      "Eligibility Status",
    ];

    const headerRow = sheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE11D48" }, // Crimson Accent
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "medium", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });

    // Populate Data Rows
    shortlistedStudents.forEach((student, index) => {
      const rowIndex = 5 + index;
      const row = sheet.getRow(rowIndex);
      row.values = [
        student.id.slice(-8).toUpperCase(),
        student.name,
        student.email,
        student.phone,
        student.courseLevel,
        student.section,
        student.totalClasses,
        student.presentCount,
        student.absentCount,
        student.leaveCount,
        student.attendanceRate / 100,
        student.averageExamScore / 100,
        student.examsAttempted,
        student.assignmentsCompleted,
        student.status,
      ];
      row.height = 22;

      const isEven = index % 2 === 0;
      const bgColor = isEven ? "FFFFFFFF" : "FFF8FAFC";

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Arial", size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        if ([1, 5, 6, 7, 8, 9, 10, 13, 14].includes(colNumber)) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else if ([11, 12].includes(colNumber)) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "0.0%";
        } else if (colNumber === 15) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
          if (student.status === "ELIGIBLE") {
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF166534" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
          } else if (student.status === "AT_RISK") {
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF991B1B" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
          } else {
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF854D0E" } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
          }
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    });

    sheet.columns = [
      { width: 14 },
      { width: 24 },
      { width: 30 },
      { width: 18 },
      { width: 12 },
      { width: 10 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 18 },
      { width: 20 },
    ];

    // Sheet 2: Course Level Analytics Summary
    const summarySheet = workbook.addWorksheet("Tier Performance Summary");
    summarySheet.views = [{ showGridLines: true }];

    summarySheet.mergeCells("A1:E1");
    const summaryTitle = summarySheet.getCell("A1");
    summaryTitle.value = "RIT JAPANESE PORTAL - TIER PERFORMANCE OVERVIEW";
    summaryTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    summaryTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    summaryTitle.alignment = { horizontal: "center", vertical: "middle" };
    summarySheet.getRow(1).height = 32;

    const summaryHeaders = ["JLPT Tier", "Enrolled Students", "Shortlisted Count", "Avg Attendance", "Avg Exam Score"];
    const sumHeaderRow = summarySheet.getRow(3);
    sumHeaderRow.values = summaryHeaders;
    sumHeaderRow.height = 24;
    sumHeaderRow.eachCell((c) => {
      c.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE11D48" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
    });

    const levels = ["N1", "N2", "N3", "N4", "N5"];
    levels.forEach((lvl, idx) => {
      const allInLevel = students.filter((s) => s.courseLevel === lvl);
      const shortlistedInLevel = shortlistedStudents.filter((s) => s.courseLevel === lvl);
      const avgAtt =
        shortlistedInLevel.length > 0
          ? shortlistedInLevel.reduce((a, b) => a + b.attendanceRate, 0) / shortlistedInLevel.length
          : 0;
      const avgExam =
        shortlistedInLevel.length > 0
          ? shortlistedInLevel.reduce((a, b) => a + b.averageExamScore, 0) / shortlistedInLevel.length
          : 0;

      const r = summarySheet.getRow(4 + idx);
      r.values = [lvl, allInLevel.length, shortlistedInLevel.length, avgAtt / 100, avgExam / 100];
      r.height = 20;
      r.eachCell((c, colNum) => {
        c.font = { name: "Arial", size: 10 };
        c.alignment = { horizontal: "center", vertical: "middle" };
        c.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        if ([4, 5].includes(colNum)) {
          c.numFmt = "0.0%";
        }
      });
    });

    summarySheet.columns = [
      { width: 16 },
      { width: 20 },
      { width: 20 },
      { width: 18 },
      { width: 18 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `RIT_Japanese_Shortlist_${courseLevel}_${timestamp}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: unknown) {
    console.error("Export shortlist error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
