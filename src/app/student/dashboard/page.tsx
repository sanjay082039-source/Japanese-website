import React from "react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Navbar from "@/components/navigation/Navbar";
import {
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Award,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // 1. Fetch Student Attendance Data (Regular system attendance - offline marks excluded from overview)
  const attendances = await prisma.attendance.findMany({
    where: { studentId: session.id, isOffline: false },
    orderBy: { date: "desc" },
  });

  const totalClasses = attendances.length;
  const presentCount = attendances.filter((a) => a.status === "PRESENT").length;
  const absentCount = attendances.filter((a) => a.status === "ABSENT").length;
  const leaveCount = attendances.filter((a) => a.status === "ON_LEAVE").length;

  const attendanceRate = totalClasses > 0 ? Number(((presentCount / totalClasses) * 100).toFixed(1)) : 100;

  // Group attendance by subject
  const subjectMap: Record<string, { present: number; total: number }> = {};
  attendances.forEach((a) => {
    const subj = a.subject || "Japanese Language";
    if (!subjectMap[subj]) {
      subjectMap[subj] = { present: 0, total: 0 };
    }
    subjectMap[subj].total += 1;
    if (a.status === "PRESENT") subjectMap[subj].present += 1;
  });

  // 2. Fetch Active & Upcoming Exams for Student's Level
  const now = new Date();
  const exams = await prisma.exam.findMany({
    where: {
      courseLevel: session.courseLevel,
      isPublished: true,
    },
    include: {
      attempts: {
        where: { studentId: session.id },
      },
      _count: {
        select: { questions: true },
      },
    },
    orderBy: { startTime: "asc" },
  });

  // 3. Fetch Student Assignments
  const assignments = await prisma.assignment.findMany({
    where: {
      courseLevel: session.courseLevel,
      isPublished: true,
    },
    include: {
      submissions: {
        where: { studentId: session.id },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // 4. Fetch Today's Timetable Slots
  const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const todaySlots = await prisma.timetableSlot.findMany({
    where: {
      courseLevel: session.courseLevel,
      dayOfWeek: currentDayOfWeek,
    },
    include: {
      staff: true,
    },
    orderBy: { startTime: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      <Navbar user={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {session.name}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              JLPT {session.courseLevel} (Section {session.section}) • Academic standing, attendance logs, and schedules.
            </p>
          </div>


          <div className="flex items-center gap-3">
            <Link
              href="/student/exams"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all shadow-lg shadow-rose-900/30"
            >
              <ShieldCheck className="w-4 h-4" />
              Proctored Exam Room
            </Link>
          </div>
        </div>

        {/* Attendance Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
          {/* Overall Attendance Rate */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Overall Attendance
              </span>
              <Clock className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{attendanceRate}%</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  attendanceRate >= 75
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                }`}
              >
                {attendanceRate >= 75 ? "Threshold Met (≥75%)" : "At Risk (<75%)"}
              </span>
            </div>
            <div className="mt-3 w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  attendanceRate >= 75 ? "bg-emerald-500" : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(100, attendanceRate)}%` }}
              ></div>
            </div>
          </div>

          {/* Present Hours */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Present Hours
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">{presentCount}</span>
              <span className="text-xs text-slate-400">/ {totalClasses} classes</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Active lecture hours completed</p>
          </div>

          {/* Absent Hours */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Absent Hours
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-400">{absentCount}</span>
              <span className="text-xs text-slate-400">unexcused</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Requires verification for exam permit</p>
          </div>

          {/* Approved Leaves */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                On Leave (Approved)
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400">{leaveCount}</span>
              <span className="text-xs text-slate-400">authorized</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Medical or emergency leaves logged</p>
          </div>
        </div>

        {/* Main Content Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Left Column (2 Cols): Examinations & Timetable */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active & Scheduled Examinations */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-rose-500" />
                  <h2 className="text-lg font-bold text-white">Active & Scheduled Examinations</h2>
                </div>
                <Link
                  href="/student/exams"
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                >
                  View All Exams <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {exams.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No active examinations scheduled for JLPT {session.courseLevel} currently.
                  </div>
                ) : (
                  exams.map((exam) => {
                    const studentAttempt = exam.attempts[0];
                    const isWithinWindow = now >= exam.startTime && now <= exam.endTime;
                    const isPast = now > exam.endTime;
                    const isUpcoming = now < exam.startTime;

                    return (
                      <div
                        key={exam.id}
                        className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                              {exam.courseLevel}
                            </span>
                            <h3 className="text-sm font-bold text-slate-200">{exam.title}</h3>
                          </div>
                          <p className="text-xs text-slate-400">
                            Duration: {exam.durationMinutes} mins | Total Marks: {exam.totalMarks} | Questions: {exam._count.questions}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Window: {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{" "}
                            {new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div>
                          {studentAttempt ? (
                            <div className="text-right">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  studentAttempt.status === "SUBMITTED" || studentAttempt.status === "AUTO_SUBMITTED"
                                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                    : studentAttempt.status === "DISQUALIFIED"
                                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                                    : "bg-amber-950 text-amber-300 border border-amber-800"
                                }`}
                              >
                                {studentAttempt.status}
                              </span>
                              {studentAttempt.score !== null && (
                                <p className="text-xs font-bold text-slate-300 mt-1">
                                  Score: {studentAttempt.score} / {exam.totalMarks}
                                </p>
                              )}
                            </div>
                          ) : isWithinWindow ? (
                            <Link
                              href={`/student/exams/${exam.id}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/60 transition-transform hover:scale-105"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Start Exam (Proctored)
                            </Link>
                          ) : isUpcoming ? (
                            <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
                              Upcoming
                            </span>
                          ) : (
                            <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-slate-500">
                              Expired
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Today's Hourly Timetable Preview */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-rose-500" />
                  <h2 className="text-lg font-bold text-white">Today&apos;s Class Schedule</h2>
                </div>
                <Link
                  href="/student/timetable"
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                >
                  Full Weekly Grid <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="mt-4 space-y-2">
                {todaySlots.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    No lecture sessions scheduled for today. Recommended: Self-study vocabulary and grammar review.
                  </div>
                ) : (
                  todaySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-semibold px-2 py-1 rounded bg-slate-800 text-slate-300">
                          {slot.startTime} - {slot.endTime}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-200">{slot.subject}</p>
                          <p className="text-xs text-slate-400">
                            Instructor: {slot.staff?.name || "Faculty Member"} | {slot.room || "Room 101"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                        {slot.courseLevel}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column (1 Col): Subject Attendance Breakdown & Assignments */}
          <div className="space-y-8">
            {/* Subject-Wise Attendance Breakdown */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 pb-4 border-b border-slate-800">
                <BookOpen className="w-5 h-5 text-rose-500" />
                <h2 className="text-lg font-bold text-white">Subject Attendance</h2>
              </div>

              <div className="mt-4 space-y-4">
                {Object.keys(subjectMap).length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-xs">
                    No subject records recorded yet.
                  </div>
                ) : (
                  Object.entries(subjectMap).map(([subject, stats]) => {
                    const rate = Number(((stats.present / stats.total) * 100).toFixed(0));
                    return (
                      <div key={subject} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">{subject}</span>
                          <span className="text-slate-400 font-mono">
                            {stats.present}/{stats.total} ({rate}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              rate >= 75 ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${rate}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 text-center">
                <Link
                  href="/student/attendance"
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                >
                  View Complete Attendance Logs →
                </Link>
              </div>
            </div>

            {/* Assignments Due */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-rose-500" />
                  <h2 className="text-lg font-bold text-white">Assignments</h2>
                </div>
                <Link
                  href="/student/assignments"
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                >
                  View All
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {assignments.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-xs">
                    No active assignments for JLPT {session.courseLevel}.
                  </div>
                ) : (
                  assignments.slice(0, 3).map((assign) => {
                    const isSubmitted = assign.submissions.length > 0;
                    return (
                      <div
                        key={assign.id}
                        className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-200 line-clamp-1">
                            {assign.title}
                          </h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              isSubmitted
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : "bg-amber-950 text-amber-300 border border-amber-800"
                            }`}
                          >
                            {isSubmitted ? "Submitted" : "Pending"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Due: {new Date(assign.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
