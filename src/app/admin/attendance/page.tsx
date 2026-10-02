"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Navbar from "@/components/navigation/Navbar";
import { UserSession } from "@/lib/types";
import {
  Clock,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Layers,
  Sparkles,
  Save,
  RotateCcw,
  Check,
  X,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  UserCheck,
  HelpCircle,
} from "lucide-react";

interface StudentItem {
  id: string;
  name: string;
  email: string;
  courseLevel: string;
  section: string;
}

interface StudentLedgerItem {
  id: string;
  name: string;
  email: string;
  courseLevel: string;
  section: string;
  totalHours: number;
  presentHours: number;
  absentHours: number;
  leaveHours: number;
  overallRate: number;
  recentLogs?: any[];
}

interface AttendanceLogItem {
  id: string;
  studentId: string;
  date: string;
  hourSlot: string;
  status: string;
  subject: string | null;
  remarks: string | null;
  createdAt: string;
  student: {
    id: string;
    name: string;
    email: string;
    courseLevel: string;
    section: string;
  };
}

export default function AdminAttendancePage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"register" | "ledger" | "logs">("register");

  // =========================================================================
  // DAILY ATTENDANCE REGISTER STATE
  // =========================================================================
  const [registerDate, setRegisterDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [registerLevel, setRegisterLevel] = useState<string>("N3");
  const [registerSection, setRegisterSection] = useState<string>("A");
  const [registerHourSlot, setRegisterHourSlot] = useState<string>("09:00 AM - 10:00 AM");
  const [registerSubject, setRegisterSubject] = useState<string>("Kanji & Vocabulary");
  const [customSlot, setCustomSlot] = useState<string>("");

  // Roster in the daily register
  const [classStudents, setClassStudents] = useState<StudentItem[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<Record<string, "PRESENT" | "ABSENT" | "ON_LEAVE">>({});
  const [studentRemarks, setStudentRemarks] = useState<Record<string, string>>({});
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // =========================================================================
  // LEDGER & LOGS STATE
  // =========================================================================
  const [ledgerStudents, setLedgerStudents] = useState<StudentLedgerItem[]>([]);
  const [historyLogs, setHistoryLogs] = useState<AttendanceLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [filterSection, setFilterSection] = useState("ALL");

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

      // Load initial daily sheet
      await Promise.all([
        fetchDailySheet(registerDate, registerLevel, registerSection, registerHourSlot),
        fetchLedger(),
        fetchHistoryLogs(),
      ]);
    } catch (err) {
      console.error("Failed to load initial attendance data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Daily Sheet for Class & Date
  const fetchDailySheet = useCallback(
    async (date: string, level: string, section: string, slot: string) => {
      setLoadingSheet(true);
      try {
        const slotToUse = slot === "Custom Slot" ? customSlot || "09:00 AM - 10:00 AM" : slot;
        const url = `/api/attendance?mode=dailySheet&date=${date}&courseLevel=${level}&section=${section}&hourSlot=${encodeURIComponent(
          slotToUse
        )}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.students) {
          setClassStudents(data.students);

          // Populate initial statuses from existing records or default to PRESENT
          const initialStatuses: Record<string, "PRESENT" | "ABSENT" | "ON_LEAVE"> = {};
          const initialRemarks: Record<string, string> = {};

          data.students.forEach((s: StudentItem) => {
            const existing = data.existingRecords?.find((r: any) => r.studentId === s.id);
            if (existing) {
              initialStatuses[s.id] = existing.status;
              initialRemarks[s.id] = existing.remarks || "";
            } else {
              initialStatuses[s.id] = "PRESENT"; // Default feasible status
              initialRemarks[s.id] = "";
            }
          });

          setStudentStatuses(initialStatuses);
          setStudentRemarks(initialRemarks);
        }
      } catch (err) {
        console.error("Error loading daily sheet:", err);
      } finally {
        setLoadingSheet(false);
      }
    },
    [customSlot]
  );

  const fetchLedger = async () => {
    try {
      const res = await fetch("/api/attendance?mode=ledger");
      const data = await res.json();
      if (data.students) {
        setLedgerStudents(data.students);
      }
    } catch (err) {
      console.error("Ledger fetch error:", err);
    }
  };

  const fetchHistoryLogs = async () => {
    try {
      const res = await fetch("/api/attendance?mode=logs");
      const data = await res.json();
      if (data.logs) {
        setHistoryLogs(data.logs);
      }
    } catch (err) {
      console.error("Logs fetch error:", err);
    }
  };

  // On Register Parameter Change -> reload sheet
  const handleRegisterParamChange = (
    newDate = registerDate,
    newLevel = registerLevel,
    newSection = registerSection,
    newSlot = registerHourSlot
  ) => {
    setRegisterDate(newDate);
    setRegisterLevel(newLevel);
    setRegisterSection(newSection);
    setRegisterHourSlot(newSlot);
    fetchDailySheet(newDate, newLevel, newSection, newSlot);
  };

  // Date step helper (yesterday, today, tomorrow)
  const adjustDate = (days: number) => {
    const cur = new Date(registerDate);
    cur.setDate(cur.getDate() + days);
    const dateStr = cur.toISOString().split("T")[0];
    handleRegisterParamChange(dateStr, registerLevel, registerSection, registerHourSlot);
  };

  const setDateToToday = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    handleRegisterParamChange(todayStr, registerLevel, registerSection, registerHourSlot);
  };

  // Class-wide batch actions
  const markAllStatus = (newStatus: "PRESENT" | "ABSENT" | "ON_LEAVE") => {
    const updated: Record<string, "PRESENT" | "ABSENT" | "ON_LEAVE"> = {};
    classStudents.forEach((s) => {
      updated[s.id] = newStatus;
    });
    setStudentStatuses(updated);
  };

  // Individual toggle
  const toggleStudentStatus = (studentId: string, status: "PRESENT" | "ABSENT" | "ON_LEAVE") => {
    setStudentStatuses((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  // Save Daily Attendance
  const handleSaveDailyAttendance = async () => {
    if (savingAttendance || classStudents.length === 0) return;

    const finalSlot = registerHourSlot === "Custom Slot" ? customSlot.trim() : registerHourSlot;
    if (!finalSlot) {
      alert("Please specify a valid class hour slot.");
      return;
    }

    setSavingAttendance(true);
    try {
      const records = classStudents.map((s) => ({
        studentId: s.id,
        status: studentStatuses[s.id] || "PRESENT",
        remarks: studentRemarks[s.id]?.trim() || null,
      }));

      const payload = {
        date: registerDate,
        hourSlot: finalSlot,
        subject: registerSubject.trim() || "General Nihongo Class",
        records,
      };

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSaveSuccessMessage(
          `Daily attendance for ${registerLevel} Section ${registerSection} (${records.length} students) saved successfully!`
        );
        await Promise.all([fetchLedger(), fetchHistoryLogs()]);
        setTimeout(() => setSaveSuccessMessage(null), 4000);
      } else {
        alert(data.error || "Failed to save daily attendance.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error saving attendance.");
    } finally {
      setSavingAttendance(false);
    }
  };

  // Quick switch from ledger to register
  const handleQuickMarkStudentBatch = (student: StudentLedgerItem) => {
    setRegisterLevel(student.courseLevel);
    setRegisterSection(student.section);
    setActiveTab("register");
    fetchDailySheet(registerDate, student.courseLevel, student.section, registerHourSlot);
  };

  // Standard Hour Slots in 12-Hour AM/PM format
  const standardTimeSlots = [
    "09:00 AM - 10:00 AM",
    "10:00 AM - 11:00 AM",
    "11:00 AM - 12:00 PM",
    "12:00 PM - 01:00 PM",
    "02:00 PM - 03:00 PM",
    "03:00 PM - 04:00 PM",
    "04:00 PM - 05:00 PM",
    "05:00 PM - 06:00 PM",
    "Custom Slot",
  ];

  // Subjects
  const subjectPresets = [
    "Kanji & Vocabulary",
    "Grammar & Dokkai",
    "Listening Comprehension",
    "Kaiwa (Conversation)",
    "JLPT Test Drill",
    "General Nihongo",
  ];

  // Daily sheet live counts
  const sheetCounts = useMemo(() => {
    let pres = 0;
    let abs = 0;
    let lve = 0;
    classStudents.forEach((s) => {
      const st = studentStatuses[s.id] || "PRESENT";
      if (st === "PRESENT") pres++;
      else if (st === "ABSENT") abs++;
      else if (st === "ON_LEAVE") lve++;
    });
    return { pres, abs, lve, total: classStudents.length };
  }, [classStudents, studentStatuses]);

  // Filtered Ledger Students
  const filteredLedgerStudents = useMemo(() => {
    return ledgerStudents.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = filterLevel === "ALL" || s.courseLevel === filterLevel;
      const matchesSection = filterSection === "ALL" || s.section === filterSection;
      return matchesSearch && matchesLevel && matchesSection;
    });
  }, [ledgerStudents, searchQuery, filterLevel, filterSection]);

  // Filtered History Logs
  const filteredHistoryLogs = useMemo(() => {
    return historyLogs.filter((log) => {
      const matchesSearch =
        log.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.subject && log.subject.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesLevel = filterLevel === "ALL" || log.student.courseLevel === filterLevel;
      const matchesSection = filterSection === "ALL" || log.student.section === filterSection;
      return matchesSearch && matchesLevel && matchesSection;
    });
  }, [historyLogs, searchQuery, filterLevel, filterSection]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold">Loading Attendance Register & Ledger...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-orange-950 text-orange-400 border border-orange-800 uppercase tracking-wider">
                出席簿・Daily Attendance System
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1.5">
              Class Attendance Register & Cohort Ledger
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Mark day-to-day class attendance across JLPT levels, review verified student classroom hours, and audit attendance compliance.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl">
            <button
              onClick={() => setActiveTab("register")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "register"
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-950/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Daily Register
            </button>

            <button
              onClick={() => setActiveTab("ledger")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "ledger"
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-950/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Cohort Ledger ({ledgerStudents.length})
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "logs"
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-950/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              History Logs ({historyLogs.length})
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 text-xs shadow-2xl flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{saveSuccessMessage}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 1: FEASIBLE DAILY ATTENDANCE REGISTER                           */}
        {/* =================================================================== */}
        {activeTab === "register" && (
          <div className="space-y-6">
            {/* Filter & Session Selection Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-400" />
                    Session Parameters & Date
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select date, class batch, and hour slot to load and record today&apos;s attendance roster.
                  </p>
                </div>

                {/* Date Navigator */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustDate(-1)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Yesterday
                  </button>

                  <input
                    type="date"
                    value={registerDate}
                    onChange={(e) =>
                      handleRegisterParamChange(
                        e.target.value,
                        registerLevel,
                        registerSection,
                        registerHourSlot
                      )
                    }
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                  />

                  <button
                    onClick={setDateToToday}
                    className="px-3 py-1.5 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 text-xs font-semibold cursor-pointer"
                  >
                    Today
                  </button>

                  <button
                    onClick={() => adjustDate(1)}
                    className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    title="Next Day"
                  >
                    Tomorrow
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Class & Session Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Level */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    JLPT Tier / Class:
                  </label>
                  <select
                    value={registerLevel}
                    onChange={(e) =>
                      handleRegisterParamChange(
                        registerDate,
                        e.target.value,
                        registerSection,
                        registerHourSlot
                      )
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-orange-500"
                  >
                    <option value="N1">Level N1 (Advanced)</option>
                    <option value="N2">Level N2 (Upper Intermediate)</option>
                    <option value="N3">Level N3 (Intermediate)</option>
                    <option value="N4">Level N4 (Elementary)</option>
                    <option value="N5">Level N5 (Beginner)</option>
                  </select>
                </div>

                {/* Section / Batch */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Batch / Section:
                  </label>
                  <select
                    value={registerSection}
                    onChange={(e) =>
                      handleRegisterParamChange(
                        registerDate,
                        registerLevel,
                        e.target.value,
                        registerHourSlot
                      )
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-orange-500"
                  >
                    <option value="ALL">All Sections (Entire Level)</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="Weekend">Weekend Batch</option>
                  </select>
                </div>

                {/* Time Slot (AM/PM) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Session Hour Slot:
                  </label>
                  <select
                    value={registerHourSlot}
                    onChange={(e) =>
                      handleRegisterParamChange(
                        registerDate,
                        registerLevel,
                        registerSection,
                        e.target.value
                      )
                    }
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                  >
                    {standardTimeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Curriculum Subject:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={registerSubject}
                      onChange={(e) => setRegisterSubject(e.target.value)}
                      placeholder="e.g. Kanji & Vocabulary"
                      className="flex-1 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-orange-500"
                    />
                    <select
                      onChange={(e) => {
                        if (e.target.value) setRegisterSubject(e.target.value);
                      }}
                      defaultValue=""
                      className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 focus:outline-none focus:border-orange-500"
                    >
                      <option value="" disabled>
                        Presets
                      </option>
                      {subjectPresets.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Custom Slot input if selected */}
              {registerHourSlot === "Custom Slot" && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-semibold">Custom Hour Slot (AM/PM):</span>
                  <input
                    type="text"
                    placeholder="e.g. 06:30 PM - 07:30 PM"
                    value={customSlot}
                    onChange={(e) => setCustomSlot(e.target.value)}
                    className="flex-1 p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={() =>
                      handleRegisterParamChange(
                        registerDate,
                        registerLevel,
                        registerSection,
                        "Custom Slot"
                      )
                    }
                    className="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold"
                  >
                    Apply Slot
                  </button>
                </div>
              )}
            </div>

            {/* Quick Batch Actions & Sheet Stats Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Class Roster:
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-950 text-slate-300 text-xs font-mono font-bold border border-slate-800">
                  {sheetCounts.total} Students
                </span>
                <span className="text-xs text-emerald-400 font-bold">
                  ✓ {sheetCounts.pres} Present
                </span>
                <span className="text-xs text-rose-400 font-bold">
                  ✗ {sheetCounts.abs} Absent
                </span>
                <span className="text-xs text-amber-400 font-bold">
                  ⏳ {sheetCounts.lve} Leave
                </span>
              </div>

              {/* Quick Batch Mark Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => markAllStatus("PRESENT")}
                  className="px-3 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark All Present
                </button>

                <button
                  onClick={() => markAllStatus("ABSENT")}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/90 text-rose-300 border border-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Mark All Absent
                </button>

                <button
                  onClick={() => markAllStatus("ON_LEAVE")}
                  className="px-3 py-1.5 rounded-xl bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Mark All Leave
                </button>
              </div>
            </div>

            {/* Daily Roster Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              {loadingSheet ? (
                <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  Loading student roster for {registerLevel} {registerSection}...
                </div>
              ) : classStudents.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="font-semibold text-slate-400">
                    No students currently enrolled in {registerLevel} Section {registerSection}.
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Select a different JLPT level or batch from the filters above.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                        <th className="py-3 px-4 w-12 text-center">#</th>
                        <th className="py-3 px-4">Candidate Information</th>
                        <th className="py-3 px-4 text-center">Level & Batch</th>
                        <th className="py-3 px-4 text-center">Attendance Status</th>
                        <th className="py-3 px-4">Session Notes / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {classStudents.map((s, idx) => {
                        const currentStatus = studentStatuses[s.id] || "PRESENT";

                        return (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                              {idx + 1}
                            </td>

                            <td className="py-3.5 px-4 font-bold text-white">
                              <div>{s.name}</div>
                              <div className="text-[11px] text-slate-500 font-normal">{s.email}</div>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800 font-mono">
                                {s.courseLevel} - Sec {s.section}
                              </span>
                            </td>

                            {/* Feasible One-Click Pill Toggles */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleStudentStatus(s.id, "PRESENT")}
                                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                                    currentStatus === "PRESENT"
                                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/60 ring-2 ring-emerald-400"
                                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Present
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleStudentStatus(s.id, "ABSENT")}
                                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                                    currentStatus === "ABSENT"
                                      ? "bg-rose-600 text-white shadow-md shadow-rose-950/60 ring-2 ring-rose-400"
                                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Absent
                                </button>

                                <button
                                  type="button"
                                  onClick={() => toggleStudentStatus(s.id, "ON_LEAVE")}
                                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1 ${
                                    currentStatus === "ON_LEAVE"
                                      ? "bg-amber-600 text-white shadow-md shadow-amber-950/60 ring-2 ring-amber-400"
                                      : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  Leave
                                </button>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                placeholder="Optional note (e.g. excused, late)..."
                                value={studentRemarks[s.id] || ""}
                                onChange={(e) =>
                                  setStudentRemarks((prev) => ({
                                    ...prev,
                                    [s.id]: e.target.value,
                                  }))
                                }
                                className="w-full p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-orange-500"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Sticky Action Footer */}
              {classStudents.length > 0 && (
                <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    Recording attendance for{" "}
                    <strong className="text-white">
                      {registerLevel} Section {registerSection}
                    </strong>{" "}
                    on <span className="font-mono text-orange-300 font-bold">{registerDate}</span> (
                    {registerHourSlot}).
                  </div>

                  <button
                    onClick={handleSaveDailyAttendance}
                    disabled={savingAttendance}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-xs shadow-xl shadow-orange-950/50 cursor-pointer transition-all transform hover:scale-[1.01]"
                  >
                    <Save className="w-4 h-4" />
                    {savingAttendance ? "Saving Sheet..." : "Save Daily Attendance Sheet"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: COHORT ATTENDANCE LEDGER                                     */}
        {/* =================================================================== */}
        {activeTab === "ledger" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-400" />
                  Student Cohort Attendance Ledger
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Aggregate student attendance compliance rates, verified hours, and threshold eligibility.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search candidate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Level */}
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-orange-500"
                >
                  <option value="ALL">All Levels</option>
                  <option value="N1">Level N1</option>
                  <option value="N2">Level N2</option>
                  <option value="N3">Level N3</option>
                  <option value="N4">Level N4</option>
                  <option value="N5">Level N5</option>
                </select>

                {/* Section */}
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-orange-500"
                >
                  <option value="ALL">All Batches</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="Weekend">Weekend Batch</option>
                </select>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">JLPT Tier</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Attendance Rate</th>
                    <th className="py-3 px-4 text-center">Classroom Hours</th>
                    <th className="py-3 px-4 text-center">Absences</th>
                    <th className="py-3 px-4 text-center">Leaves</th>
                    <th className="py-3 px-4 text-center">Threshold Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredLedgerStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                        No students matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLedgerStudents.map((s) => {
                      const isEligible = s.overallRate >= 75;

                      return (
                        <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-white">
                            <div>{s.name}</div>
                            <div className="text-[11px] text-slate-500 font-normal">{s.email}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800 font-mono">
                              {s.courseLevel}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-medium text-slate-300">
                            {s.section}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <span
                                className={`font-mono font-bold text-xs w-12 ${
                                  isEligible ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {s.overallRate}%
                              </span>
                              <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    isEligible ? "bg-emerald-500" : "bg-rose-500"
                                  }`}
                                  style={{ width: `${Math.min(100, s.overallRate)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-bold text-white">
                            {s.presentHours} / {s.totalHours} hrs
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono text-rose-400">
                            {s.absentHours} hrs
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono text-amber-400">
                            {s.leaveHours} hrs
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isEligible
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-rose-950 text-rose-300 border border-rose-800"
                              }`}
                            >
                              {isEligible ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              {isEligible ? "Eligible (≥75%)" : "Low Attendance"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleQuickMarkStudentBatch(s)}
                              className="px-3 py-1 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/30 text-[11px] font-semibold transition-colors cursor-pointer"
                            >
                              Mark Daily →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: SESSION HISTORY LOGS                                         */}
        {/* =================================================================== */}
        {activeTab === "logs" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  Historical Attendance Records
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete audit trail of all recorded classroom sessions across batches.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Class / Batch</th>
                    <th className="py-3 px-4">Hour Slot</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredHistoryLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        No attendance logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredHistoryLogs.map((log) => {
                      const isPresent = log.status === "PRESENT";
                      const isLeave = log.status === "ON_LEAVE";

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-200">
                            {new Date(log.date).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </td>

                          <td className="py-3.5 px-4 font-bold text-white">
                            <div>{log.student.name}</div>
                            <div className="text-[11px] text-slate-500 font-normal">{log.student.email}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-950 text-orange-400 border border-orange-800 font-mono">
                              {log.student.courseLevel} - Sec {log.student.section}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-slate-300">
                            {log.hourSlot}
                          </td>

                          <td className="py-3.5 px-4 text-slate-200 font-medium">
                            {log.subject || "Classroom Lecture"}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isPresent
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : isLeave
                                  ? "bg-amber-950 text-amber-300 border border-amber-800"
                                  : "bg-rose-950 text-rose-300 border border-rose-800"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            {log.remarks || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
