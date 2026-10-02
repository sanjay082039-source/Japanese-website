"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/navigation/Navbar";
import HourlyTimetable from "@/components/timetable/HourlyTimetable";
import { UserSession, TimetableSlotItem, CourseLevel } from "@/lib/types";
import { Plus, Calendar, Clock, MapPin, CheckCircle, X, Trash2, Edit3, BookOpen } from "lucide-react";
import { toAmPm, TIME_AM_PM_OPTIONS } from "@/lib/timeUtils";

export default function AdminTimetablePage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [slots, setSlots] = useState<TimetableSlotItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for adding a new slot
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formDay, setFormDay] = useState<number>(1);
  const [formStartTime, setFormStartTime] = useState<string>("09:00 AM");
  const [formEndTime, setFormEndTime] = useState<string>("10:00 AM");
  const [formLevel, setFormLevel] = useState<CourseLevel>("N5");
  const [formSubject, setFormSubject] = useState<string>("");
  const [formRoom, setFormRoom] = useState<string>("Annex Room 101");
  const [addMessage, setAddMessage] = useState<string | null>(null);

  // Modal State for EDITING an existing slot (Admin can edit time and details)
  const [editingSlot, setEditingSlot] = useState<TimetableSlotItem | null>(null);
  const [editDay, setEditDay] = useState<number>(1);
  const [editStartTime, setEditStartTime] = useState<string>("09:00 AM");
  const [editEndTime, setEditEndTime] = useState<string>("10:00 AM");
  const [editLevel, setEditLevel] = useState<CourseLevel>("N5");
  const [editSubject, setEditSubject] = useState<string>("");
  const [editRoom, setEditRoom] = useState<string>("Annex Room 101");
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    fetchProfileAndTimetable();
  }, []);

  const fetchProfileAndTimetable = async () => {
    try {
      const userRes = await fetch("/api/auth/me");
      const userData = await userRes.json();
      if (!userData.user || userData.user.role !== "ADMIN") {
        window.location.href = "/login";
        return;
      }
      setUser(userData.user);

      const tableRes = await fetch("/api/timetable?courseLevel=ALL");
      const tableData = await tableRes.json();
      setSlots(tableData.slots || []);
    } catch (err) {
      console.error("Failed to load timetable:", err);
    } finally {
      setLoading(false);
    }
  };

  // Open Add modal with clicked cell's day and start time
  const handleOpenAddSlot = (day: number, timeAmPm: string, courseLevel: CourseLevel) => {
    setFormDay(day);
    const normalizedStart = toAmPm(timeAmPm);
    setFormStartTime(normalizedStart);

    // Calculate next hour for end time
    const startIdx = TIME_AM_PM_OPTIONS.indexOf(normalizedStart);
    if (startIdx !== -1 && startIdx + 2 < TIME_AM_PM_OPTIONS.length) {
      setFormEndTime(TIME_AM_PM_OPTIONS[startIdx + 2]); // +1 hour
    } else {
      setFormEndTime("10:00 AM");
    }

    setFormLevel(courseLevel);
    setFormSubject("");
    setFormRoom("Annex Room 101");
    setAddMessage(null);
    setIsAddModalOpen(true);
  };

  // Open Edit modal when an existing slot is clicked
  const handleOpenEditSlot = (slot: TimetableSlotItem) => {
    setEditingSlot(slot);
    setEditDay(slot.dayOfWeek);
    setEditStartTime(toAmPm(slot.startTime));
    setEditEndTime(toAmPm(slot.endTime));
    setEditLevel(slot.courseLevel);
    setEditSubject(slot.subject);
    setEditRoom(slot.room || "Annex Room 101");
    setEditMessage(null);
  };

  // Save edited slot
  const handleUpdateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot || !editSubject.trim()) return;
    setIsSavingEdit(true);
    setEditMessage(null);

    try {
      const res = await fetch("/api/timetable", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSlot.id,
          dayOfWeek: editDay,
          startTime: editStartTime,
          endTime: editEndTime,
          courseLevel: editLevel,
          subject: editSubject,
          room: editRoom,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setEditMessage("Timetable slot successfully updated!");
        setTimeout(() => {
          setEditingSlot(null);
          fetchProfileAndTimetable();
        }, 800);
      } else {
        setEditMessage(data.error || "Failed to update slot.");
      }
    } catch (err) {
      console.error("Update slot error:", err);
      setEditMessage("Network error updating timetable slot.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Create new slot
  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubject.trim()) return;

    try {
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: formDay,
          startTime: formStartTime,
          endTime: formEndTime,
          courseLevel: formLevel,
          subject: formSubject,
          room: formRoom,
        }),
      });

      if (res.ok) {
        setAddMessage("Slot scheduled successfully!");
        setTimeout(() => {
          setIsAddModalOpen(false);
          fetchProfileAndTimetable();
        }, 800);
      }
    } catch (err) {
      console.error("Save slot failed:", err);
    }
  };

  // Delete slot
  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm("Are you sure you want to remove this timetable slot?")) return;
    try {
      await fetch(`/api/timetable?id=${slotId}`, { method: "DELETE" });
      setEditingSlot(null);
      fetchProfileAndTimetable();
    } catch (err) {
      console.error("Delete slot failed:", err);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading Master Timetable Scheduler...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070D18] pb-16">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                時間割編成・Master Scheduler
              </span>
              <span className="text-xs text-slate-400">AM / PM Hourly Schedule Editor</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Academic Timetable & Schedule Manager
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Construct, edit times (in AM/PM), and reassign classroom slots across JLPT Levels N1 through N5.
            </p>
          </div>

          <button
            onClick={() => {
              setFormDay(1);
              setFormStartTime("09:00 AM");
              setFormEndTime("10:00 AM");
              setFormLevel("N5");
              setFormSubject("");
              setFormRoom("Annex Room 101");
              setAddMessage(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold text-xs shadow-lg shadow-orange-950/40 transition-all hover:scale-105"
          >
            <Plus className="w-4 h-4" /> Add Academic Slot
          </button>
        </div>

        {/* Master Timetable Component with AM & PM */}
        <HourlyTimetable
          slots={slots}
          userRole={user.role}
          onAddSlot={handleOpenAddSlot}
          onSlotClick={handleOpenEditSlot}
        />

        {/* ============================================================== */}
        {/* EDIT TIMETABLE SLOT MODAL (Allows admin to edit time in AM/PM) */}
        {/* ============================================================== */}
        {editingSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Edit Timetable Slot
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Modify session start & end time (AM/PM), subject, or venue
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingSlot(null)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                  {editMessage}
                </div>
              )}

              <form onSubmit={handleUpdateSlot} className="space-y-4 text-xs">
                {/* Day & JLPT Tier */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Day of the Week
                    </label>
                    <select
                      value={editDay}
                      onChange={(e) => setEditDay(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500"
                    >
                      <option value={1}>Monday (月曜日)</option>
                      <option value={2}>Tuesday (火曜日)</option>
                      <option value={3}>Wednesday (水曜日)</option>
                      <option value={4}>Thursday (木曜日)</option>
                      <option value={5}>Friday (金曜日)</option>
                      <option value={6}>Saturday (土曜日)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      JLPT Level
                    </label>
                    <select
                      value={editLevel}
                      onChange={(e) => setEditLevel(e.target.value as CourseLevel)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500 font-mono font-bold"
                    >
                      <option value="N1">N1 (Advanced)</option>
                      <option value="N2">N2 (Pre-Advanced)</option>
                      <option value="N3">N3 (Intermediate)</option>
                      <option value="N4">N4 (Elementary)</option>
                      <option value="N5">N5 (Beginner)</option>
                    </select>
                  </div>
                </div>

                {/* Start Time & End Time in AM and PM */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-1.5 text-orange-400 font-semibold text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Lecture Time Window (AM & PM Format)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Start Time (AM/PM)
                      </label>
                      <select
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono font-bold outline-none focus:border-orange-500"
                      >
                        {TIME_AM_PM_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        End Time (AM/PM)
                      </label>
                      <select
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono font-bold outline-none focus:border-orange-500"
                      >
                        {TIME_AM_PM_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Subject & Module */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Subject / Curriculum Module Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    placeholder="e.g. Kanji Mastery, Bunpou Dokkai, Choukai Drills"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500"
                  />
                </div>

                {/* Room / Lab */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Classroom / Lab Venue
                  </label>
                  <input
                    type="text"
                    value={editRoom}
                    onChange={(e) => setEditRoom(e.target.value)}
                    placeholder="Annex Room 101, Main Language Lab"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500"
                  />
                </div>

                {/* Action Buttons: Delete, Cancel, Save */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(editingSlot.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/80 text-rose-300 text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Slot</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingSlot(null)}
                      className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingEdit}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-lg shadow-orange-950/40 transition-all hover:scale-105"
                    >
                      {isSavingEdit ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* ADD ACADEMIC SLOT MODAL                                       */}
        {/* ============================================================== */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Assign Hourly Lecture Slot
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Schedule a new lecture window in AM/PM format
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                  {addMessage}
                </div>
              )}

              <form onSubmit={handleCreateSlot} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Day</label>
                    <select
                      value={formDay}
                      onChange={(e) => setFormDay(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500"
                    >
                      <option value={1}>Monday (月曜日)</option>
                      <option value={2}>Tuesday (火曜日)</option>
                      <option value={3}>Wednesday (水曜日)</option>
                      <option value={4}>Thursday (木曜日)</option>
                      <option value={5}>Friday (金曜日)</option>
                      <option value={6}>Saturday (土曜日)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">JLPT Level</label>
                    <select
                      value={formLevel}
                      onChange={(e) => setFormLevel(e.target.value as CourseLevel)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500 font-mono font-bold"
                    >
                      <option value="N1">N1</option>
                      <option value="N2">N2</option>
                      <option value="N3">N3</option>
                      <option value="N4">N4</option>
                      <option value="N5">N5</option>
                    </select>
                  </div>
                </div>

                {/* Start & End Times in AM/PM */}
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-1.5 text-orange-400 font-semibold text-xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Time Slot (AM / PM Selection)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Start Time</label>
                      <select
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono font-bold outline-none focus:border-orange-500"
                      >
                        {TIME_AM_PM_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">End Time</label>
                      <select
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono font-bold outline-none focus:border-orange-500"
                      >
                        {TIME_AM_PM_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Subject / Curriculum Module Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="e.g. Kanji Mastery, Bunpou Dokkai, Choukai Drills"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Classroom / Lab Venue
                  </label>
                  <input
                    type="text"
                    value={formRoom}
                    onChange={(e) => setFormRoom(e.target.value)}
                    placeholder="Annex Room 101"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-orange-500"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-extrabold text-xs shadow-lg shadow-orange-950/40 transition-all hover:scale-105"
                  >
                    Create Slot
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
