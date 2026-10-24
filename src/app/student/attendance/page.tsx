import React from "react";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Navbar from "@/components/navigation/Navbar";
import Link from "next/link";
import {
  Clock,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  MapPin,
  Smartphone,
  ArrowRight,
  Sparkles,
  Info,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentAttendancePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch all course sessions
  const allSessions = await prisma.courseSession.findMany({
    orderBy: { startTime: "desc" },
  });

  // Fetch attendance records for this student
  const attendances = await prisma.attendance.findMany({
    where: { studentId: session.id },
    include: {
      session: true,
    },
    orderBy: { timestamp: "desc" },
  });

  const totalSessions = allSessions.length;
  const attendedCount = attendances.length;
  const missedCount = Math.max(0, totalSessions - attendedCount);
  const rate =
    totalSessions > 0
      ? Number(((attendedCount / totalSessions) * 100).toFixed(1))
      : 100;

  const avgDistance =
    attendedCount > 0
      ? (
          attendances.reduce((acc, a) => acc + (a.distanceMeters || 0), 0) /
          attendedCount
        ).toFixed(1)
      : "0.0";

  // Course-wise aggregation
  const courseMap: Record<
    string,
    { name: string; present: number; total: number }
  > = {};

  allSessions.forEach((s) => {
    const code = s.courseCode || "JLPT";
    if (!courseMap[code]) {
      courseMap[code] = {
        name: s.courseName || "Japanese Course",
        present: 0,
        total: 0,
      };
    }
    courseMap[code].total++;
  });

  attendances.forEach((a) => {
    const code = a.session?.courseCode || "JLPT";
    if (courseMap[code]) {
      courseMap[code].present++;
    }
  });

  return (
    <div className="min-h-screen bg-japanese-canvas pb-16">
      <Navbar user={session} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header Section */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#7A8B6B] font-semibold border border-[#7A8B6B]/30">
                Anti-Cheat Attendance
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-[#C5A059] font-mono border border-[#C5A059]/30 font-bold">
                GPS & Device Locked
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
              Student Attendance Ledger
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Real-time cryptographic verification ledger for JLPT{" "}
              {session.courseLevel} ({session.section}).
            </p>
          </div>

          {/* Quick Action Button to Mobile Scanner */}
          <Link
            href="/student/scan"
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#2E3033] via-[#7A8B6B] to-[#C5A059] hover:opacity-95 text-white font-bold shadow-md border border-[#E2DDD5] transition-all hover:scale-[1.02] active:scale-[0.98] group cursor-pointer"
          >
            <QrCode className="w-5 h-5 text-white/90 group-hover:rotate-12 transition-transform" />
            <span>Open QR Scanner</span>
            <ArrowRight className="w-4 h-4 text-white/90 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Live Scanner Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50/60 via-white to-amber-50/40 border border-[#E2DDD5] p-6 sm:p-8 mb-8 shadow-sm">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#7A8B6B]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-[#7A8B6B] text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-[#C5A059]" />
                In-Class Verification Active
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Ready to mark attendance for today's lecture?
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Scan the dynamic 5-second rotating QR code projected on the classroom screen.
                Our anti-cheat engine verifies your live GPS geofence (within 50 meters) and
                physical device hardware signature to ensure instant attendance confirmation.
              </p>
            </div>

            <Link
              href="/student/scan"
              className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#2E3033] hover:bg-slate-800 text-white font-black text-sm uppercase tracking-wider transition-all shadow-md cursor-pointer"
            >
              <QrCode className="w-5 h-5" />
              Launch Camera Scanner
            </Link>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#E2DDD5] rounded-2xl p-5 shadow-sm">
            <span className="text-xs text-slate-500 uppercase font-semibold">
              Attendance Rate
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{rate}%</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  rate >= 75
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"
                }`}
              >
                {rate >= 75 ? "Exam Eligible" : "Low Attendance"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {rate >= 75
                ? "Above JLPT 75% examination threshold"
                : "Needs attendance recovery to appear in tests"}
            </p>
          </div>

          <div className="bg-white border border-[#E2DDD5] rounded-2xl p-5 shadow-sm">
            <span className="text-xs text-slate-500 uppercase font-semibold">
              Sessions Attended
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#7A8B6B]">
                {attendedCount}
              </span>
              <span className="text-xs text-slate-500">/ {totalSessions} total</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Cryptographically verified check-ins
            </p>
          </div>

          <div className="bg-white border border-[#E2DDD5] rounded-2xl p-5 shadow-sm">
            <span className="text-xs text-slate-500 uppercase font-semibold">
              Missed Sessions
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-600">
                {missedCount}
              </span>
              <span className="text-xs text-slate-500">unattended</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Absences recorded by class closure
            </p>
          </div>

          <div className="bg-white border border-[#E2DDD5] rounded-2xl p-5 shadow-sm">
            <span className="text-xs text-slate-500 uppercase font-semibold">
              Classroom Proximity
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#C5A059]">
                {avgDistance}m
              </span>
              <span className="text-xs text-slate-500 font-mono">avg radius</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Geofence limit: 50.0m from projector
            </p>
          </div>
        </div>

        {/* Subject / Course Breakdown */}
        {Object.keys(courseMap).length > 0 && (
          <div className="bg-white border border-[#E2DDD5] rounded-2xl p-6 mb-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#7A8B6B]" />
              Course Module Attendance
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(courseMap).map(([code, stats]) => {
                const courseRate =
                  stats.total > 0
                    ? Number(((stats.present / stats.total) * 100).toFixed(0))
                    : 100;
                return (
                  <div
                    key={code}
                    className="p-4 bg-[#FAF8F5] border border-[#E2DDD5] rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-[#7A8B6B]">
                          {code}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {stats.name}
                        </h4>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          courseRate >= 75
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {courseRate}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          courseRate >= 75 ? "bg-[#7A8B6B]" : "bg-rose-500"
                        }`}
                        style={{ width: `${courseRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Attended: {stats.present}</span>
                      <span>Total: {stats.total} sessions</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Detailed Verified Attendance Logs */}
        <div className="bg-white border border-[#E2DDD5] rounded-2xl p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#7A8B6B]" />
                Verified Attendance History
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Each check-in includes GPS distance audit and hardware device signature.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-600 bg-[#FAF8F5] px-3 py-1 rounded-full border border-[#E2DDD5] self-start sm:self-auto">
              Total Recorded: {attendances.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] text-slate-700 uppercase font-semibold border-b border-[#E2DDD5]">
                  <th className="py-3 px-4">Session Date & Time</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Proximity Distance</th>
                  <th className="py-3 px-4">Status & Anti-Cheat</th>
                  <th className="py-3 px-4">Hardware Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DDD5] text-slate-700">
                {attendances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Info className="w-6 h-6 text-slate-400" />
                        <p>No verified attendance sessions recorded yet.</p>
                        <p className="text-[11px] text-slate-400">
                          Use the QR scanner during live classroom sessions to register your attendance.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  attendances.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-[#FAF8F5]/80 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {new Date(item.timestamp).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {new Date(item.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-[#7A8B6B]">
                          {item.session?.courseCode || "JLPT"}
                        </span>
                        <div className="text-[11px] text-slate-600">
                          {item.session?.courseName || "Japanese Lecture"}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono">
                          <MapPin className="w-3.5 h-3.5 text-[#7A8B6B]" />
                          <span className="font-bold text-slate-900">
                            {item.distanceMeters.toFixed(1)}m
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          from projector beacon
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#7A8B6B]" />
                          GPS & Device Verified
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.deviceHash.slice(0, 10)}...</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          IP: {item.ipAddress}
                        </span>
                      </td>
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
