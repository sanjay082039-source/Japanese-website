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
  Trash2,
  StopCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface SessionItem {
  id: string;
  courseCode: string;
  courseName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  isEnded?: boolean;
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

  // Delete & End Session State
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<SessionItem | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
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
  };

  useEffect(() => {
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
        alert("Could not retrieve GPS location: " + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Submit New Session
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

  // End Session Early
  const handleEndSession = async (sess: SessionItem) => {
    setEndingSessionId(sess.id);
    try {
      const res = await fetch("/api/attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sess.id, action: "END_SESSION" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to end session.");
      }

      setActionSuccessMsg(`Session ${sess.courseCode} closed. Attendance check-ins ended.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to end session");
    } finally {
      setEndingSessionId(null);
    }
  };

  // Delete Session
  const handleDeleteSession = async () => {
    if (!deleteConfirmSession) return;
    setDeletingSession(true);
    try {
      const res = await fetch(`/api/attendance?sessionId=${deleteConfirmSession.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete session.");
      }

      setActionSuccessMsg(`Session ${deleteConfirmSession.courseCode} deleted successfully.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      setDeleteConfirmSession(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete session");
    } finally {
      setDeletingSession(false);
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

        {/* Global Feedback Toast */}
        {actionSuccessMsg && (
          <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Course Sessions
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">{sessions.length}</span>
              <span className="text-xs text-slate-500">recorded</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Verified Student Check-Ins
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-400">{totalCheckins}</span>
              <span className="text-xs text-slate-500">GPS &amp; Device locked</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cohort Attendance Compliance
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
            {sessions.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-slate-900/40 rounded-3xl border border-white/5 space-y-3">
                <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">No course attendance sessions created yet.</p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#f06449] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First Session</span>
                </button>
              </div>
            ) : (
              sessions.map((sess) => {
                const now = new Date();
                const isEnded = sess.isEnded || now > new Date(sess.endTime);
                const isLive = !isEnded && now >= new Date(sess.startTime);

                return (
                  <div
                    key={sess.id}
                    className={`bg-slate-900/90 border rounded-3xl p-5 flex flex-col justify-between shadow-xl transition-all ${
                      isLive
                        ? "border-emerald-500/40 shadow-emerald-500/5"
                        : isEnded
                        ? "border-white/5 opacity-85"
                        : "border-white/10"
                    }`}
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
                        ) : isEnded ? (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium border border-slate-700">
                            CLOSED / ENDED
                          </span>
                        ) : (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300 font-medium border border-blue-500/20">
                            SCHEDULED
                          </span>
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

                    <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-3">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <Users className="w-4 h-4 text-[#f06449]" />
                          <span>{sess._count.attendances} present</span>
                        </div>

                        {/* End Session Button if currently live */}
                        {isLive && (
                          <button
                            type="button"
                            onClick={() => handleEndSession(sess)}
                            disabled={endingSessionId === sess.id}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold flex items-center gap-1 transition-all"
                            title="End attendance check-ins now"
                          >
                            <StopCircle className="w-3 h-3 text-rose-400" />
                            <span>{endingSessionId === sess.id ? "Ending..." : "End Session"}</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/sessions/${sess.id}/present`)}
                          className="flex-1 py-2.5 rounded-xl bg-[#f06449] hover:bg-[#d9533a] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#f06449]/20 transition-all cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Launch Projector</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmSession(sess)}
                          className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/40 transition-all"
                          title="Delete Session"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
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
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="text-emerald-400 font-bold">{log.distanceMeters.toFixed(1)}m</span>
                        <span className="text-slate-500 text-[10px] ml-1">(&le; {log.session?.radiusMeters || 50}m)</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                        {log.deviceHash.slice(0, 12)}...
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          VERIFIED
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No attendance checks recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal: Delete Session Confirmation */}
      {deleteConfirmSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Course Session?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Are you sure you want to delete session <span className="text-white font-mono font-bold">{deleteConfirmSession.courseCode}</span>?
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-950/30 rounded-xl border border-rose-800/40 text-xs text-rose-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                Permanent Deletion
              </div>
              <p className="text-[11px] text-slate-300">
                This will delete the session and all {deleteConfirmSession._count.attendances} recorded student attendance check-ins associated with it. This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmSession(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSession}
                disabled={deletingSession}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                {deletingSession ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete Session</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Session */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-[#f06449]" />
                  Create New Course Session
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set classroom geofence beacon coordinates for student GPS check-in.
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Course Code &amp; Tier
                </label>
                <input
                  type="text"
                  required
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="e.g. JPN-101 (N5), JPN-201 (N4)"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#f06449]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Session Topic / Lecture Name
                </label>
                <input
                  type="text"
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Kanji Radicals & Listening Practicum"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#f06449]"
                />
              </div>

              {/* Classroom Geofencing Settings */}
              <div className="p-4 bg-slate-950/70 border border-white/10 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#93c5fd] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Classroom GPS Center
                  </span>

                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="text-[11px] text-[#ff7c62] hover:text-[#f06449] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    Use My Device GPS
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={lon}
                      onChange={(e) => setLon(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Allowed Geofence Radius (meters)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="500"
                    required
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Default 50m covers a standard lecture hall while preventing remote logins.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-[#f06449] hover:bg-[#d9533a] text-white text-xs font-bold transition-colors shadow-md shadow-[#f06449]/20 flex items-center gap-1.5"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create &amp; Launch Projector</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
