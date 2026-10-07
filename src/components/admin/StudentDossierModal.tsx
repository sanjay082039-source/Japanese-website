"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  Monitor,
  Fingerprint,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  KeyRound,
  FileSpreadsheet,
  FileText,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Layers,
  Award,
  Calendar,
  Lock,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface StudentDossierModalProps {
  studentId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function StudentDossierModal({
  studentId,
  onClose,
  onUpdate,
}: StudentDossierModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<"overview" | "devices" | "attendance" | "exams" | "curriculum">("overview");

  useEffect(() => {
    fetchDossier();
  }, [studentId]);

  const fetchDossier = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/dossier?studentId=${studentId}`);
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setStatusMessage({ text: json.error || "Failed to load student dossier", isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Error fetching dossier", isError: true });
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceAction = async (action: string, payload?: any) => {
    try {
      setActionLoading(true);
      setStatusMessage(null);
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          studentId,
          ...payload,
        }),
      });
      const result = await res.json();
      if (res.ok) {
        setStatusMessage({ text: result.message || "Action successful." });
        if (action === "RESET_PASSWORD") {
          setNewPassword("");
          setShowPasswordInput(false);
        }
        await fetchDossier();
        if (onUpdate) onUpdate();
      } else {
        setStatusMessage({ text: result.error || "Action failed.", isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Network error.", isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  const exportExcel = () => {
    window.location.href = `/api/admin/dossier/export?studentId=${studentId}`;
  };

  const exportPDF = () => {
    if (!data) return;
    try {
      const doc = new jsPDF();
      const student = data.student;
      const metrics = data.metrics;

      // Header Banner
      doc.setFillColor(8, 18, 32); // Midnight Sapphire
      doc.rect(0, 0, 210, 36, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("RIT JAPANESE COURSE PORTAL", 14, 18);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(147, 197, 253);
      doc.text("Official Student Academic & Security Dossier", 14, 26);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 130, 26);

      // Student Summary Card
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(14, 42, 182, 34, 3, 3, "F");

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(student.name, 20, 52);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text(`Email: ${student.email}`, 20, 60);
      doc.text(`JLPT Tier: ${student.courseLevel}  |  Batch: ${student.section || "Batch A"}`, 20, 68);

      doc.text(`Attendance Rate: ${metrics.attendanceRate}%`, 115, 52);
      doc.text(`Biometric Enrolled: ${data.biometricCredentials?.length > 0 ? "YES (FIDO2)" : "NO"}`, 115, 60);
      doc.text(`Average Exam Score: ${metrics.avgExamScore !== null ? `${metrics.avgExamScore}%` : "N/A"}`, 115, 68);

      let currentY = 84;

      // Attendance Table
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(8, 18, 32);
      doc.text("Attendance Ledger Summary", 14, currentY);
      currentY += 4;

      const attendanceRows = (data.attendances || []).slice(0, 15).map((att: any) => [
        new Date(att.timestamp || att.date || Date.now()).toLocaleDateString(),
        att.session?.courseCode || "JLPT",
        att.session?.courseName || "Japanese Language",
        "Present (Verified)",
        att.distanceMeters !== undefined ? `${Number(att.distanceMeters).toFixed(1)}m (GPS Lock)` : "Verified",
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Date", "Hour Slot", "Subject", "Status", "Verification"]],
        body: attendanceRows.length > 0 ? attendanceRows : [["No attendance recorded", "-", "-", "-", "-"]],
        theme: "striped",
        headStyles: { fillColor: [8, 18, 32], textColor: 255 },
        styles: { fontSize: 8 },
      });

      // @ts-ignore
      currentY = (doc as any).lastAutoTable.finalY + 12;

      // Exam Results Table
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(8, 18, 32);
      doc.text("Assessment Performance & Proctoring Records", 14, currentY);
      currentY += 4;

      const examRows = (data.examAttempts || []).map((ea: any) => [
        ea.exam?.title || "Assessment",
        new Date(ea.startedAt).toLocaleDateString(),
        `${ea.score ?? 0} / ${ea.exam?.totalMarks ?? 100}`,
        ea.status,
        ea.cheatCount > 0 ? `${ea.cheatCount} violations` : "Clean",
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Exam Title", "Date", "Score", "Status", "Proctoring Integrity"]],
        body: examRows.length > 0 ? examRows : [["No exam attempts recorded", "-", "-", "-", "-"]],
        theme: "striped",
        headStyles: { fillColor: [240, 100, 73], textColor: 255 }, // Circuit coral
        styles: { fontSize: 8 },
      });

      doc.save(`RIT_Dossier_${student.name.replace(/\s+/g, "_")}.pdf`);
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      setStatusMessage({ text: "Failed to generate PDF: " + err.message, isError: true });
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="bg-[#081220] border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h3 className="text-white font-bold text-lg">Loading Student Dossier</h3>
          <p className="text-slate-400 text-xs mt-1">Aggregating 360° academic & security telemetry...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="bg-[#081220] border border-slate-800 rounded-3xl p-6 max-w-md w-full text-center">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-white font-bold text-base">Error Loading Record</h3>
          <p className="text-slate-400 text-xs mt-1">{statusMessage?.text || "Record could not be retrieved."}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { student, metrics, deviceSessions, biometricCredentials, attendances, examAttempts, assignmentSubmissions, chapterProgresses } = data;

  const desktopSession = deviceSessions?.find((d: any) => d.deviceType === "DESKTOP");
  const mobileSession = deviceSessions?.find((d: any) => d.deviceType === "MOBILE");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#081220] border border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-200">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/70 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-950/50">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">{student.name}</h2>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800">
                  JLPT {student.courseLevel}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-800/80">
                  {student.section ? (student.section.startsWith("Batch") ? student.section : `Batch ${student.section}`) : "Batch A"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">{student.email} • ID: {student.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportExcel}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-600/30 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={exportPDF}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-semibold hover:bg-rose-600/30 transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between ${
              statusMessage.isError
                ? "bg-rose-950/80 border-b border-rose-800 text-rose-300"
                : "bg-emerald-950/80 border-b border-emerald-800 text-emerald-300"
            }`}
          >
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-slate-800 bg-slate-950/40 text-xs gap-2 overflow-x-auto">
          {[
            { id: "overview", label: "360° Overview", icon: Award },
            { id: "devices", label: "Security & Devices", icon: ShieldAlert },
            { id: "attendance", label: "Attendance Ledger", icon: Calendar },
            { id: "exams", label: "Exams & Integrity", icon: Lock },
            { id: "curriculum", label: "Video & Homework", icon: BookOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "border-orange-500 text-orange-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Quick KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Verified Attendance</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className={`text-2xl font-black font-mono ${
                        metrics.attendanceRate >= 75 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {metrics.attendanceRate}%
                    </span>
                    <span className="text-[10px] text-slate-500">
                      ({metrics.presentCount}/{metrics.totalClasses})
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-400">
                    <Fingerprint className="w-3 h-3" />
                    <span>{metrics.biometricVerifiedCount} biometric verified</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Average Exam Score</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black font-mono text-orange-400">
                      {metrics.avgExamScore !== null ? `${metrics.avgExamScore}%` : "N/A"}
                    </span>
                    <span className="text-[10px] text-slate-500">({metrics.examsAttemptedCount} tests)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-2">JLPT Assessment Track</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Proctoring Infractions</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span
                      className={`text-2xl font-black font-mono ${
                        metrics.totalInfractions > 0 ? "text-rose-400" : "text-emerald-400"
                      }`}
                    >
                      {metrics.totalInfractions}
                    </span>
                    <span className="text-[10px] text-slate-500">violations</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-2">Tab-switches & window blurs</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 font-medium block">Curriculum Progress</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-black font-mono text-blue-400">{metrics.chaptersCount}</span>
                    <span className="text-[10px] text-slate-500">units</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-2">100% video-gated quizzes</span>
                </div>
              </div>

              {/* Security & Device Status Snapshot */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">Device & Hardware Passkey Status</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab("devices")}
                    className="text-[11px] text-orange-400 hover:underline font-semibold"
                  >
                    Manage Sessions →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Desktop Status */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Monitor className="w-4 h-4 text-blue-400" />
                      <div>
                        <span className="font-bold text-white block">Desktop Lock</span>
                        <span className="text-[10px] text-slate-400">
                          {desktopSession ? `Active (${desktopSession.ipAddress})` : "Unregistered"}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                        desktopSession
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {desktopSession ? "1/1 ACTIVE" : "0/1 SLOTS"}
                    </span>
                  </div>

                  {/* Mobile Status */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-purple-400" />
                      <div>
                        <span className="font-bold text-white block">Mobile Lock</span>
                        <span className="text-[10px] text-slate-400">
                          {mobileSession ? `Active (${mobileSession.ipAddress})` : "Unregistered"}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                        mobileSession
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {mobileSession ? "1/1 ACTIVE" : "0/1 SLOTS"}
                    </span>
                  </div>

                  {/* Biometric Status */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Fingerprint className="w-4 h-4 text-orange-400" />
                      <div>
                        <span className="font-bold text-white block">FIDO2 WebAuthn</span>
                        <span className="text-[10px] text-slate-400">
                          {biometricCredentials?.length > 0 ? "Hardware Bound" : "Not Enrolled"}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                        biometricCredentials?.length > 0
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-rose-950 text-rose-300 border border-rose-800"
                      }`}
                    >
                      {biometricCredentials?.length > 0 ? "ENROLLED" : "MISSING"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Snapshot */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recent Attendances */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-bold text-white">Recent Attendance Logs</h4>
                    <button onClick={() => setActiveTab("attendance")} className="text-[10px] text-blue-400 hover:underline">
                      View all ({attendances?.length || 0})
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    {(attendances || []).slice(0, 4).map((att: any) => (
                      <div key={att.id} className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/70 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-white block">{att.session?.courseName || att.session?.courseCode || "Japanese Class"}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(att.timestamp || att.date || Date.now()).toLocaleDateString()} • {new Date(att.timestamp || att.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            VERIFIED
                          </span>
                          <span className="block text-[9px] text-blue-400 font-mono mt-0.5">
                            {att.distanceMeters !== undefined ? `${Number(att.distanceMeters).toFixed(1)}m` : "GPS Locked"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {attendances?.length === 0 && (
                      <p className="text-xs text-slate-500 py-3 text-center">No attendance logged yet.</p>
                    )}
                  </div>
                </div>

                {/* Recent Exam Attempts */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-bold text-white">Assessment Records</h4>
                    <button onClick={() => setActiveTab("exams")} className="text-[10px] text-orange-400 hover:underline">
                      View all ({examAttempts?.length || 0})
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    {(examAttempts || []).slice(0, 4).map((ea: any) => (
                      <div key={ea.id} className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800/70 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-white block">{ea.exam?.title}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(ea.startedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold font-mono text-white text-xs">
                            {ea.score ?? 0} / {ea.exam?.totalMarks ?? 100}
                          </span>
                          {ea.cheatCount > 0 ? (
                            <span className="block text-[9px] text-rose-400 mt-0.5 font-bold">
                              {ea.cheatCount} infractions
                            </span>
                          ) : (
                            <span className="block text-[9px] text-emerald-400 mt-0.5">Clean session</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {examAttempts?.length === 0 && (
                      <p className="text-xs text-slate-500 py-3 text-center">No assessment records yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY & DEVICE SESSIONS */}
          {activeTab === "devices" && (
            <div className="space-y-6">
              <div className="p-4 bg-blue-950/20 border border-blue-500/20 rounded-2xl text-xs text-blue-300 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-white mb-0.5">Device-Locked Concurrency Rule:</strong>
                  Students are strictly restricted to at most <strong>1 Mobile</strong> and <strong>1 Desktop</strong> session concurrently.
                  Students cannot de-authorize their own devices. You have full admin authority to revoke active tokens or wipe all sessions.
                </div>
              </div>

              {/* Active Devices Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Desktop Device */}
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Registered Desktop / Laptop</h4>
                        <span className="text-[11px] text-slate-400">Classroom or Home PC</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                        desktopSession
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {desktopSession ? "ACTIVE" : "VACANT"}
                    </span>
                  </div>

                  {desktopSession ? (
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">IP Address:</span>
                          <span className="text-slate-200">{desktopSession.ipAddress}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Last Active:</span>
                          <span className="text-slate-200">{new Date(desktopSession.lastActive).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Browser/OS:</span>
                          <span className="text-slate-300 truncate max-w-[220px]" title={desktopSession.userAgent}>
                            {desktopSession.userAgent}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeviceAction("DEAUTHORIZE_DEVICE", { deviceType: "DESKTOP" })}
                        disabled={actionLoading}
                        className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all disabled:opacity-50"
                      >
                        De-authorize Desktop Session
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      No active desktop session currently registered.
                    </p>
                  )}
                </div>

                {/* Mobile Device */}
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">Registered Mobile Phone</h4>
                        <span className="text-[11px] text-slate-400">Android / iOS Handheld</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                        mobileSession
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : "bg-slate-800 text-slate-500"
                      }`}
                    >
                      {mobileSession ? "ACTIVE" : "VACANT"}
                    </span>
                  </div>

                  {mobileSession ? (
                    <div className="space-y-2 text-xs">
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-1 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">IP Address:</span>
                          <span className="text-slate-200">{mobileSession.ipAddress}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Last Active:</span>
                          <span className="text-slate-200">{new Date(mobileSession.lastActive).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Browser/OS:</span>
                          <span className="text-slate-300 truncate max-w-[220px]" title={mobileSession.userAgent}>
                            {mobileSession.userAgent}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeviceAction("DEAUTHORIZE_DEVICE", { deviceType: "MOBILE" })}
                        disabled={actionLoading}
                        className="w-full py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all disabled:opacity-50"
                      >
                        De-authorize Mobile Session
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      No active mobile session currently registered.
                    </p>
                  )}
                </div>
              </div>

              {/* Hardware WebAuthn Credentials Card */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-5 h-5 text-orange-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">WebAuthn Hardware Passkey Bindings</h4>
                      <p className="text-[11px] text-slate-400">FIDO2 Touch ID / Windows Hello / Android biometric sensors</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{biometricCredentials?.length || 0} registered</span>
                </div>

                {biometricCredentials?.length > 0 ? (
                  <div className="space-y-2 text-xs">
                    {biometricCredentials.map((cred: any) => (
                      <div key={cred.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between font-mono text-[11px]">
                        <div>
                          <span className="text-emerald-400 font-bold block">FIDO2 Authenticator Active</span>
                          <span className="text-slate-500 text-[10px]">Credential ID: {cred.credentialId.slice(0, 24)}...</span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">Sign Counter: {cred.counter}</span>
                          <span className="text-slate-500 text-[9px]">{new Date(cred.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80 text-center text-xs text-slate-400">
                    <AlertTriangle className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
                    Student has not yet enrolled biometric hardware. They can enroll via the Biometric Attendance tab.
                  </div>
                )}
              </div>

              {/* Nuclear Security Actions */}
              <div className="p-5 bg-rose-950/20 border border-rose-900/30 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Administrative Security Controls
                </h4>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleDeviceAction("WIPE_ALL_SESSIONS")}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Wipe All Active Sessions & Force Logout
                  </button>

                  <button
                    onClick={() => setShowPasswordInput(!showPasswordInput)}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-orange-400" />
                    {showPasswordInput ? "Cancel Password Reset" : "Reset Password"}
                  </button>
                </div>

                {showPasswordInput && (
                  <div className="pt-3 border-t border-rose-900/40 flex items-center gap-3">
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new student password (min 6 chars)..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-rose-500 font-mono"
                    />
                    <button
                      onClick={() => handleDeviceAction("RESET_PASSWORD", { newPassword })}
                      disabled={actionLoading || newPassword.length < 6}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
                    >
                      Save & Invalidate Sessions
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ATTENDANCE LEDGER */}
          {activeTab === "attendance" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Total Class Logs: <strong className="text-white">{attendances?.length || 0}</strong>
                </span>
                <span className="text-emerald-400 font-bold">
                  Verified Check-Ins: {attendances?.length || 0}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <th className="py-2.5 px-4">Date & Time</th>
                        <th className="py-2.5 px-4">Course Code</th>
                        <th className="py-2.5 px-4">Course Name</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-center">Anti-Cheat Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {(attendances || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            No attendance records on file for this student.
                          </td>
                        </tr>
                      ) : (
                        (attendances || []).map((att: any) => (
                          <tr key={att.id} className="hover:bg-slate-800/40">
                            <td className="py-2.5 px-4 font-mono font-medium text-slate-300">
                              {new Date(att.timestamp || att.date || Date.now()).toLocaleDateString()}{" "}
                              <span className="text-[10px] text-slate-500">
                                {new Date(att.timestamp || att.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold text-blue-400">{att.session?.courseCode || "JLPT"}</td>
                            <td className="py-2.5 px-4 font-medium text-white">{att.session?.courseName || "Japanese Lecture"}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                PRESENT
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 font-mono font-bold bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-800">
                                {att.distanceMeters !== undefined ? `${Number(att.distanceMeters).toFixed(1)}m (GPS & Device)` : "GPS & Device Lock"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXAMS & INTEGRITY */}
          {activeTab === "exams" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Assessments Attempted: <strong className="text-white">{examAttempts?.length || 0}</strong>
                </span>
                <span className="text-rose-400 font-bold">
                  Total Proctoring Infractions: {metrics.totalInfractions}
                </span>
              </div>

              <div className="space-y-3">
                {(examAttempts || []).length === 0 ? (
                  <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                    No examination records on file.
                  </div>
                ) : (
                  (examAttempts || []).map((ea: any) => (
                    <div
                      key={ea.id}
                      className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">{ea.exam?.title}</h4>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800">
                              JLPT {ea.exam?.courseLevel}
                            </span>
                            {ea.exam?.isAiGenerated && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                                AI GENERATED
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                            Started: {new Date(ea.startedAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-lg font-black font-mono text-orange-400">
                            {ea.score ?? 0} / {ea.exam?.totalMarks ?? 100}
                          </span>
                          <span className="block text-[10px] text-slate-400">{ea.status}</span>
                        </div>
                      </div>

                      {/* Violations Strip */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {ea.cheatCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-800">
                              <AlertTriangle className="w-3 h-3" />
                              {ea.cheatCount} Proctoring Violations Recorded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Zero Proctoring Infractions
                            </span>
                          )}
                        </div>

                        {ea.violations && ea.violations.length > 0 && (
                          <span className="text-[10px] text-slate-400">
                            Last violation: {ea.violations[0].type} ({new Date(ea.violations[0].timestamp).toLocaleTimeString()})
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: VIDEO & HOMEWORK */}
          {activeTab === "curriculum" && (
            <div className="space-y-6">
              {/* Chapter Video & Comprehension Progress */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    Chapter Video Gating & Comprehension Quizzes
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">{chapterProgresses?.length || 0} units</span>
                </div>

                {(chapterProgresses || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No chapter progress tracked yet.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {chapterProgresses.map((cp: any) => (
                      <div key={cp.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white block">{cp.chapter?.title}</span>
                          <span className="text-[10px] text-slate-400">
                            Watch Completion: <strong className={cp.videoCompleted ? "text-emerald-400" : "text-amber-400"}>{cp.videoCompleted ? "100% (Unlocked)" : "Incomplete (Locked)"}</strong>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-orange-400 text-xs">
                            Quiz Score: {cp.quizScore !== null ? `${cp.quizScore}%` : "Not Attempted"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Daily AI Homework Submissions */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    Daily AI Homework Submissions
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">{assignmentSubmissions?.length || 0} completed</span>
                </div>

                {(assignmentSubmissions || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No assignments submitted yet.</p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {assignmentSubmissions.map((sub: any) => (
                      <div key={sub.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white block">{sub.assignment?.title || "Daily Homework"}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Submitted: {new Date(sub.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-400 text-xs">
                            Grade: {sub.grade ?? "Graded"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            Strict LMS Concurrency & WebAuthn FIDO2 Security Active
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
            >
              Export PDF
            </button>
            <button
              onClick={exportExcel}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-950/30"
            >
              Export Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
