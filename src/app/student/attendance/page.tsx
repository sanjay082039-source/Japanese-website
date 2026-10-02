import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Navbar from "@/components/navigation/Navbar";
import { Clock, Calendar, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentAttendancePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const attendances = await prisma.attendance.findMany({
    where: { studentId: session.id },
    orderBy: { date: "desc" },
  });

  const total = attendances.length;
  const present = attendances.filter((a) => a.status === "PRESENT").length;
  const absent = attendances.filter((a) => a.status === "ABSENT").length;
  const onLeave = attendances.filter((a) => a.status === "ON_LEAVE").length;
  const rate = total > 0 ? Number(((present / total) * 100).toFixed(1)) : 100;

  // Subject statistics
  const subjectMap: Record<string, { present: number; total: number }> = {};
  attendances.forEach((a) => {
    const s = a.subject || "General JLPT";
    if (!subjectMap[s]) subjectMap[s] = { present: 0, total: 0 };
    subjectMap[s].total++;
    if (a.status === "PRESENT") subjectMap[s].present++;
  });

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      <Navbar user={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
              出席簿・Attendance Registry
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Individual Attendance Ledger
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Subject-wise logs and hour-by-hour status records for JLPT {session.courseLevel}.
          </p>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs text-slate-400 uppercase font-semibold">Attendance Rate</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{rate}%</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  rate >= 75
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-rose-950 text-rose-300 border border-rose-800"
                }`}
              >
                {rate >= 75 ? "Exam Eligible" : "Action Required"}
              </span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs text-slate-400 uppercase font-semibold">Present Hours</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">{present}</span>
              <span className="text-xs text-slate-400">/ {total} sessions</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs text-slate-400 uppercase font-semibold">Unexcused Absences</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-400">{absent}</span>
              <span className="text-xs text-slate-400">sessions</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <span className="text-xs text-slate-400 uppercase font-semibold">Approved Leaves</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-400">{onLeave}</span>
              <span className="text-xs text-slate-400">sanctioned</span>
            </div>
          </div>
        </div>

        {/* Subject-Wise Breakdown Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-500" />
            Subject-Wise Attendance Breakdown
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(subjectMap).map(([subj, stats]) => {
              const subjRate = Number(((stats.present / stats.total) * 100).toFixed(0));
              return (
                <div key={subj} className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-200">{subj}</span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        subjRate >= 75 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {subjRate}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        subjRate >= 75 ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${subjRate}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Present: {stats.present}</span>
                    <span>Total: {stats.total} hrs</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Hour-by-Hour Logs Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rose-500" />
            Hourly Session History Log
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Hour Slot</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {attendances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No attendance records found.
                    </td>
                  </tr>
                ) : (
                  attendances.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium">
                        {new Date(item.date).toLocaleDateString("en-US", {
                          weekday: "short",
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{item.hourSlot}</td>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        {item.subject}
                        {item.isOffline && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                            OFFLINE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.status === "PRESENT" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Present
                          </span>
                        )}
                        {item.status === "ABSENT" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                            <XCircle className="w-3 h-3" /> Absent
                          </span>
                        )}
                        {item.status === "ON_LEAVE" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                            <AlertCircle className="w-3 h-3" /> On Leave
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{item.remarks || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
