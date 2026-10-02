import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Navbar from "@/components/navigation/Navbar";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  ClipboardList,
  Calendar,
  FileSpreadsheet,
  PlusCircle,
  ArrowUpRight,
  TrendingUp,
  Award,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }

  // 1. Basic Counts
  const totalStudents = await prisma.user.count({ where: { role: "STUDENT" } });
  const totalAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
  const totalExams = await prisma.exam.count();
  const totalAssignments = await prisma.assignment.count();
  const allAttempts = await prisma.examAttempt.findMany({
    include: { exam: true, student: true },
  });

  // 2. Platform Overall Progress Averages (Regular System Attendance Only - Offline Attendance is excluded from Overview)
  const allAttendances = await prisma.attendance.findMany({
    where: { isOffline: false },
  });
  const totalAttendanceHours = allAttendances.length;
  const totalPresentHours = allAttendances.filter((a) => a.status === "PRESENT").length;
  const overallAttendanceRate =
    totalAttendanceHours > 0 ? Number(((totalPresentHours / totalAttendanceHours) * 100).toFixed(1)) : 100;

  // Average Exam Score %
  const gradedAttempts = allAttempts.filter((a) => a.score !== null);
  const totalExamScorePercentage = gradedAttempts.reduce((acc, curr) => {
    const maxMarks = curr.exam.totalMarks || 50;
    return acc + ((curr.score || 0) / maxMarks) * 100;
  }, 0);
  const overallAvgExamScore =
    gradedAttempts.length > 0 ? Number((totalExamScorePercentage / gradedAttempts.length).toFixed(1)) : 0;

  // Average Assignment Submissions & Grades
  const allSubmissions = await prisma.assignmentSubmission.findMany({
    include: { assignment: true },
  });
  const totalExpectedSubmissions = totalStudents * Math.max(1, totalAssignments);
  const overallAssignmentCompletionRate =
    totalExpectedSubmissions > 0
      ? Number(((allSubmissions.length / totalExpectedSubmissions) * 100).toFixed(1))
      : 0;

  const gradedSubmissions = allSubmissions.filter((s) => s.grade !== null);
  const totalSubGradePercentage = gradedSubmissions.reduce((acc, s) => {
    const maxMarks = s.assignment.maxMarks || 100;
    return acc + ((s.grade || 0) / maxMarks) * 100;
  }, 0);
  const overallAvgAssignmentGrade =
    gradedSubmissions.length > 0 ? Number((totalSubGradePercentage / gradedSubmissions.length).toFixed(1)) : 0;

  // 3. Tier-by-Tier Granular Progress Averages (N1 to N5)
  const tierProgress = await Promise.all(
    (["N1", "N2", "N3", "N4", "N5"] as const).map(async (level) => {
      const studentsInLevel = await prisma.user.findMany({
        where: { role: "STUDENT", courseLevel: level },
        include: {
          attendances: {
            where: { isOffline: false }, // Exclude offline attendance from overview tier matrix
          },
          examAttempts: { include: { exam: true } },
          assignmentSubmissions: true,
        },
      });

      const count = studentsInLevel.length;

      // Tier attendance average (online only for overview)
      let tierPresent = 0;
      let tierTotalHours = 0;
      studentsInLevel.forEach((s) => {
        tierTotalHours += s.attendances.length;
        tierPresent += s.attendances.filter((a) => a.status === "PRESENT").length;
      });
      const avgAttendance = tierTotalHours > 0 ? Number(((tierPresent / tierTotalHours) * 100).toFixed(1)) : 100;

      // Tier exam average
      let examScoreSum = 0;
      let examCount = 0;
      studentsInLevel.forEach((s) => {
        s.examAttempts.forEach((att) => {
          if (att.score !== null) {
            const maxM = att.exam.totalMarks || 50;
            examScoreSum += (att.score / maxM) * 100;
            examCount++;
          }
        });
      });
      const avgExamScore = examCount > 0 ? Number((examScoreSum / examCount).toFixed(1)) : 0;

      // Tier assignment rate
      const levelAssignmentsCount = await prisma.assignment.count({ where: { courseLevel: level } });
      const expectedSubs = count * Math.max(1, levelAssignmentsCount);
      let actualSubs = 0;
      studentsInLevel.forEach((s) => {
        actualSubs += s.assignmentSubmissions.length;
      });
      const assignmentRate = expectedSubs > 0 ? Number(((actualSubs / expectedSubs) * 100).toFixed(1)) : 0;

      // Eligible student count (attendance >= 75% and avg exam >= 50%)
      const eligibleStudents = studentsInLevel.filter((s) => {
        const studentTotal = s.attendances.length;
        const studentPres = s.attendances.filter((a) => a.status === "PRESENT").length;
        const studentRate = studentTotal > 0 ? (studentPres / studentTotal) * 100 : 100;
        return studentRate >= 75;
      }).length;

      const eligibilityRate = count > 0 ? Number(((eligibleStudents / count) * 100).toFixed(1)) : 100;

      return {
        level,
        count,
        avgAttendance,
        avgExamScore,
        assignmentRate,
        eligibilityRate,
        status:
          avgAttendance >= 80 && eligibilityRate >= 80
            ? "High Mastery"
            : avgAttendance >= 70
            ? "On Track"
            : "Needs Support",
      };
    })
  );

  // 4. Enrolled Students with Live Online Attendance (Overview Page Excludes Offline Attendance)
  const enrolledStudents = await prisma.user.findMany({
    where: { role: "STUDENT" },
    take: 12,
    orderBy: { createdAt: "desc" },
    include: {
      attendances: {
        where: { isOffline: false }, // Exclude offline attendance from overview page
      },
    },
  });

  // 5. Recent Exam Attempts with Student Attendance (Overview Page Excludes Offline Attendance)
  const recentAttempts = await prisma.examAttempt.findMany({
    take: 8,
    orderBy: { createdAt: "desc" },
    include: {
      student: {
        include: {
          attendances: {
            where: { isOffline: false }, // Exclude offline attendance from overview page
          },
        },
      },
      exam: true,
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      <Navbar user={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Executive Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              RIT Academic Operations & Analytics Command
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Aggregate student progress averages, attendance metrics, assessment evaluations, and JLPT tier shortlisting.
            </p>
          </div>


          <div className="flex items-center flex-wrap gap-3">
            <Link
              href="/admin/students"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-semibold text-xs transition-all shadow-md"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Shortlist & Export .xlsx
            </Link>

            <Link
              href="/admin/exams"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-lg shadow-rose-950/40"
            >
              <PlusCircle className="w-4 h-4" />
              Manage & Evaluate Exams
            </Link>
          </div>
        </div>

        {/* Global Key Volume Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Enrolled Students
              </span>
              <Users className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{totalStudents}</span>
              <span className="text-xs text-slate-400">candidates</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Active across JLPT tiers N1–N5</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                System Administrators
              </span>
              <GraduationCap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{totalAdmins}</span>
              <span className="text-xs text-slate-400">admin accounts</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Faculty operations and proctoring control</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Published Examinations
              </span>
              <ClipboardList className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{totalExams}</span>
              <span className="text-xs text-slate-400">active tests</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">{allAttempts.length} completed attempts logged</p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Course Practicums
              </span>
              <BookOpen className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{totalAssignments}</span>
              <span className="text-xs text-slate-400">assignments</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">{allSubmissions.length} student submissions</p>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION: ALL AVERAGES OF STUDENT PROGRESS                      */}
        {/* ============================================================== */}
        <div className="mt-8 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-rose-500" />
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Student Progress & Performance Averages Overview
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Aggregated cohort milestones across attendance compliance, examination proficiency, and assignment practicums.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Platform Benchmark: Attendance ≥ 75% | Exam ≥ 50%
            </span>
          </div>

          {/* 4 Average Progress Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Overall Attendance Average */}
            <div className="p-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Avg Attendance Rate</span>
                <Clock className="w-4 h-4 text-rose-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">{overallAttendanceRate}%</span>
                <span className="text-xs font-bold text-emerald-400">
                  {overallAttendanceRate >= 75 ? "Threshold Met" : "Warning"}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    overallAttendanceRate >= 75 ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(100, overallAttendanceRate)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-500">
                Based on {totalAttendanceHours} total classroom session logs
              </p>
            </div>

            {/* 2. Overall Exam Score Average */}
            <div className="p-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Avg Examination Score</span>
                <Award className="w-4 h-4 text-rose-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {overallAvgExamScore > 0 ? `${overallAvgExamScore}%` : "Pending"}
                </span>
                <span className="text-xs font-bold text-slate-400">all attempts</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, overallAvgExamScore || 50)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-500">
                Evaluated from {gradedAttempts.length} candidate attempts
              </p>
            </div>

            {/* 3. Assignment Completion Rate */}
            <div className="p-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Homework Turn-In Rate</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">{overallAssignmentCompletionRate}%</span>
                <span className="text-xs font-bold text-slate-400">completed</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, overallAssignmentCompletionRate)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-500">
                {allSubmissions.length} of {totalExpectedSubmissions} total practicums submitted
              </p>
            </div>

            {/* 4. Assignment Average Grade */}
            <div className="p-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Avg Assignment Grade</span>
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white font-mono">
                  {overallAvgAssignmentGrade > 0 ? `${overallAvgAssignmentGrade}%` : "Pending"}
                </span>
                <span className="text-xs font-bold text-emerald-400">quality score</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-700"
                  style={{ width: `${Math.min(100, overallAvgAssignmentGrade || 60)}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-500">
                Evaluated across instructor-graded compositions
              </p>
            </div>
          </div>

          {/* Tier-by-Tier Comparative Progress Averages Matrix */}
          <div>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-rose-500" />
              JLPT Tier-by-Tier Comparative Progress & Performance Matrix
            </h3>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <th className="py-3 px-4">JLPT Tier</th>
                    <th className="py-3 px-4 text-center">Active Learners</th>
                    <th className="py-3 px-4">Avg Attendance %</th>
                    <th className="py-3 px-4">Avg Exam Score %</th>
                    <th className="py-3 px-4">Assignment Turn-In</th>
                    <th className="py-3 px-4 text-center">Threshold Met (≥75%)</th>
                    <th className="py-3 px-4 text-center">Cohort Standing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {tierProgress.map((tier) => (
                    <tr key={tier.level} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-white">
                        <span className="px-2.5 py-1 rounded-lg bg-rose-950 text-rose-300 border border-rose-800 font-mono text-xs">
                          {tier.level}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-200">
                        {tier.count} students
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono font-bold text-xs w-12 ${
                              tier.avgAttendance >= 75 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {tier.avgAttendance}%
                          </span>
                          <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                tier.avgAttendance >= 75 ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, tier.avgAttendance)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-200">
                        {tier.avgExamScore > 0 ? `${tier.avgExamScore}%` : "—"}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {tier.assignmentRate}% completion
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold">
                        <span className={tier.eligibilityRate >= 75 ? "text-emerald-400" : "text-amber-400"}>
                          {tier.eligibilityRate}%
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            tier.status === "High Mastery"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : tier.status === "On Track"
                              ? "bg-blue-950 text-blue-300 border border-blue-800"
                              : "bg-rose-950 text-rose-300 border border-rose-800"
                          }`}
                        >
                          {tier.status === "High Mastery" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : tier.status === "On Track" ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {tier.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Exam Attempts Feed with Host Evaluation Link */}
        <div className="mt-8 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-rose-500" />
                Recent Examination Submissions & Proctoring Audit
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect live candidate attempts, anti-cheat violation strikes, and open the host-side evaluation module.
              </p>
            </div>
            <Link
              href="/admin/exams"
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
            >
              Open Host Evaluation Table →
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">JLPT Tier</th>
                  <th className="py-3 px-4 text-center">Attendance</th>
                  <th className="py-3 px-4">Exam Title</th>
                  <th className="py-3 px-4 text-center">Score</th>
                  <th className="py-3 px-4 text-center">Infractions</th>
                  <th className="py-3 px-4 text-center">Final Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {recentAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">
                      No candidate submissions logged yet.
                    </td>
                  </tr>
                ) : (
                  recentAttempts.map((att) => {
                    const totalAtt = att.student.attendances?.length || 0;
                    const presAtt = att.student.attendances?.filter((a) => a.status === "PRESENT").length || 0;
                    const attRate = totalAtt > 0 ? Math.round((presAtt / totalAtt) * 100) : 100;

                    return (
                      <tr key={att.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{att.student.name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800 font-mono">
                            {att.student.courseLevel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                            <span
                              className={`font-mono font-bold text-xs ${
                                attRate >= 75 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {attRate}%
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({presAtt}/{totalAtt}h)
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-300 font-medium">{att.exam.title}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                          {att.score !== null ? `${att.score}/${att.exam.totalMarks}` : "—"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold ${
                              att.cheatCount > 0
                                ? "bg-rose-950 text-rose-300 border border-rose-800"
                                : "text-slate-500"
                            }`}
                          >
                            {att.cheatCount} strikes
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              att.status === "SUBMITTED" || att.status === "AUTO_SUBMITTED" || att.status === "GRADED"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : att.status === "DISQUALIFIED"
                                ? "bg-rose-950 text-rose-300 border border-rose-800"
                                : "bg-amber-950 text-amber-300 border border-amber-800"
                            }`}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Link
                            href="/admin/exams"
                            className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-orange-400 font-semibold text-[11px]"
                          >
                            Evaluate Host Side →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Student Cohort Attendance & Academic Ledger */}
        <div id="attendance" className="mt-8 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-400" />
                Student Cohort Attendance Overview
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Regular classroom session attendance metrics. Offline attendance and marking features are managed in the dedicated Attendance Ledger.
              </p>
            </div>
            <Link
              href="/admin/attendance"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 text-xs font-semibold transition-all shadow-md"
            >
              Open Full Attendance Ledger & Mark Offline →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">JLPT Tier</th>
                  <th className="py-3 px-4">Batch / Section</th>
                  <th className="py-3 px-4">Attendance Rate</th>
                  <th className="py-3 px-4 text-center">Classroom Hours</th>
                  <th className="py-3 px-4 text-center">Compliance Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {enrolledStudents.map((s) => {
                  const totalHours = s.attendances.length;
                  const presentHours = s.attendances.filter((a) => a.status === "PRESENT").length;
                  const rate = totalHours > 0 ? Number(((presentHours / totalHours) * 100).toFixed(1)) : 100;
                  const isEligible = rate >= 75;

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        <div>{s.name}</div>
                        <div className="text-[11px] text-slate-500 font-normal">{s.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800 font-mono">
                          {s.courseLevel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono font-medium">
                        {s.section}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono font-bold text-xs w-12 ${
                              isEligible ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {rate}%
                          </span>
                          <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isEligible ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, rate)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-300">
                        {presentHours} / {totalHours} hrs
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isEligible
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-rose-950 text-rose-300 border border-rose-800"
                          }`}
                        >
                          {isEligible ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {isEligible ? "Eligible (≥75%)" : "Low Attendance"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href="/admin/students"
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-400 hover:text-orange-300 font-semibold text-[11px]"
                        >
                          Edit Batch →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

