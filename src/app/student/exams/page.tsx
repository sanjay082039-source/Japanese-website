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
    <div className="min-h-screen bg-slate-950 pb-16">
      <Navbar user={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
              試験ポータル・Examination Hall
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            JLPT {session.courseLevel} Secure Assessments
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Strict AI proctoring active during sessions: fullscreen lock, DevTools blocking, clipboard isolation, and tab-switch telemetry.
          </p>
        </div>

        {/* Security Notice Card */}
        <div className="mb-8 p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <span className="font-bold text-rose-300 block">
              ZERO-TOLERANCE PROCTORING PROTOCOL ENFORCED
            </span>
            <p className="text-slate-400">
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
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800">
                      Level {exam.courseLevel}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        attempt
                          ? attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : "bg-rose-950 text-rose-300 border border-rose-800"
                          : isWithinWindow
                          ? "bg-rose-600 text-white animate-pulse"
                          : isUpcoming
                          ? "bg-slate-800 text-slate-300"
                          : "bg-slate-900 text-slate-500"
                      }`}
                    >
                      {attempt ? attempt.status : isWithinWindow ? "LIVE NOW" : isUpcoming ? "Upcoming" : "Closed"}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{exam.title}</h3>
                  <p className="text-xs text-slate-400 mb-4">{exam.description || "Official Japanese Language Proficiency Assessment."}</p>

                  <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Duration:</span>
                      <span className="font-semibold text-slate-200">{exam.durationMinutes} Minutes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Marks:</span>
                      <span className="font-semibold text-slate-200">{exam.totalMarks} (Pass: {exam.passingMarks})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Question Pool:</span>
                      <span className="font-semibold text-slate-200">{exam._count.questions} Questions</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Allowed Window:</span>
                      <span className="font-mono text-slate-300">
                        {new Date(exam.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(exam.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  {attempt ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400">Final Score:</span>
                        <p className="text-lg font-black text-white">
                          {attempt.score !== null ? `${attempt.score} / ${exam.totalMarks}` : "Under Evaluation"}
                        </p>
                      </div>
                      <Link
                        href={`/student/exams/${exam.id}`}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                      >
                        Review Results
                      </Link>
                    </div>
                  ) : isWithinWindow ? (
                    <Link
                      href={`/student/exams/${exam.id}`}
                      className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/60 transition-transform hover:scale-[1.02]"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Enter Proctored Exam Room
                    </Link>
                  ) : isUpcoming ? (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl bg-slate-800 text-slate-500 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Lock className="w-4 h-4" />
                      Locked Until Start Window
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3 rounded-xl bg-slate-900 text-slate-600 font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed"
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
