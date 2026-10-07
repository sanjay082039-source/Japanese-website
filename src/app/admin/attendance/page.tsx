"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/navigation/Navbar";
import { UserSession } from "@/lib/types";
import {
  QrCode,
  Users,
  MapPin,
  Clock,
  Plus,
  Play,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Compass,
  X,
  FileSpreadsheet,
} from "lucide-react";

interface SessionItem {
  id: string;
  courseCode: string;
  courseName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  targetLatitude: number;
  targetLongitude: number;
  radiusMeters: number;
  _count: { attendances: number };
}

export default function AdminAttendancePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [overallRate, setOverallRate] = useState<number>(85.0);
  const [totalCheckins, setTotalCheckins] = useState<number>(0);
  const [logs, setLogs] = useState<any[]>([]);

  // Create Session Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [courseCode, setCourseCode] = useState("JPN-101");
  const [courseName, setCourseName] = useState("Elementary Japanese I (JLPT N5)");
  const [lat, setLat] = useState("35.6895");
  const [lon, setLon] = useState("139.6917");
  const [radius, setRadius] = useState("50");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const authRes = await fetch("/api/auth/me");
        const authData = await authRes.json();
        if (!authData.user || authData.user.role !== "ADMIN") {
          router.push("/login");
          return;
        }
        setUser(authData.user);

        // Fetch sessions
        const sessRes = await fetch("/api/attendance?mode=sessions");
        if (sessRes.ok) {
          const sData = await sessRes.json();
          setSessions(sData.sessions || []);
          if (sData.overallRate != null) setOverallRate(sData.overallRate);
          if (sData.totalCheckins != null) setTotalCheckins(sData.totalCheckins);
        }

        // Fetch logs
        const logsRes = await fetch("/api/attendance?mode=logs");
        if (logsRes.ok) {
          const lData = await logsRes.json();
          setLogs(lData.logs || []);
        }
      } catch (err) {
        console.error("Failed to load attendance dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  // Use current GPS location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
      },
      (err) => {
        alert(`Could not get location: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseCode,
          courseName,
          targetLatitude: parseFloat(lat),
          targetLongitude: parseFloat(lon),
          radiusMeters: parseFloat(radius),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create session.");
      }

      setIsCreateOpen(false);
      // Immediately open projector view for the new session
      router.push(`/admin/sessions/${data.session.id}/present`);
    } catch (err: any) {
      alert(err.message || "Failed to create session.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#081220] text-slate-100 flex flex-col selection:bg-[#f06449] selection:text-white">
      {user && <Navbar user={user} />}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#f06449]/20 text-[#ff7c62] font-semibold border border-[#f06449]/30 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" />
                Anti-Cheat QR Pipeline
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Dynamic QR Attendance Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Launch auto-rotating HMAC projector screens. Student mobile check-ins are secured with 5-second time decay, classroom GPS geofencing, and physical device locks.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2.5 rounded-2xl bg-[#f06449] hover:bg-[#d9533a] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-[#f06449]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Session</span>
            </button>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Course Sessions
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{sessions.length}</span>
              <span className="text-xs text-slate-400">sessions</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Verified Check-Ins
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">{totalCheckins}</span>
              <span className="text-xs text-emerald-500 font-medium">GPS &amp; HW verified</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cohort Attendance Rate
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{overallRate}%</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                Healthy
              </span>
            </div>
          </div>
        </div>

        {/* Active & Scheduled Sessions Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#f06449]" />
              Class Sessions &amp; Projector Controls
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Click any session to launch hands-free screen
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((sess) => {
              const now = new Date();
              const isLive = now >= new Date(sess.startTime) && now <= new Date(sess.endTime);

              return (
                <div
                  key={sess.id}
                  className="bg-slate-900/90 border border-white/10 hover:border-[#f06449]/40 rounded-3xl p-5 flex flex-col justify-between shadow-xl transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-[#296ec2]/20 text-[#93c5fd] border border-[#93c5fd]/30">
                        {sess.courseCode}
                      </span>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          LIVE NOW
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Scheduled</span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-white text-base leading-snug">
                      {sess.courseName || "Japanese Course Lecture"}
                    </h3>

                    <div className="mt-3 space-y-1.5 text-xs text-slate-400 font-sans">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {new Date(sess.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {new Date(sess.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>Geofence: &le; {sess.radiusMeters}m radius</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Users className="w-4 h-4 text-[#f06449]" />
                      <span>{sess._count.attendances} present</span>
                    </div>

                    <button
                      onClick={() => router.push(`/admin/sessions/${sess.id}/present`)}
                      className="px-3.5 py-2 rounded-xl bg-[#f06449] hover:bg-[#d9533a] text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#f06449]/20 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Launch Projector</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-Time Anti-Fraud Audit Ledger */}
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 sm:p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Anti-Fraud Attendance Audit Log
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Atomic logs recording client GPS distance and unique hardware fingerprint for every check-in.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course Session</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">GPS Distance</th>
                  <th className="py-3 px-4">Device Lock</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        {log.studentName || log.studentId}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#93c5fd]">
                        {log.session?.courseCode || "JPN-101"}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-400">
                        {log.distanceMeters}m from center
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                        {log.deviceHash.substring(0, 18)}...
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No attendance audit logs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create New Session Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-[#f06449]" />
                <h3 className="font-bold text-white text-base">Create Course Attendance Session</h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Course Code:
                </label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  required
                  placeholder="e.g. JPN-101, JLPT-N5"
                  className="w-full bg-slate-950 border border-white/15 focus:border-[#f06449] rounded-2xl px-4 py-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Course Name / Title:
                </label>
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  required
                  placeholder="e.g. Elementary Japanese I"
                  className="w-full bg-slate-950 border border-white/15 focus:border-[#f06449] rounded-2xl px-4 py-2.5 text-xs text-white outline-none"
                />
              </div>

              {/* Classroom Geofencing Coordinates */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    Classroom Geofence Center
                  </span>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-[#296ec2]/30 hover:bg-[#296ec2]/50 text-[#93c5fd] font-bold border border-[#93c5fd]/30 cursor-pointer"
                  >
                    Use My Current GPS
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Target Latitude:</label>
                    <input
                      type="text"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Target Longitude:</label>
                    <input
                      type="text"
                      value={lon}
                      onChange={(e) => setLon(e.target.value)}
                      required
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">
                    Allowed Radius (Meters):
                  </label>
                  <input
                    type="number"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    required
                    min={10}
                    max={500}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-[#f06449] hover:bg-[#d9533a] disabled:opacity-50 text-xs font-bold text-white shadow-lg shadow-[#f06449]/20 cursor-pointer"
                >
                  {creating ? "Creating..." : "Create & Launch Screen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
