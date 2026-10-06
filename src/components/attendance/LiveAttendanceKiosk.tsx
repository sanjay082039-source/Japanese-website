"use client";

import React, { useState, useEffect, useRef } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import {
  Fingerprint,
  Lock,
  Unlock,
  Play,
  Square,
  CheckCircle2,
  Users,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Edit3,
  X,
  UserCheck,
  UserX,
  ShieldAlert,
  ShieldCheck,
  Scan,
  Volume2,
} from "lucide-react";

interface LiveKioskProps {
  students: Array<{ id: string; name: string; email: string; courseLevel: string; section: string }>;
  onAttendanceVerified?: () => void;
}

export const LiveAttendanceKiosk: React.FC<LiveKioskProps> = ({
  students,
  onAttendanceVerified,
}) => {
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Class setup state
  const [openLevel, setOpenLevel] = useState("N5");
  const [openSection, setOpenSection] = useState("A");
  const [openHour, setOpenHour] = useState("09:00 AM - 10:00 AM");
  const [openSubject, setOpenSubject] = useState("Kanji & Vocabulary");

  // Office Terminal Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    status: "IDLE" | "SUCCESS" | "INVALID" | "ALREADY_MARKED";
    title?: string;
    message?: string;
    student?: { name: string; email: string; courseLevel: string; section: string };
    timestamp?: string;
  }>({
    status: "IDLE",
    message: "Scanner Active • Place finger on sensor to log attendance.",
  });

  const [verifiedList, setVerifiedList] = useState<any[]>([]);

  // Manual Safety Override Modal State
  const [manualStudent, setManualStudent] = useState<any | null>(null);
  const [manualStatus, setManualStatus] = useState<"PRESENT" | "ABSENT" | "ON_LEAVE">("PRESENT");
  const [manualRemarks, setManualRemarks] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Audio synthesizer for real office terminal sound effects
  const playTerminalSound = (type: "SUCCESS" | "ERROR" | "NOTICE") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === "SUCCESS") {
        // Melodic positive chime (880Hz -> 1320Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === "ERROR") {
        // Access denied low double buzz (180Hz -> 140Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.38);
      } else {
        // Soft notice ping
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(550, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Check active session
  const checkActiveSession = async () => {
    try {
      const res = await fetch("/api/attendance/live-session");
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.activeSession);
        if (data.activeSession?.attendances) {
          setVerifiedList(data.activeSession.attendances);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    checkActiveSession();
    const interval = setInterval(checkActiveSession, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleOpenClass = async () => {
    setLoading(true);
    setScanResult({ status: "IDLE", message: "Starting attendance session..." });
    try {
      const res = await fetch("/api/attendance/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OPEN_CLASS",
          courseLevel: openLevel,
          section: openSection,
          hourSlot: openHour,
          subject: openSubject,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setActiveSession(data.session);
      setVerifiedList([]);
      setScanResult({
        status: "IDLE",
        message: "Office Biometric Scanner Terminal is LIVE. Ready for students to place finger.",
      });
      playTerminalSound("NOTICE");
    } catch (err: any) {
      setScanResult({
        status: "INVALID",
        title: "Session Error",
        message: err.message || "Failed to open class session.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseClass = async () => {
    if (!activeSession) return;
    const confirmClose = window.confirm(
      "Close the attendance scanner and lock the ledger? Any students who have not scanned their fingerprint will be recorded as ABSENT."
    );
    if (!confirmClose) return;

    setLoading(true);
    try {
      const res = await fetch("/api/attendance/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLOSE_CLASS",
          sessionId: activeSession.id,
        }),
      });

      if (res.ok) {
        setActiveSession(null);
        setVerifiedList([]);
        setScanResult({ status: "IDLE", message: "Attendance session closed and locked." });
        if (onAttendanceVerified) onAttendanceVerified();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // CONTINUOUS OFFICE FINGERPRINT SCANNER (Hardware WebAuthn or Optical Touch)
  // Student keeps finger on sensor; terminal identifies & registers instantly!
  // =========================================================================
  const handleScanFingerprint = async (candidateIdOrInvalid?: string) => {
    if (!activeSession) return;

    setIsScanning(true);
    setScanResult({
      status: "IDLE",
      message: "Reading biometric ridges... Keep finger firmly on sensor.",
    });

    try {
      // 1. If testing unregistered / invalid finger directly:
      if (candidateIdOrInvalid === "INVALID_FINGER") {
        const res = await fetch("/api/attendance/live-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "OFFICE_FINGERPRINT_SCAN",
            sessionId: activeSession.id,
            isInvalidFinger: true,
          }),
        });
        const data = await res.json();
        playTerminalSound("ERROR");
        setScanResult({
          status: "INVALID",
          title: "❌ ACCESS DENIED • UNREGISTERED FINGERPRINT",
          message: data.message || "Fingerprint rejected: Biometric pattern is not registered in the academy directory.",
        });
        setIsScanning(false);
        return;
      }

      // 2. If simulating quick-touch of an enrolled student in batch:
      if (candidateIdOrInvalid && candidateIdOrInvalid !== "HARDWARE") {
        const res = await fetch("/api/attendance/live-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "OFFICE_FINGERPRINT_SCAN",
            sessionId: activeSession.id,
            candidateStudentId: candidateIdOrInvalid,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          playTerminalSound("ERROR");
          setScanResult({
            status: "INVALID",
            title: "❌ ACCESS DENIED • UNREGISTERED FINGERPRINT",
            message: data.message || "Fingerprint rejected.",
          });
        } else if (data.alreadyMarked) {
          playTerminalSound("NOTICE");
          setScanResult({
            status: "ALREADY_MARKED",
            title: "⚠️ NOTICE: ALREADY MARKED TODAY",
            student: data.student,
            message: data.message,
          });
        } else {
          playTerminalSound("SUCCESS");
          setScanResult({
            status: "SUCCESS",
            title: "✓ IDENTIFIED & VERIFIED • PRESENT",
            student: data.student,
            timestamp: new Date().toLocaleTimeString(),
            message: `Attendance marked PRESENT for ${data.student.name}.`,
          });
          await checkActiveSession();
          if (onAttendanceVerified) onAttendanceVerified();
        }
        setIsScanning(false);
        return;
      }

      // 3. Primary Path: Physical WebAuthn Hardware Biometric Sensor
      // Challenges the sensor against all registered credentials in the database
      const optRes = await fetch("/api/biometrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "AUTH_OPTIONS" }),
      });

      const optData = await optRes.json();
      if (!optRes.ok) {
        throw new Error(optData.error || "Failed to initialize biometric sensor.");
      }

      // Prompt physical hardware sensor via browser WebAuthn API
      let authResponse: any;
      try {
        authResponse = await startAuthentication({ optionsJSON: optData });
      } catch (authErr: any) {
        // If user cancelled or reader reported mismatch
        if (authErr.name === "NotAllowedError" || authErr.message?.includes("cancel")) {
          setScanResult({
            status: "IDLE",
            message: "Scanner ready. Touch the fingerprint reader when in front of terminal.",
          });
          setIsScanning(false);
          return;
        }
        throw authErr;
      }

      // Verify returned credential against backend database
      const verifyRes = await fetch("/api/biometrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "AUTH_VERIFY",
          response: authResponse,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.verified) {
        playTerminalSound("ERROR");
        setScanResult({
          status: "INVALID",
          title: "❌ ACCESS DENIED • UNREGISTERED FINGERPRINT",
          message: verifyData.message || "Fingerprint not recognized. Biometric profile not registered in the system.",
        });
        setIsScanning(false);
        return;
      }

      // Record atomic attendance for the identified student
      const recordRes = await fetch("/api/attendance/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OFFICE_FINGERPRINT_SCAN",
          sessionId: activeSession.id,
          credentialId: verifyData.credentialId || authResponse.id,
        }),
      });

      const recordData = await recordRes.json();
      if (!recordRes.ok) {
        throw new Error(recordData.message || "Failed to log attendance record.");
      }

      if (recordData.alreadyMarked) {
        playTerminalSound("NOTICE");
        setScanResult({
          status: "ALREADY_MARKED",
          title: "⚠️ NOTICE: ALREADY RECORDED",
          student: recordData.student,
          message: recordData.message,
        });
      } else {
        playTerminalSound("SUCCESS");
        setScanResult({
          status: "SUCCESS",
          title: "✓ IDENTIFIED & VERIFIED • PRESENT",
          student: recordData.student,
          timestamp: new Date().toLocaleTimeString(),
          message: `Attendance marked PRESENT for ${recordData.student?.name || "Student"}.`,
        });
        await checkActiveSession();
        if (onAttendanceVerified) onAttendanceVerified();
      }
    } catch (err: any) {
      console.error("Biometric scan error:", err);
      playTerminalSound("ERROR");
      setScanResult({
        status: "INVALID",
        title: "❌ SENSOR EXCEPTION / UNRECOGNIZED",
        message: err.message || "Unrecognized fingerprint pattern. Try again or request manual override.",
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Submit Manual Safety Override
  const handleSaveManualOverride = async () => {
    if (!manualStudent || !activeSession) return;
    setIsSavingManual(true);

    try {
      const res = await fetch("/api/attendance/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MANUAL_OVERRIDE_ATTENDANCE",
          studentId: manualStudent.id,
          sessionId: activeSession.id,
          status: manualStatus,
          remarks: manualRemarks.trim() || `Manual safety override (${manualStatus})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setManualStudent(null);
      setManualRemarks("");
      await checkActiveSession();
      if (onAttendanceVerified) onAttendanceVerified();
    } catch (err: any) {
      alert(err.message || "Manual safety override failed.");
    } finally {
      setIsSavingManual(false);
    }
  };

  const enrolledStudents = students.filter(
    (s) =>
      (!activeSession || s.courseLevel === activeSession.courseLevel) &&
      (!activeSession || s.section === activeSession.section)
  );

  const presentStudentIds = new Set(verifiedList.map((v) => v.studentId));
  const pendingStudents = enrolledStudents.filter((s) => !presentStudentIds.has(s.id));

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. SESSION CONTROL BAR                                         */}
      {/* ============================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${
                activeSession
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-950/40"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              {activeSession ? (
                <Fingerprint className="w-6 h-6 animate-pulse text-emerald-400" />
              ) : (
                <Lock className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-black px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider ${
                    activeSession
                      ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {activeSession ? "TERMINAL ACTIVE • SCANNER LIVE" : "TERMINAL STANDBY • CLOSED"}
                </span>
                {activeSession && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                )}
              </div>

              <h2 className="text-lg font-black text-white mt-1">
                {activeSession
                  ? `JLPT ${activeSession.courseLevel} (Batch ${activeSession.section}) - ${activeSession.subject}`
                  : "Class Attendance Biometric Terminal"}
              </h2>

              <p className="text-xs text-slate-400">
                {activeSession
                  ? `Time Slot: ${activeSession.hourSlot} • Day's attendance active`
                  : "Configure class parameters and open scanner to start day-by-day attendance."}
              </p>
            </div>
          </div>

          <div>
            {activeSession ? (
              <button
                onClick={handleCloseClass}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer transition-all"
              >
                <Square className="w-4 h-4 fill-white" />
                Close Day&apos;s Attendance &amp; Lock Ledger
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={openLevel}
                  onChange={(e) => setOpenLevel(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                >
                  {["N5", "N4", "N3", "N2", "N1"].map((lvl) => (
                    <option key={lvl} value={lvl}>
                      JLPT {lvl}
                    </option>
                  ))}
                </select>

                <select
                  value={openSection}
                  onChange={(e) => setOpenSection(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white font-mono"
                >
                  <option value="A">Batch A</option>
                  <option value="B">Batch B</option>
                  <option value="C">Batch C</option>
                </select>

                <input
                  type="text"
                  value={openSubject}
                  onChange={(e) => setOpenSubject(e.target.value)}
                  placeholder="Subject"
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white max-w-[140px]"
                />

                <button
                  onClick={handleOpenClass}
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Open Attendance Scanner
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. OFFICE BIOMETRIC SCANNER HARDWARE TERMINAL (STANDALONE)     */}
      {/* ============================================================== */}
      {activeSession && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          {/* Subtle background circuit styling */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* LEFT / CENTER: THE PHYSICAL FINGERPRINT SENSOR PAD (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 bg-slate-950 border border-slate-800 rounded-3xl shadow-inner relative text-center">
              {/* Top Sensor Status Label */}
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                  Office Fingerprint Sensor
                </span>
              </div>

              {/* Glowing Sensor Pad (Touch Target) */}
              <button
                type="button"
                onClick={() => handleScanFingerprint("HARDWARE")}
                disabled={isScanning}
                className={`relative group w-44 sm:w-48 h-52 sm:h-56 rounded-3xl border-2 flex flex-col items-center justify-center p-4 transition-all duration-300 cursor-pointer shadow-2xl ${
                  isScanning
                    ? "border-amber-400 bg-amber-950/20 shadow-amber-950/60"
                    : scanResult.status === "SUCCESS"
                    ? "border-emerald-500 bg-emerald-950/30 shadow-emerald-950/60"
                    : scanResult.status === "INVALID"
                    ? "border-rose-500 bg-rose-950/30 shadow-rose-950/60"
                    : "border-slate-700 bg-slate-900 hover:border-emerald-400 hover:bg-slate-900/90 hover:shadow-emerald-950/40"
                }`}
                title="Touch finger to biometric sensor"
              >
                {/* Laser scan line animation */}
                <div
                  className={`absolute left-4 right-4 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent rounded-full shadow-lg shadow-emerald-400 pointer-events-none transition-all duration-700 ${
                    isScanning
                      ? "top-1/2 animate-bounce"
                      : "top-8 opacity-70 group-hover:top-36"
                  }`}
                ></div>

                {/* Biometric Glass Icon */}
                <div
                  className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center transition-all ${
                    isScanning
                      ? "text-amber-400 scale-105"
                      : scanResult.status === "SUCCESS"
                      ? "text-emerald-400 scale-105"
                      : scanResult.status === "INVALID"
                      ? "text-rose-400 scale-105"
                      : "text-slate-400 group-hover:text-emerald-300 group-hover:scale-105"
                  }`}
                >
                  <Fingerprint className="w-20 h-20 sm:w-24 sm:h-24 stroke-[1.2]" />
                </div>

                <span className="mt-2.5 sm:mt-3 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 group-hover:text-white">
                  {isScanning ? "Scanning..." : "Place Finger on Sensor"}
                </span>
                <span className="text-[10px] text-slate-500">Touch to authenticate</span>
              </button>

              {/* Convenience simulator options for demo & testing */}
              <div className="mt-5 w-full space-y-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono block">
                  Interactive Simulator / Finger Emulators:
                </span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (pendingStudents.length > 0) {
                        handleScanFingerprint(pendingStudents[0].id);
                      } else if (enrolledStudents.length > 0) {
                        handleScanFingerprint(enrolledStudents[0].id);
                      }
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    title="Simulate registered student touching their finger"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Touch Registered Finger</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScanFingerprint("INVALID_FINGER")}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    title="Simulate unrecognised or unregistered finger"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Touch Unregistered Finger</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT: THE TERMINAL HUD SCREEN (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* LCD Display Console */}
              <div
                className={`p-6 rounded-3xl border-2 transition-all duration-300 ${
                  scanResult.status === "SUCCESS"
                    ? "bg-emerald-950/40 border-emerald-500/80 shadow-2xl shadow-emerald-950/60"
                    : scanResult.status === "INVALID"
                    ? "bg-rose-950/40 border-rose-500/80 shadow-2xl shadow-rose-950/60 animate-shake"
                    : scanResult.status === "ALREADY_MARKED"
                    ? "bg-amber-950/40 border-amber-500/80 shadow-2xl shadow-amber-950/60"
                    : "bg-slate-950 border-slate-800 shadow-xl"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
                  <span className="font-mono text-slate-400 flex items-center gap-2">
                    <Scan className="w-4 h-4 text-slate-400" />
                    TERMINAL DISPLAY READOUT
                  </span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/40 text-slate-300">
                    {new Date().toLocaleDateString()}
                  </span>
                </div>

                <div className="py-4 space-y-3">
                  {/* Status Banner */}
                  {scanResult.status === "SUCCESS" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-black text-base tracking-wide">
                        <CheckCircle2 className="w-6 h-6" />
                        <span>{scanResult.title || "✓ IDENTIFIED & VERIFIED • PRESENT"}</span>
                      </div>

                      {scanResult.student && (
                        <div className="p-4 bg-emerald-900/30 border border-emerald-500/40 rounded-2xl flex items-center justify-between">
                          <div>
                            <span className="text-xs text-emerald-300 font-mono block">Registered Student:</span>
                            <span className="text-lg font-black text-white block">
                              {scanResult.student.name}
                            </span>
                            <span className="text-xs text-slate-300 font-mono">
                              JLPT {scanResult.student.courseLevel} • Batch {scanResult.student.section} ({scanResult.student.email})
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-emerald-300 block font-mono">Verified Time</span>
                            <span className="text-sm font-black font-mono text-white">
                              {scanResult.timestamp}
                            </span>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-emerald-200">
                        {scanResult.message} Attendance marked automatically. Scanner ready for next person.
                      </p>
                    </div>
                  )}

                  {scanResult.status === "INVALID" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-rose-400 font-black text-base tracking-wide">
                        <AlertCircle className="w-6 h-6" />
                        <span>{scanResult.title || "❌ ACCESS DENIED • UNREGISTERED FINGERPRINT"}</span>
                      </div>

                      <div className="p-4 bg-rose-900/30 border border-rose-500/40 rounded-2xl space-y-1">
                        <p className="text-xs text-rose-200 font-semibold">
                          {scanResult.message}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          To resolve: Student must enroll their fingerprint in Student Settings, or faculty can apply manual override below.
                        </p>
                      </div>
                    </div>
                  )}

                  {scanResult.status === "ALREADY_MARKED" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-amber-400 font-black text-base tracking-wide">
                        <AlertCircle className="w-6 h-6" />
                        <span>{scanResult.title || "⚠️ NOTICE: ALREADY MARKED TODAY"}</span>
                      </div>

                      <div className="p-4 bg-amber-900/30 border border-amber-500/40 rounded-2xl space-y-1">
                        <p className="text-xs text-amber-200 font-semibold">
                          {scanResult.message}
                        </p>
                      </div>
                    </div>
                  )}

                  {scanResult.status === "IDLE" && (
                    <div className="py-2 space-y-2">
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                        <span>READY FOR FINGERPRINT</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Students step up and place their finger on the sensor. The terminal instantly reads the biometric credential, verifies registered enrollment, and records attendance.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                    Audio Chime: Active
                  </span>
                  <span className="font-mono text-emerald-400">
                    Ledger Locked: {activeSession.isOpen ? "NO (ACCEPTING SCANS)" : "YES"}
                  </span>
                </div>
              </div>

              {/* Real-time Turnout Meter */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">Batch Enrollment Turnout:</span>
                  <span className="font-bold text-white text-sm">
                    {verifiedList.length} of {enrolledStudents.length} Students Checked In
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-emerald-400 text-base">
                    {Math.round((verifiedList.length / Math.max(1, enrolledStudents.length)) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 3. ROSTERS: REAL-TIME VERIFIED & UNMARKED CANDIDATES           */}
          {/* ============================================================== */}
          <div className="mt-8 pt-8 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Real-Time Verified Present Roster */}
            <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Real-time Verified Present Roster ({verifiedList.length})</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">Auto-Refreshed</span>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-[220px] overflow-y-auto pr-1">
                {verifiedList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No students verified yet. Place finger on scanner to record attendance.
                  </div>
                ) : (
                  verifiedList.map((rec) => (
                    <div key={rec.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white">{rec.student?.name || "Student"}</span>
                        <span className="text-slate-400 text-[11px] ml-2">({rec.student?.email})</span>
                        {rec.remarks && (
                          <span className="text-[10px] text-amber-300 block font-normal">
                            Note: {rec.remarks}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          {rec.biometricVerifiedAt
                            ? new Date(rec.biometricVerifiedAt).toLocaleTimeString()
                            : "Manual"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                            rec.verifiedByBiometric
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          <Fingerprint className="w-3 h-3 text-emerald-400" />
                          {rec.verifiedByBiometric ? "Biometric Verified" : "Manual Log"}
                        </span>

                        <button
                          onClick={() => {
                            setManualStudent(rec.student);
                            setManualStatus(rec.status);
                            setManualRemarks(rec.remarks || "");
                          }}
                          className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-orange-400 text-[10px] border border-slate-800 cursor-pointer"
                          title="Edit manually for safety"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Unmarked Enrolled Students (Remaining in Batch) */}
            <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Users className="w-4 h-4 text-orange-400" />
                  <span>Remaining Unmarked Candidates ({pendingStudents.length})</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Awaiting fingerprint scan
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-[220px] overflow-y-auto pr-1">
                {pendingStudents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-emerald-400 font-semibold">
                    🎉 All enrolled candidates in this batch have scanned their fingerprints!
                  </div>
                ) : (
                  pendingStudents.map((st) => (
                    <div key={st.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="truncate mr-2">
                        <span className="font-semibold text-slate-200 block truncate">{st.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{st.email}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-500 font-mono">Not scanned</span>
                        <button
                          onClick={() => {
                            setManualStudent(st);
                            setManualStatus("PRESENT");
                            setManualRemarks("Sensor failure / Manual safety override");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] font-semibold border border-slate-800 transition-all flex items-center gap-1 cursor-pointer"
                          title="Faculty safety override for sensor defects or excused leaves"
                        >
                          <Edit3 className="w-3 h-3 text-amber-400" />
                          <span>Edit Manual (Safety)</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. EDIT MANUAL MODAL (FOR SAFETY REASONS ONLY)                 */}
      {/* ============================================================== */}
      {manualStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Manual Attendance Override (Safety)</span>
              </div>
              <button
                onClick={() => setManualStudent(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-slate-400 text-[11px] block">Target Candidate:</span>
                <strong className="text-white text-sm block">{manualStudent.name}</strong>
                <span className="text-slate-500 font-mono text-[11px]">{manualStudent.email}</span>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">Attendance Status:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "PRESENT", label: "Present" },
                    { id: "ABSENT", label: "Absent" },
                    { id: "ON_LEAVE", label: "On Leave" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setManualStatus(s.id as any)}
                      className={`py-2 rounded-xl border font-bold text-xs transition-all ${
                        manualStatus === s.id
                          ? s.id === "PRESENT"
                            ? "bg-emerald-600 text-white border-emerald-500"
                            : s.id === "ABSENT"
                            ? "bg-rose-600 text-white border-rose-500"
                            : "bg-amber-600 text-white border-amber-500"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1.5">
                  Safety Reason / Override Remark:
                </label>
                <input
                  type="text"
                  value={manualRemarks}
                  onChange={(e) => setManualRemarks(e.target.value)}
                  placeholder="e.g. Bandaged finger, sensor defect, excused absence"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-300">
                Faculty manual overrides are logged in the audit ledger for institutional safety and compliance.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setManualStudent(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingManual}
                onClick={handleSaveManualOverride}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950/30 cursor-pointer"
              >
                {isSavingManual ? "Saving..." : "Confirm Manual Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
