import React from "react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Navbar from "@/components/navigation/Navbar";
import AnalyticsSparkline7 from "@/components/dashboard/AnalyticsSparkline7";
import {
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Award,
  Sparkles,
  Headphones,
  CheckCircle2,
  Video,
  FileText,
  UserCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  // 1. Fetch Student Attendance Data
  const allSessions = await prisma.courseSession.findMany({
    orderBy: { startTime: "desc" },
  });
  const attendances = await prisma.attendance.findMany({
    where: { studentId: session.id },
    include: { session: true },
    orderBy: { timestamp: "desc" },
  });

  const totalClasses = allSessions.length;
  const presentCount = attendances.length;
  const absentCount = Math.max(0, totalClasses - presentCount);
  const leaveCount = 0;

  const attendanceRate = totalClasses > 0 ? Number(((presentCount / totalClasses) * 100).toFixed(1)) : 100;

  // Group attendance by subject/course
  const subjectMap: Record<string, { present: number; total: number }> = {};
  allSessions.forEach((s) => {
    const subj = s.courseName || s.courseCode || "Japanese Language";
    if (!subjectMap[subj]) {
      subjectMap[subj] = { present: 0, total: 0 };
    }
    subjectMap[subj].total += 1;
  });
  attendances.forEach((a) => {
    const subj = a.session?.courseName || a.session?.courseCode || "Japanese Language";
    if (subjectMap[subj]) {
      subjectMap[subj].present += 1;
    }
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

  // 5. Fetch Curriculum Chapters for Student's Level
  const chapters = await prisma.chapter.findMany({
    where: { courseLevel: session.courseLevel },
    include: {
      progresses: {
        where: { studentId: session.id },
      },
    },
    orderBy: { chapterNumber: "asc" },
  });

  const completedChaptersCount = chapters.filter(
    (c) => c.progresses[0]?.videoCompleted
  ).length;

  const curriculumProgressPct =
    chapters.length > 0
      ? Math.round((completedChaptersCount / chapters.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-japanese-canvas text-slate-900 pb-20 selection:bg-[#d9381e]/15 selection:text-slate-900">
      <Navbar user={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Japanese Academic Crest Header */}
        <section className="relative overflow-hidden rounded-3xl border border-[#e7e2d7] bg-white p-6 sm:p-8 shadow-xl">
          {/* Subtle Japanese Watermark */}
          <div className="absolute -right-6 -bottom-8 select-none pointer-events-none text-8xl font-black font-japanese text-slate-900/[0.03]">
            日本大学院
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Student Profile Info */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              {/* Hanko Seal Avatar */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#f8f6f0] border-2 border-[#d9381e]/50 flex items-center justify-center text-[#c53018] font-extrabold text-xl shadow-md shadow-[#d9381e]/10 shrink-0">
                <span className="font-japanese">
                  {session.name.slice(0, 1)}
                </span>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#15803d] border-2 border-white flex items-center justify-center text-[10px] text-white">
                  ✓
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {session.name}
                  </h1>
                  {/* Hanko Stamp Pill */}
                  <span className="hanko-badge">
                    JLPT {session.courseLevel} • Section {session.section}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      attendanceRate >= 75
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    <UserCheck className="w-3 h-3" />
                    {attendanceRate >= 75 ? "Exam Permit Approved" : "Permit Review Required"}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  RIT College of Japanese Studies • Academic Record, Continuous Attendance & AI Studio
                </p>
              </div>
            </div>

            {/* Quick Action Navigation Pills */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/student/ai-sensei"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] hover:opacity-95 text-white font-bold text-xs transition-all shadow-md shadow-[#1d4ed8]/25 hover:scale-[1.02] active:scale-95"
              >
                <Headphones className="w-4 h-4 text-sky-200" />
                <span>AI Sensei Voice Studio</span>
                <span className="w-2 h-2 rounded-full bg-sky-300 animate-ping" />
              </Link>

              <Link
                href="/student/exams"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d9381e] hover:bg-[#b82e18] text-white font-bold text-xs transition-all shadow-md shadow-[#d9381e]/25 hover:scale-[1.02] active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Proctored Exam Room</span>
              </Link>

              <Link
                href="/student/timetable"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-[#e7e2d7] text-slate-700 font-semibold text-xs transition-all shadow-xs"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Timetable</span>
              </Link>
            </div>
          </div>
        </section>

        {/* React Bits Pro "Analytics 7": Sparkline Cards with Detail Panel */}
        <section className="rounded-3xl border border-[#e7e2d7] bg-white p-5 sm:p-7 shadow-xl">
          <AnalyticsSparkline7
            attendanceRate={attendanceRate}
            presentCount={presentCount}
            totalClasses={totalClasses}
            absentCount={absentCount}
            courseLevel={session.courseLevel}
            examCount={exams.length}
          />
        </section>

        {/* Quick Academic Status Strip (4 Japanese Washi Cards) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-japanese p-4 flex items-center justify-between border-l-4 border-l-[#1d4ed8]">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Total Classes
              </span>
              <p className="text-2xl font-black text-slate-900 tabular-nums mt-1">{totalClasses}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#1d4ed8]/10 border border-[#1d4ed8]/20 flex items-center justify-center text-[#1d4ed8]">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="card-japanese p-4 flex items-center justify-between border-l-4 border-l-[#15803d]">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Classes Attended
              </span>
              <p className="text-2xl font-black text-[#15803d] tabular-nums mt-1">{presentCount}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#15803d]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="card-japanese p-4 flex items-center justify-between border-l-4 border-l-[#d9381e]">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Unexcused Absences
              </span>
              <p className="text-2xl font-black text-[#c53018] tabular-nums mt-1">{absentCount}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#c53018]">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="card-japanese p-4 flex items-center justify-between border-l-4 border-l-[#b45309]">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Curriculum Progress
              </span>
              <p className="text-2xl font-black text-[#b45309] tabular-nums mt-1">
                {curriculumProgressPct}%
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#b45309]">
              <Video className="w-4 h-4" />
            </div>
          </div>
        </section>

        {/* Organized Two-Column Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2 Cols): Examinations, Timetable, Curriculum */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active & Scheduled Examinations (試験スケジュール) */}
            <div className="card-japanese p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#e7e2d7]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-[#d9381e]">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>Active & Scheduled Examinations</span>
                      <span className="font-japanese text-xs text-slate-500 font-normal">
                        (試験スケジュール)
                      </span>
                    </h2>
                  </div>
                </div>
                <Link
                  href="/student/exams"
                  className="text-xs text-[#d9381e] hover:text-[#b82e18] font-semibold flex items-center gap-1 transition-colors"
                >
                  View All <ArrowRight className="w-3.5 h-3.5" />
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
                        className="bg-[#f8f6f0] border border-[#e7e2d7] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 transition-all card-japanese-interactive"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 font-mono">
                              JLPT {exam.courseLevel}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900">{exam.title}</h3>
                          </div>
                          <p className="text-xs text-slate-500">
                            Duration: {exam.durationMinutes} mins • Total Marks: {exam.totalMarks} • Questions: {exam._count.questions}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Window: {new Date(exam.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{" "}
                            {new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div>
                          {studentAttempt ? (
                            <div className="text-right sm:text-right">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  studentAttempt.status === "SUBMITTED" || studentAttempt.status === "AUTO_SUBMITTED"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : studentAttempt.status === "DISQUALIFIED"
                                    ? "bg-rose-50 text-rose-800 border border-rose-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {studentAttempt.status}
                              </span>
                              {studentAttempt.score !== null && (
                                <p className="text-xs font-bold text-slate-800 mt-1">
                                  Score: {studentAttempt.score} / {exam.totalMarks}
                                </p>
                              )}
                            </div>
                          ) : isWithinWindow ? (
                            <Link
                              href={`/student/exams/${exam.id}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#d9381e] hover:bg-[#b82e18] text-white font-bold text-xs shadow-md shadow-[#d9381e]/25 transition-transform hover:scale-105 active:scale-95"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Start Exam (Proctored)
                            </Link>
                          ) : isUpcoming ? (
                            <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                              Upcoming
                            </span>
                          ) : (
                            <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400">
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

            {/* Today's Hourly Timetable (本日のお時間割) */}
            <div className="card-japanese p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#e7e2d7]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1d4ed8]">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>Today&apos;s Class Schedule</span>
                      <span className="font-japanese text-xs text-slate-500 font-normal">
                        (本日のお時間割)
                      </span>
                    </h2>
                  </div>
                </div>
                <Link
                  href="/student/timetable"
                  className="text-xs text-[#1d4ed8] hover:text-[#2563eb] font-semibold flex items-center gap-1 transition-colors"
                >
                  Full Weekly Grid <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="mt-4 space-y-2.5">
                {todaySlots.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    No lecture sessions scheduled for today. Recommended: Self-study vocabulary drills and Sensei AI practice.
                  </div>
                ) : (
                  todaySlots.map((slot, idx) => (
                    <div
                      key={slot.id}
                      className="p-3.5 bg-[#f8f6f0] border border-[#e7e2d7] rounded-2xl flex items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-white text-slate-700 border border-[#e7e2d7] shadow-xs">
                          {slot.startTime} – {slot.endTime}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span>{slot.subject}</span>
                            <span className="text-[10px] text-slate-500 font-japanese">
                              ({idx + 1}限目)
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Instructor: {slot.staff?.name || "Faculty Member"} • {slot.room || "Room 101"}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1d4ed8]/10 text-[#1d4ed8] border border-[#1d4ed8]/20 font-bold font-mono">
                        {slot.courseLevel}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* JLPT Curriculum Progression & Chapters (シラバス進捗) */}
            <div className="card-japanese p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#e7e2d7]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#b45309]">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <span>Curriculum Progression</span>
                      <span className="font-japanese text-xs text-slate-500 font-normal">
                        (シラバス進捗)
                      </span>
                    </h2>
                  </div>
                </div>
                <Link
                  href="/student/chapters"
                  className="text-xs text-[#b45309] hover:text-[#92400e] font-semibold flex items-center gap-1 transition-colors"
                >
                  All Chapters <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-700 font-semibold">
                    JLPT {session.courseLevel} Course Modules
                  </span>
                  <span className="font-mono text-slate-500">
                    {completedChaptersCount} of {chapters.length} Modules Completed ({curriculumProgressPct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-300/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#15803d] transition-all duration-500"
                    style={{ width: `${curriculumProgressPct}%` }}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {chapters.slice(0, 4).map((ch) => {
                    const isDone = ch.progresses[0]?.videoCompleted;
                    return (
                      <Link
                        key={ch.id}
                        href="/student/chapters"
                        className="p-3 rounded-xl bg-[#f8f6f0] border border-[#e7e2d7] hover:border-slate-300 flex items-center justify-between gap-3 text-xs transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">
                            Lesson {ch.chapterNumber}: {ch.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {Math.round(ch.durationSeconds / 60)} mins video lecture
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                            isDone
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {isDone ? "Done" : "Start"}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (1 Col): Subject Attendance, Assignments, Sensei Tip */}
          <div className="space-y-8">
            {/* Subject-Wise Attendance Breakdown (科目別出席状況) */}
            <div className="card-japanese p-6 shadow-xl">
              <div className="flex items-center gap-2.5 pb-4 border-b border-[#e7e2d7]">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#15803d]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Subject Attendance</span>
                    <span className="font-japanese text-xs text-slate-500 font-normal">
                      (科目別出席)
                    </span>
                  </h2>
                </div>
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
                          <span className="font-semibold text-slate-800">{subject}</span>
                          <span className="text-slate-500 font-mono">
                            {stats.present}/{stats.total} ({rate}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden border border-slate-300/40">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              rate >= 75 ? "bg-[#15803d]" : "bg-[#d9381e]"
                            }`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-[#e7e2d7] text-center">
                <Link
                  href="/student/attendance"
                  className="text-xs text-[#d9381e] hover:text-[#b82e18] font-semibold transition-colors"
                >
                  View Complete Attendance Logs →
                </Link>
              </div>
            </div>

            {/* Assignments & Homework Due (課題提出) */}
            <div className="card-japanese p-6 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-[#e7e2d7]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-[#d9381e]">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <span>Assignments</span>
                      <span className="font-japanese text-xs text-slate-500 font-normal">
                        (課題提出)
                      </span>
                    </h2>
                  </div>
                </div>
                <Link
                  href="/student/assignments"
                  className="text-xs text-[#d9381e] hover:text-[#b82e18] font-semibold transition-colors"
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
                        className="p-3.5 bg-[#f8f6f0] border border-[#e7e2d7] rounded-xl space-y-1 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                            {assign.title}
                          </h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              isSubmitted
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {isSubmitted ? "Submitted" : "Pending"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          Due: {new Date(assign.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Sensei AI Daily Study Tip (AI先生の学習メモ) */}
            <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white p-5 shadow-xl relative overflow-hidden text-slate-800">
              <div className="flex items-center gap-2 pb-3 border-b border-blue-100">
                <Sparkles className="w-4 h-4 text-[#1d4ed8]" />
                <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                  Sensei AI Daily Tip (本日の学習メモ)
                </h3>
              </div>

              <div className="mt-3 space-y-2 text-xs text-slate-700 leading-relaxed">
                <p className="font-semibold text-blue-900">
                  「は」 vs 「が」 (Topic vs Subject Particle):
                </p>
                <p>
                  Remember: <strong>は (wa)</strong> marks the known topic of conversation, whereas <strong>が (ga)</strong> brings fresh, emphasized information into focus!
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-blue-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Fine-Tuned Qwen2.5 QLoRA</span>
                <Link
                  href="/student/ai-sensei"
                  className="text-xs font-bold text-[#1d4ed8] hover:text-[#2563eb] flex items-center gap-1"
                >
                  Open Voice Studio →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
