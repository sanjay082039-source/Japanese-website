"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  Minimize2,
  MapPin,
  Clock,
  RefreshCw,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  X,
  AlertTriangle,
  Radio,
  Search,
  StopCircle,
  ExternalLink,
} from "lucide-react";

interface RecentAttendance {
  id: string;
  studentId: string;
  studentName: string | null;
  timestamp: string;
  distanceMeters: number;
  deviceHash: string;
}

interface SessionData {
  token: string | null;
  isExpired?: boolean;
  isEnded?: boolean;
  message?: string;
  attendanceCount: number;
  courseCode: string;
  courseName: string | null;
  radiusMeters: number;
  targetLatitude: number;
  targetLongitude: number;
  startTime: string;
  endTime: string;
  recentAttendances: RecentAttendance[];
}

export default function FacultyPresentPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(5.0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Manual Override Modal
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [searchStudent, setSearchStudent] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideSuccessMsg, setOverrideSuccessMsg] = useState<string | null>(null);

  // End Session Confirmation Modal
  const [isEndConfirmOpen, setIsEndConfirmOpen] = useState(false);
  const [endingSession, setEndingSession] = useState(false);

  // Fetch token and stats
  const fetchTokenAndStats = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/token`);
      if (!res.ok) {
        throw new Error("Session not found or unavailable.");
      }
      const data: SessionData = await res.json();
      setSessionData(data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch session token:", err);
      setError(err.message || "Failed to load session.");
    } finally {
      setLoading(false);
    }
  };

  // Initial load and 5s polling interval
  useEffect(() => {
    if (!sessionId) return;
    fetchTokenAndStats();

    // 5-second interval aligned to dynamic token rotation (only if active)
    const interval = setInterval(() => {
      fetchTokenAndStats();
      setCountdown(5.0);
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId]);

  // Smooth 100ms countdown decrement for animated progress bar
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 0.1 ? 5.0 : Number((prev - 0.1).toFixed(1))));
    }, 100);

    return () => clearInterval(timer);
  }, []);

  // Load students for manual override modal
  useEffect(() => {
    async function loadStudents() {
      try {
        const res = await fetch("/api/attendance?mode=dailySheet");
        if (res.ok) {
          const data = await res.json();
          if (data.students) setAllStudents(data.students);
        }
      } catch (err) {
        console.error("Failed to load students for override:", err);
      }
    }
    loadStudents();
  }, []);

  // Toggle Fullscreen mode for projector
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Submit manual override
  const handleManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || overrideSubmitting) return;

    setOverrideSubmitting(true);
    try {
      const res = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          isManualOverride: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Manual override failed.");
      }

      setOverrideSuccessMsg(`Marked ${selectedStudent.name} as PRESENT!`);
      fetchTokenAndStats();
      setTimeout(() => {
        setOverrideSuccessMsg(null);
        setIsOverrideOpen(false);
        setSelectedStudent(null);
        setSearchStudent("");
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Failed to submit override");
    } finally {
      setOverrideSubmitting(false);
    }
  };

  // End Session Handler
  const handleEndSession = async () => {
    setEndingSession(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "END_SESSION" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to end session.");
      }

      setIsEndConfirmOpen(false);
      await fetchTokenAndStats();
    } catch (err: any) {
      alert(err.message || "Could not end session");
    } finally {
      setEndingSession(false);
    }
  };

  const isClosed = sessionData?.isExpired || sessionData?.isEnded;

  const qrPayload = sessionData?.token
    ? JSON.stringify({
        sessionId,
        token: sessionData.token,
      })
    : "";

  return (
    <div className="min-h-screen bg-[#081220] text-slate-100 flex flex-col justify-between selection:bg-[#f06449] selection:text-white">
      {/* Top Projector Navigation Bar */}
      <header className="px-6 py-4 bg-slate-900/90 border-b border-white/10 flex items-center justify-between gap-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/attendance")}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Return to Attendance Menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 ${
                  isClosed
                    ? "bg-slate-800 text-slate-400 border-slate-700"
                    : "bg-[#f06449]/20 text-[#ff7c62] border-[#f06449]/30"
                }`}
              >
                {!isClosed && <Radio className="w-3 h-3 text-[#ff7c62] animate-pulse" />}
                {isClosed ? "Attendance Closed" : "Live Projector Display"}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {sessionData?.courseCode || "JPN-101"}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
              {sessionData?.courseName || "Elementary Japanese I"}
            </h1>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-white/10 text-xs text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Geofence: &le; {sessionData?.radiusMeters || 50}m</span>
          </div>

          {!isClosed ? (
            <>
              <button
                onClick={() => setIsOverrideOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[#296ec2]/30 hover:bg-[#296ec2]/50 border border-[#93c5fd]/30 text-xs font-bold text-[#93c5fd] flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Manual Override</span>
              </button>

              <button
                onClick={() => setIsEndConfirmOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <StopCircle className="w-4 h-4 text-rose-400" />
                <span>End Session</span>
              </button>
            </>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 border border-white/10 text-xs font-mono font-bold">
              Session Closed
            </span>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Hands-Free Projection Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-center gap-8">
        {/* QR Code Presentation Column */}
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg">
          {error ? (
            <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center">
              <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-white">Session Unavailable</h3>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
              <button
                onClick={fetchTokenAndStats}
                className="mt-4 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Retry Connection
              </button>
            </div>
          ) : isClosed ? (
            /* Session Expired / Ended View */
            <div className="w-full bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-8 flex flex-col items-center shadow-2xl backdrop-blur-2xl text-center space-y-5">
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs border border-rose-500/30">
                <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                {sessionData?.isEnded ? "ATTENDANCE SESSION CLOSED" : "TIME WINDOW EXPIRED"}
              </div>

              <div>
                <h2 className="text-2xl font-black text-white">Check-Ins Completed</h2>
                <p className="text-xs text-slate-300 mt-1.5 max-w-sm leading-relaxed">
                  {sessionData?.message ||
                    "Attendance recording for this class is now closed. Dynamic QR tokens are deactivated."}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/10 w-full text-center">
                <span className="text-xs text-slate-400 uppercase font-semibold">
                  Final Verified Attendance
                </span>
                <div className="text-4xl font-black text-emerald-400 mt-1">
                  {sessionData?.attendanceCount ?? 0} Students
                </div>
              </div>

              <button
                onClick={() => router.push("/admin/attendance")}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-blue-600/30"
              >
                Return to Attendance Dashboard
              </button>
            </div>
          ) : (
            /* Active Live Rotating QR Screen */
            <div className="w-full bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col items-center shadow-2xl backdrop-blur-2xl text-center">
              {/* Header inside QR card */}
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Dynamic Anti-Cheat QR
                </span>
              </div>

              {/* QR Code Frame */}
              <div className="relative p-5 bg-white rounded-3xl shadow-2xl border-4 border-[#f06449]/40 group">
                {qrPayload ? (
                  <QRCodeSVG
                    value={qrPayload}
                    size={280}
                    level="H"
                    includeMargin={false}
                    className="w-56 h-56 sm:w-72 sm:h-72"
                  />
                ) : (
                  <div className="w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center bg-slate-100 text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  </div>
                )}

                {/* Floating corner guides for scan optics */}
                <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#f06449]"></div>
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#f06449]"></div>
                <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#f06449]"></div>
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#f06449]"></div>
              </div>

              {/* Rotation Countdown Bar */}
              <div className="w-full mt-6 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5 text-[#ff7c62]">
                    <Clock className="w-3.5 h-3.5" />
                    Time-Decay Token
                  </span>
                  <span>Rotates in {countdown.toFixed(1)}s</span>
                </div>

                {/* Progress track */}
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-[#296ec2] via-[#93c5fd] to-[#f06449] transition-all duration-100"
                    style={{ width: `${(countdown / 5.0) * 100}%` }}
                  ></div>
                </div>
              </div>

              {/* Instructions */}
              <p className="text-xs text-slate-400 mt-5 leading-relaxed">
                Open <span className="text-[#93c5fd] font-semibold">/student/scan</span> on your mobile device. Hold camera to projector screen within classroom bounds.
              </p>
            </div>
          )}
        </div>

        {/* Live Attendance Counter & Live Ticker Column */}
        <div className="w-full lg:w-96 flex flex-col gap-6">
          {/* Prominent Live Counter */}
          <div className="bg-gradient-to-br from-slate-900 to-[#0f294d] border border-[#296ec2]/35 rounded-3xl p-6 shadow-2xl">
            <span className="text-xs uppercase font-bold text-[#93c5fd] tracking-wider">
              {isClosed ? "Total Attended" : "Live Attendance Count"}
            </span>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-5xl font-black text-white tracking-tight">
                {sessionData?.attendanceCount ?? 0}
              </span>
              <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Verified
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Atomic hardware locks ensure 1 student check-in per physical device.
            </p>
          </div>

          {/* Real-time Attendee Stream */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 flex-1 min-h-[300px] flex flex-col backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Recent Attendees Feed
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                Live Audit
              </span>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-2 max-h-[340px] pr-1">
              {!sessionData?.recentAttendances || sessionData.recentAttendances.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                  <Users className="w-8 h-8 opacity-40" />
                  <p className="text-xs">No students checked in yet.</p>
                </div>
              ) : (
                sessionData.recentAttendances.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {item.studentName || item.studentId}
                      </h4>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString()} &bull; {item.distanceMeters.toFixed(1)}m
                      </span>
                    </div>

                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      VERIFIED
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation Modal: End Session */}
      {isEndConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <StopCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">End Attendance Session?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  This will immediately deactivate dynamic QR code generation and prevent any further check-ins.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-white/10 text-xs text-slate-300">
              Current attendance: <strong className="text-emerald-400 font-mono">{sessionData?.attendanceCount ?? 0} students</strong> recorded.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEndConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndSession}
                disabled={endingSession}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                {endingSession ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Closing...</span>
                  </>
                ) : (
                  <span>Yes, End Session</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Override Modal */}
      {isOverrideOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#93c5fd]" />
                  Faculty Manual Attendance Override
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Safety fallback when student phone battery died or camera is broken.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsOverrideOpen(false);
                  setSelectedStudent(null);
                  setSearchStudent("");
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {overrideSuccessMsg && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {overrideSuccessMsg}
              </div>
            )}

            <form onSubmit={handleManualOverride} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Search &amp; Select Student
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    placeholder="Search by student name or email..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-[#296ec2]"
                  />
                </div>
              </div>

              {/* Student Options List */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-white/10 rounded-xl p-2 bg-slate-950/60">
                {allStudents
                  .filter(
                    (s) =>
                      s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
                      s.email.toLowerCase().includes(searchStudent.toLowerCase())
                  )
                  .map((st) => {
                    const isSelected = selectedStudent?.id === st.id;
                    return (
                      <div
                        key={st.id}
                        onClick={() => setSelectedStudent(st)}
                        className={`p-2.5 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#296ec2]/30 border border-[#93c5fd]/40 text-white"
                            : "hover:bg-slate-800 text-slate-300"
                        }`}
                      >
                        <div>
                          <div className="font-bold">{st.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{st.email}</div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-400">
                          {st.courseLevel} ({st.section})
                        </span>
                      </div>
                    );
                  })}
              </div>

              {selectedStudent && (
                <div className="p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl text-xs text-blue-200">
                  Ready to grant manual attendance to: <strong>{selectedStudent.name}</strong>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOverrideOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStudent || overrideSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#296ec2] hover:bg-[#1b4987] text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {overrideSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <span>Record Manual Attendance</span>
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
