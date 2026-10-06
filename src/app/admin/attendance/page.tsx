"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/navigation/Navbar";
import { UserSession } from "@/lib/types";
import {
  Clock,
  Calendar,
  Users,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  FileSpreadsheet,
  Edit3,
  X,
  Fingerprint,
  UserCheck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { LiveAttendanceKiosk } from "@/components/attendance/LiveAttendanceKiosk";

interface StudentLedgerItem {
  id: string;
  name: string;
  email: string;
  courseLevel: string;
  section: string;
}

export default function AdminAttendancePage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"kiosk" | "history">("kiosk");

  // Roster of all students
  const [students, setStudents] = useState<StudentLedgerItem[]>([]);

  // Day-by-Day History Tab State
  const [historyDate, setHistoryDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [historyLevel, setHistoryLevel] = useState<string>("ALL");
  const [historySection, setHistorySection] = useState<string>("ALL");
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Manual Safety Edit Modal in History View
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<"PRESENT" | "ABSENT" | "ON_LEAVE">("PRESENT");
  const [editRemarks, setEditRemarks] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    fetchSessionAndInitialData();
  }, []);

  const fetchSessionAndInitialData = async () => {
    try {
      const authRes = await fetch("/api/auth/me");
      const authData = await authRes.json();
      if (!authData.user || authData.user.role !== "ADMIN") {
        window.location.href = "/login";
        return;
      }
      setUser(authData.user);

      // Load all students
      const studRes = await fetch("/api/attendance?mode=ledger");
      const studData = await studRes.json();
      if (studData.students) {
        setStudents(studData.students);
      }

      await fetchDayRecords(historyDate, historyLevel, historySection);
    } catch (err) {
      console.error("Failed to load initial attendance data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDayRecords = useCallback(
    async (date: string, level: string, section: string) => {
      setLoadingHistory(true);
      try {
        const params = new URLSearchParams({
          date,
          courseLevel: level,
          section,
        });
        const res = await fetch(`/api/attendance/live-session?${params.toString()}`);
        const data = await res.json();
        setHistoryRecords(data.dayRecords || []);
      } catch (err) {
        console.error("Error fetching day records:", err);
      } finally {
        setLoadingHistory(false);
      }
    },
    []
  );

  const handleDateChange = (newDate: string) => {
    setHistoryDate(newDate);
    fetchDayRecords(newDate, historyLevel, historySection);
  };

  const handleFilterChange = (level: string, section: string) => {
    setHistoryLevel(level);
    setHistorySection(section);
    fetchDayRecords(historyDate, level, section);
  };

  const handleSaveSafetyEdit = async () => {
    if (!editingRecord) return;
    setIsSavingEdit(true);

    try {
      const res = await fetch("/api/attendance/live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MANUAL_OVERRIDE_ATTENDANCE",
          studentId: editingRecord.studentId,
          sessionId: editingRecord.sessionId,
          status: editStatus,
          remarks: editRemarks.trim() || `Manual safety adjustment (${editStatus})`,
        }),
      });

      if (res.ok) {
        setEditingRecord(null);
        await fetchDayRecords(historyDate, historyLevel, historySection);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleExportExcel = () => {
    window.location.href = `/api/admin/dossier/export`;
  };

  const filteredHistory = historyRecords.filter((rec) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchName = rec.student?.name?.toLowerCase().includes(q);
    const matchEmail = rec.student?.email?.toLowerCase().includes(q);
    return matchName || matchEmail;
  });

  const presentCount = historyRecords.filter((r) => r.status === "PRESENT").length;
  const biometricVerifiedCount = historyRecords.filter((r) => r.verifiedByBiometric).length;
  const absentCount = historyRecords.filter((r) => r.status === "ABSENT").length;

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center text-slate-400">
        Loading attendance system...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070D18] pb-16 text-slate-100">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                Biometric & Ledger Console
              </span>
              <span className="text-xs text-slate-400">FIDO2 Hardware Fingerprint & Safety Override</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Live Fingerprint Roll Call & Day-by-Day Ledger
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Open the fingerprint scanner for students to verify one by one. Close to lock the day&apos;s ledger, with manual override for safety.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Ledger (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher: Live Kiosk vs Day-by-Day Ledger */}
        <div className="flex items-center gap-2 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab("kiosk")}
            className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "kiosk"
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Fingerprint className="w-4 h-4" />
            <span>Live Fingerprint Kiosk</span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`py-3 px-4 font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "history"
                ? "border-orange-500 text-orange-400"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Day-by-Day Attendance History & Safety Editor</span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: LIVE FINGERPRINT KIOSK                                  */}
        {/* ============================================================== */}
        {activeTab === "kiosk" && (
          <LiveAttendanceKiosk
            students={students}
            onAttendanceVerified={() => {
              fetchDayRecords(historyDate, historyLevel, historySection);
            }}
          />
        )}

        {/* ============================================================== */}
        {/* TAB 2: DAY-BY-DAY ATTENDANCE HISTORY & MANUAL SAFETY OVERRIDE  */}
        {/* ============================================================== */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-bold text-white">Daily Ledger Query</h3>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Present Today:</span>
                  <span className="font-mono font-bold text-emerald-400">{presentCount}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">Fingerprint Verified:</span>
                  <span className="font-mono font-bold text-blue-400">{biometricVerifiedCount}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">Absent:</span>
                  <span className="font-mono font-bold text-rose-400">{absentCount}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Select Date:</label>
                  <input
                    type="date"
                    value={historyDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">JLPT Level:</label>
                  <select
                    value={historyLevel}
                    onChange={(e) => handleFilterChange(e.target.value, historySection)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500 font-mono"
                  >
                    <option value="ALL">All Tiers (N1–N5)</option>
                    <option value="N1">N1 (Advanced)</option>
                    <option value="N2">N2 (Pre-Advanced)</option>
                    <option value="N3">N3 (Intermediate)</option>
                    <option value="N4">N4 (Elementary)</option>
                    <option value="N5">N5 (Beginner)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Batch:</label>
                  <select
                    value={historySection}
                    onChange={(e) => handleFilterChange(historyLevel, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500 font-mono"
                  >
                    <option value="ALL">All Batches</option>
                    <option value="A">Batch A</option>
                    <option value="B">Batch B</option>
                    <option value="C">Batch C</option>
                    <option value="Morning">Morning Batch</option>
                    <option value="Weekend">Weekend Batch</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Search Student:</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter candidate..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Daily History Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <th className="py-3 px-4">Candidate Name</th>
                      <th className="py-3 px-4">JLPT Tier</th>
                      <th className="py-3 px-4">Batch</th>
                      <th className="py-3 px-4">Hour Slot</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Verification Method</th>
                      <th className="py-3 px-4">Remark / Safety Log</th>
                      <th className="py-3 px-4 text-center">Manual Safety Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {loadingHistory ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          Loading day ledger records...
                        </td>
                      </tr>
                    ) : filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No attendance logs recorded for {historyDate}. Open the scanner to take roll call.
                        </td>
                      </tr>
                    ) : (
                      filteredHistory.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-white">
                            <div>
                              <span>{rec.student?.name || "Student"}</span>
                              <span className="block text-[11px] text-slate-400 font-normal">
                                {rec.student?.email}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800">
                              {rec.student?.courseLevel}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">
                            {rec.student?.section || "Batch A"}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">{rec.hourSlot}</td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                rec.status === "PRESENT"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : rec.status === "ON_LEAVE"
                                  ? "bg-amber-950 text-amber-300 border border-amber-800"
                                  : "bg-rose-950 text-rose-300 border border-rose-800"
                              }`}
                            >
                              {rec.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {rec.verifiedByBiometric ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 font-mono font-bold bg-emerald-950/80 px-2.5 py-0.5 rounded-lg border border-emerald-800">
                                <Fingerprint className="w-3 h-3 text-emerald-400" />
                                FIDO2 Fingerprint Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-mono font-bold bg-amber-950/80 px-2.5 py-0.5 rounded-lg border border-amber-800">
                                <UserCheck className="w-3 h-3 text-amber-400" />
                                Manual Override
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[200px] truncate">
                            {rec.remarks || "—"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => {
                                setEditingRecord(rec);
                                setEditStatus(rec.status);
                                setEditRemarks(rec.remarks || "");
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold border border-slate-700 cursor-pointer"
                              title="Edit status manually for safety reason"
                            >
                              <Edit3 className="w-3 h-3 text-amber-400" />
                              <span>Edit Manual</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Edit Safety Modal in History */}
            {editingRecord && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                      <span>Safety Attendance Adjustment</span>
                    </div>
                    <button
                      onClick={() => setEditingRecord(null)}
                      className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[11px] block">Candidate:</span>
                      <strong className="text-white text-sm block">{editingRecord.student?.name}</strong>
                      <span className="text-slate-500 font-mono text-[11px]">{editingRecord.student?.email}</span>
                    </div>

                    <div>
                      <label className="text-slate-300 font-semibold block mb-1.5">Change Status to:</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "PRESENT", label: "Present" },
                          { id: "ABSENT", label: "Absent" },
                          { id: "ON_LEAVE", label: "On Leave" },
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setEditStatus(s.id as any)}
                            className={`py-2 rounded-xl border font-bold text-xs transition-all ${
                              editStatus === s.id
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
                        Audit Note / Safety Reason:
                      </label>
                      <input
                        type="text"
                        value={editRemarks}
                        onChange={(e) => setEditRemarks(e.target.value)}
                        placeholder="e.g. Excused by faculty, hardware glitch override, etc."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingRecord(null)}
                      className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingEdit}
                      onClick={handleSaveSafetyEdit}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950/30 cursor-pointer"
                    >
                      {isSavingEdit ? "Saving..." : "Save Safety Update"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
