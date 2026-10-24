import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Navbar from "@/components/navigation/Navbar";
import Link from "next/link";
import { ShieldCheck, Clock, CheckCircle, AlertTriangle, ArrowRight, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentExamsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const now = new Date();
  const exams = await prisma.exam.findMany({
    where: {
      courseLevel: session.courseLevel,
      isPublished: true,
    },
    include: {
      attempts: {
        where: { studentId: session.id },
        include: { violations: true },
      },
      _count: {
        select: { questions: true },
      },
    },
    orderBy: { startTime: "asc" },
  });

  return (
    <div className="min-h-screen bg-japanese-canvas pb-16">
      <Navbar user={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
              Examination Portal
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            JLPT {session.courseLevel} Secure Assessments
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Strict AI proctoring active during sessions: fullscreen lock, DevTools blocking, clipboard isolation, and tab-switch telemetry.
          </p>
        </div>

        {/* Security Notice Card */}
        <div className="mb-8 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-700 space-y-1">
            <span className="font-bold text-rose-800 block">
              ZERO-TOLERANCE PROCTORING PROTOCOL ENFORCED
            </span>
            <p className="text-slate-600">
              Exam timers are strictly synchronized with our atomic server clock. Switching browser tabs, attempting shortcuts (F12, Ctrl+C, Ctrl+V), or exiting Fullscreen mode generates infraction logs. 3 infractions result in immediate session disqualification.
            </p>
          </div>
        </div>

        {/* Exam Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exams.map((exam) => {
            const attempt = exam.attempts[0];
            const isWithinWindow = now >= exam.startTime && now <= exam.endTime;
            const isPast = now > exam.endTime;
            const isUpcoming = now < exam.startTime;

            return (
              <div
                key={exam.id}
                className="bg-white border border-[#E2DDD5] rounded-2xl p-6 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Level {exam.courseLevel}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        attempt
                          ? attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                          : isWithinWindow
                          ? "bg-[#d9381e] text-white animate-pulse"
                          : isUpcoming
                          ? "bg-slate-100 text-slate-700 border border-[#E2DDD5]"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {attempt ? attempt.status : isWithinWindow ? "LIVE NOW" : isUpcoming ? "Upcoming" : "Closed"}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-2">{exam.title}</h3>
                  <p className="text-xs text-slate-600 mb-4">{exam.description || "Official Japanese Language Proficiency Assessment."}</p>

                  <div className="space-y-2 text-xs text-slate-700 bg-[#FAF8F5] p-3 rounded-xl border border-[#E2DDD5]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Duration:</span>
                      <span className="font-semibold text-slate-900">{exam.durationMinutes} Minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Marks:</span>
                      <span className="font-semibold text-slate-900">{exam.totalMarks} (Pass: {exam.passingMarks})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Question Pool:</span>
                      <span className="font-semibold text-slate-900">{exam._count.questions} Questions</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Allowed Window:</span>
                      <span className="font-mono text-slate-700">
                        {new Date(exam.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(exam.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#E2DDD5]">
                  {attempt ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-500">Final Score:</span>
                        <p className="text-lg font-black text-slate-900">
                          {attempt.score !== null ? `${attempt.score} / ${exam.totalMarks}` : "Under Evaluation"}
                        </p>
                      </div>
                      <Link
                        href={`/student/exams/${exam.id}`}
                        className="px-4 py-2 rounded-xl bg-[#FAF8F5] hover:bg-slate-100 text-xs font-semibold text-slate-800 border border-[#E2DDD5]"
                      >
                        Review Results
                      </Link>
                    </div>
                  ) : isWithinWindow ? (
                    <Link
                      href={`/student/exams/${exam.id}`}
                      className="w-full py-3 rounded-xl bg-[#d9381e] hover:bg-[#b92c15] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-transform hover:scale-[1.02]"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Enter Proctored Exam Room
                    </Link>
                  ) : isUpcoming ? (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl bg-[#FAF8F5] text-slate-400 font-semibold text-xs flex items-center justify-center gap-2 border border-[#E2DDD5] cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4" />
                      Locked Until Start Window
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      Exam Session Closed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
