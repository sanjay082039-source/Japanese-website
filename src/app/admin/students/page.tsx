"use client";

import React, { useState, useEffect, useMemo } from "react";
import Navbar from "@/components/navigation/Navbar";
import { UserSession, StudentShortlistRecord, CourseLevel } from "@/lib/types";
import {
  Users,
  Search,
  SlidersHorizontal,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  X,
  Layers,
  Edit3,
  Calendar,
} from "lucide-react";

interface StudentRecordWithRole extends StudentShortlistRecord {
  role?: "ADMIN" | "STUDENT";
}

const BATCH_PRESETS = [
  "Batch A",
  "Batch B",
  "Batch C",
  "Morning Batch",
  "Evening Batch",
  "Weekend Batch",
];

export default function AdminStudentsDirectoryPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [students, setStudents] = useState<StudentRecordWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [courseLevel, setCourseLevel] = useState<string>("ALL");
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>("ALL");
  const [minAttendance, setMinAttendance] = useState<number>(75);
  const [minScore, setMinScore] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  // Batch & Level Modification Modal State (Admin can edit batch & level)
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<StudentRecordWithRole | null>(null);
  const [targetBatch, setTargetBatch] = useState<string>("Batch A");
  const [targetCourseLevel, setTargetCourseLevel] = useState<CourseLevel>("N5");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    fetchProfileAndData();
  }, [courseLevel, minAttendance, minScore]);

  const fetchProfileAndData = async () => {
    try {
      const userRes = await fetch("/api/auth/me");
      const userData = await userRes.json();
      if (!userData.user || userData.user.role !== "ADMIN") {
        window.location.href = "/login";
        return;
      }
      setUser(userData.user);

      // Fetch students with shortlist parameters
      const params = new URLSearchParams({
        courseLevel,
        minAttendance: String(minAttendance),
        minScore: String(minScore),
      });

      const res = await fetch(`/api/admin/shortlist?${params.toString()}`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err) {
      console.error("Failed to load students directory:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle saving student batch and JLPT level modifications
  const handleSaveBatchAndLevel = async () => {
    if (!selectedStudentForEdit) return;
    if (!targetBatch.trim()) {
      setUpdateMessage({ text: "Batch identifier cannot be empty.", isError: true });
      return;
    }

    setIsUpdating(true);
    setUpdateMessage(null);

    try {
      const res = await fetch(`/api/admin/users/${selectedStudentForEdit.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch: targetBatch.trim(),
          courseLevel: targetCourseLevel,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setUpdateMessage({
          text: `Success: ${selectedStudentForEdit.name}'s batch updated to "${targetBatch.trim()}" and level to JLPT ${targetCourseLevel}!`,
        });
        // Update local state immediately
        setStudents((prev) =>
          prev.map((s) =>
            s.id === selectedStudentForEdit.id
              ? { ...s, section: targetBatch.trim(), courseLevel: targetCourseLevel }
              : s
          )
        );
        setTimeout(() => {
          setSelectedStudentForEdit(null);
          setUpdateMessage(null);
          fetchProfileAndData();
        }, 1200);
      } else {
        setUpdateMessage({ text: data.error || "Failed to update student batch/level", isError: true });
      }
    } catch (err) {
      setUpdateMessage({ text: "Network error updating student details.", isError: true });
    } finally {
      setIsUpdating(false);
    }
  };

  // Compute all available batches dynamically
  const availableBatches = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.section) set.add(s.section);
    });
    return Array.from(set).sort();
  }, [students]);

  // Client-side search and batch filtering
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedBatchFilter !== "ALL") {
        const studentBatch = (s.section || "").toLowerCase();
        const target = selectedBatchFilter.toLowerCase();
        if (studentBatch !== target && !studentBatch.includes(target)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchEmail = s.email.toLowerCase().includes(q);
        const matchBatch = (s.section || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchBatch) {
          return false;
        }
      }
      return true;
    });
  }, [students, searchQuery, selectedBatchFilter]);

  // One-click server-side Excel export trigger
  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        courseLevel,
        section: selectedBatchFilter !== "ALL" ? selectedBatchFilter : "",
        minAttendance: String(minAttendance),
        minScore: String(minScore),
        search: searchQuery,
      });

      const exportUrl = `/api/admin/export-shortlist?${params.toString()}`;
      window.location.href = exportUrl;
    } catch (err) {
      console.error("Excel export failed:", err);
    } finally {
      setTimeout(() => setIsExporting(false), 1500);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading RIT Japanese Portal directory...
      </div>
    );
  }

  const eligibleCount = filteredStudents.filter((s) => s.status === "ELIGIBLE").length;
  const atRiskCount = filteredStudents.filter((s) => s.status === "AT_RISK").length;

  return (
    <div className="min-h-screen bg-[#070D18] pb-16">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header with Title & Export Action */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                名簿・クラス管理・Student Batches & Levels
              </span>
              <span className="text-xs text-slate-400">Batch Assignment & JLPT Tiers (N1–N5)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Student Directory, Batch & Level Management
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Assign or modify student batches (e.g. Batch A, Batch B, Morning/Weekend), adjust JLPT tiers (N1–N5), and export Excel audit sheets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isExporting ? "Generating Report..." : "Export Shortlist (.xlsx)"}
            </button>
          </div>
        </div>

        {/* Filter Controls Panel */}
        <div className="mt-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-bold text-white">Multi-Parameter Shortlisting & Batch Filters</h2>
            </div>
            <span className="text-xs text-slate-400">
              Matches Found: <strong className="text-white">{filteredStudents.length}</strong> candidates
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-slate-400" /> Search Candidate / Batch
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, email, batch..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* JLPT Course Level Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" /> JLPT Tier
              </label>
              <select
                value={courseLevel}
                onChange={(e) => setCourseLevel(e.target.value)}
                aria-label="Filter candidates by JLPT tier"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
              >
                <option value="ALL">All Tiers (N1 to N5)</option>
                <option value="N1">N1 (Advanced)</option>
                <option value="N2">N2 (Pre-Advanced)</option>
                <option value="N3">N3 (Intermediate)</option>
                <option value="N4">N4 (Elementary)</option>
                <option value="N5">N5 (Beginner)</option>
              </select>
            </div>

            {/* Student Batch Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-orange-400" /> Student Batch
              </label>
              <select
                value={selectedBatchFilter}
                onChange={(e) => setSelectedBatchFilter(e.target.value)}
                aria-label="Filter candidates by batch"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-medium"
              >
                <option value="ALL">All Batches</option>
                {availableBatches.map((b) => (
                  <option key={b} value={b}>
                    Batch {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Minimum Attendance Threshold Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>Min Attendance:</span>
                <span className="text-orange-400 font-mono font-bold">{minAttendance}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={95}
                step={5}
                value={minAttendance}
                onChange={(e) => setMinAttendance(parseInt(e.target.value, 10))}
                className="w-full accent-orange-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0% (All)</span>
                <span>75% (Benchmark)</span>
                <span>90% (Honor)</span>
              </div>
            </div>

            {/* Minimum Exam Score Filter */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-300">
                <span>Min Exam Score:</span>
                <span className="text-blue-400 font-mono font-bold">{minScore}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={10}
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>0% (All)</span>
                <span>50% (Passing)</span>
                <span>80% (Honor)</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800 text-xs">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Total Students:</span>
              <strong className="text-white font-mono">{students.length}</strong>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Filtered:</span>
              <strong className="text-orange-400 font-mono">{filteredStudents.length}</strong>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Eligible (≥75%):</span>
              <strong className="text-emerald-400 font-mono">{eligibleCount}</strong>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">At Risk (&lt;70%):</span>
              <strong className="text-rose-400 font-mono">{atRiskCount}</strong>
            </div>
          </div>
        </div>

        {/* Student Records Table with Batch & Level */}
        <div className="mt-8 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">JLPT Tier</th>
                  <th className="py-3 px-4">Batch</th>
                  <th className="py-3 px-4 text-center">Attendance %</th>
                  <th className="py-3 px-4 text-center">P / A / L</th>
                  <th className="py-3 px-4 text-center">Avg Exam %</th>
                  <th className="py-3 px-4 text-center">Standing</th>
                  <th className="py-3 px-4 text-center">Manage Batch & Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No candidates match the specified filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-400">
                        {st.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        <div>
                          <span>{st.name}</span>
                          <span className="block text-[11px] text-slate-400 font-normal">{st.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                          {st.courseLevel}
                        </span>
                      </td>

                      {/* Prominent Batch Column */}
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800/80">
                          {st.section ? (st.section.startsWith("Batch") ? st.section : `Batch ${st.section}`) : "Unassigned"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span
                          className={st.attendanceRate >= 75 ? "text-emerald-400" : "text-rose-400"}
                        >
                          {st.attendanceRate}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                        {st.presentCount} / {st.absentCount} / {st.leaveCount}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                        {st.averageExamScore}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            st.status === "ELIGIBLE"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : st.status === "AT_RISK"
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          {st.status === "ELIGIBLE" ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {st.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedStudentForEdit(st);
                            setTargetBatch(st.section || "Batch A");
                            setTargetCourseLevel(st.courseLevel);
                            setUpdateMessage(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-orange-400 text-[11px] font-semibold transition-all border border-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-orange-400" />
                          <span>Edit Batch</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ============================================================== */}
        {/* EDIT BATCH & JLPT LEVEL MODAL                                 */}
        {/* ============================================================== */}
        {selectedStudentForEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Edit Student Batch & Level
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Reassign classroom batch and JLPT course tier
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStudentForEdit(null)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {updateMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    updateMessage.isError
                      ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                      : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                  }`}
                >
                  {updateMessage.text}
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* Target Student Identity */}
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Candidate</span>
                    <span className="font-bold text-white text-sm">{selectedStudentForEdit.name}</span>
                    <span className="font-mono text-slate-500 text-[11px] block">{selectedStudentForEdit.email}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Current Placement</span>
                    <span className="font-mono font-bold text-orange-400 text-sm">
                      JLPT {selectedStudentForEdit.courseLevel} • {selectedStudentForEdit.section ? (selectedStudentForEdit.section.startsWith("Batch") ? selectedStudentForEdit.section : `Batch ${selectedStudentForEdit.section}`) : "Batch A"}
                    </span>
                  </div>
                </div>

                {/* Edit Batch Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-slate-300 font-semibold">
                      Student Batch Assignment:
                    </label>
                    <span className="text-[11px] text-slate-500">Custom name or presets</span>
                  </div>

                  <input
                    type="text"
                    value={targetBatch}
                    onChange={(e) => setTargetBatch(e.target.value)}
                    placeholder="e.g. Batch A, Batch B, Morning Batch, Weekend Batch"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 outline-none focus:border-orange-500 font-mono font-bold"
                  />

                  {/* Batch Quick Preset Chips */}
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-slate-500 mr-1">Presets:</span>
                    {BATCH_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setTargetBatch(preset)}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold transition-all ${
                          targetBatch === preset
                            ? "bg-amber-500 text-slate-950 font-bold border-amber-400"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* JLPT Course Level Selector (N1 to N5) */}
                <div>
                  <label className="block text-slate-300 font-semibold mb-2">
                    JLPT Course Tier (N1 to N5):
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { lvl: "N5", label: "Beginner", kanji: "入門" },
                      { lvl: "N4", label: "Elementary", kanji: "初級" },
                      { lvl: "N3", label: "Intermediate", kanji: "中級" },
                      { lvl: "N2", label: "Pre-Adv", kanji: "準上級" },
                      { lvl: "N1", label: "Mastery", kanji: "精通" },
                    ].map((item) => (
                      <button
                        key={item.lvl}
                        type="button"
                        onClick={() => setTargetCourseLevel(item.lvl as CourseLevel)}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          targetCourseLevel === item.lvl
                            ? "bg-orange-500 text-slate-950 font-black border-orange-400 shadow-lg shadow-orange-950/40 scale-105"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800"
                        }`}
                      >
                        <span className="block font-black text-sm">{item.lvl}</span>
                        <span className="text-[9px] block opacity-80">{item.kanji}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-blue-950/20 border border-blue-500/20 rounded-xl text-[11px] text-blue-300">
                  Editing a student&apos;s batch updates their classroom group allocation, attendance ledger, and scheduled timetable sessions.
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForEdit(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleSaveBatchAndLevel}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-lg shadow-orange-950/40 transition-all hover:scale-105"
                >
                  {isUpdating ? "Saving Changes..." : `Save Batch & Level`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
