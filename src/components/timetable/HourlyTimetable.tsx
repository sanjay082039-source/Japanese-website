"use client";

import React, { useState, useMemo } from "react";
import { CourseLevel, TimetableSlotItem } from "@/lib/types";
import { Clock, MapPin, User as UserIcon, Calendar, Plus, Filter, Edit3 } from "lucide-react";
import { toAmPm, formatTimeRangeAmPm, STANDARD_HOURLY_SLOTS } from "@/lib/timeUtils";

interface HourlyTimetableProps {
  slots: TimetableSlotItem[];
  userRole?: "ADMIN" | "STUDENT";
  userCourseLevel?: CourseLevel;
  onSlotClick?: (slot: TimetableSlotItem) => void;
  onAddSlot?: (day: number, timeAmPm: string, courseLevel: CourseLevel) => void;
}

const DAYS = [
  { id: 1, name: "Monday" },
  { id: 2, name: "Tuesday" },
  { id: 3, name: "Wednesday" },
  { id: 4, name: "Thursday" },
  { id: 5, name: "Friday" },
  { id: 6, name: "Saturday" },
];

export const HourlyTimetable: React.FC<HourlyTimetableProps> = ({
  slots,
  userRole = "STUDENT",
  userCourseLevel,
  onSlotClick,
  onAddSlot,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<CourseLevel | "ALL">(
    userCourseLevel || "ALL"
  );
  const [selectedDay, setSelectedDay] = useState<number | "ALL">("ALL");

  // Determine current active hour and day
  const now = new Date();
  const currentDayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1 = Mon, 7 = Sun
  const currentHour = now.getHours();

  // Filter slots
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (selectedLevel !== "ALL" && slot.courseLevel !== selectedLevel) {
        return false;
      }
      if (selectedDay !== "ALL" && slot.dayOfWeek !== selectedDay) {
        return false;
      }
      return true;
    });
  }, [slots, selectedLevel, selectedDay]);

  // Dynamically compute all time rows (standard 09:00 AM - 04:00 PM + any custom slots)
  const displayTimeRows = useMemo(() => {
    const baseRows = STANDARD_HOURLY_SLOTS.map((s) => ({
      labelAmPm: s.label,
      start24: s.start24,
      end24: s.end24,
      isBreak: s.isBreak,
    }));

    // Find custom slot times that aren't already represented
    const seenStarts = new Set(baseRows.map((r) => r.start24));
    const customRows: { labelAmPm: string; start24: string; end24: string; isBreak: boolean }[] = [];

    slots.forEach((s) => {
      const s24 = s.startTime.includes(":") ? s.startTime.slice(0, 5) : s.startTime;
      if (!seenStarts.has(s24)) {
        seenStarts.add(s24);
        customRows.push({
          labelAmPm: formatTimeRangeAmPm(s.startTime, s.endTime),
          start24: s.startTime,
          end24: s.endTime,
          isBreak: false,
        });
      }
    });

    return [...baseRows, ...customRows].sort((a, b) => a.start24.localeCompare(b.start24));
  }, [slots]);

  const isCurrentTimeSlot = (start24: string, dayId: number): boolean => {
    if (dayId !== currentDayOfWeek) return false;
    const [startHourStr] = start24.split(":");
    const startHour = parseInt(startHourStr, 10);
    return currentHour === startHour;
  };

  // Lookup helper: find slot for day and time row
  const findSlot = (dayId: number, start24: string) => {
    const targetStart = start24.trim();
    return filteredSlots.find((slot) => {
      if (slot.dayOfWeek !== dayId) return false;
      const sStart = slot.startTime.trim();
      return (
        sStart === targetStart ||
        toAmPm(sStart) === toAmPm(targetStart) ||
        sStart.startsWith(targetStart)
      );
    });
  };

  // Color mapping by JLPT level matching logo palette
  const getLevelBadgeColor = (level: CourseLevel) => {
    switch (level) {
      case "N1":
        return "bg-indigo-950/80 border-indigo-500/40 text-indigo-200 hover:border-indigo-400";
      case "N2":
        return "bg-orange-950/80 border-orange-500/40 text-orange-200 hover:border-orange-400";
      case "N3":
        return "bg-amber-950/80 border-amber-500/40 text-amber-200 hover:border-amber-400";
      case "N4":
        return "bg-sky-950/80 border-sky-500/40 text-sky-200 hover:border-sky-400";
      case "N5":
        return "bg-blue-950/80 border-blue-500/40 text-blue-200 hover:border-blue-400";
      default:
        return "bg-slate-900 border-slate-700 text-slate-300";
    }
  };

  // Displayed days based on mobile selection
  const displayedDays = useMemo(() => {
    if (selectedDay === "ALL") return DAYS;
    return DAYS.filter((d) => d.id === selectedDay);
  }, [selectedDay]);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-3 sm:p-6 shadow-2xl backdrop-blur-xl">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
              Class Timetable
            </span>
            <span className="text-xs text-slate-400">AM / PM Synchronized Timetable</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-orange-400" />
            Academic Hourly Timetable
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {userRole === "ADMIN"
              ? "Click any scheduled slot to edit start/end times, JLPT tier, subject, and classroom."
              : "Synchronized lecture schedule with real-time active session indicator."}
          </p>
        </div>

        {/* JLPT Level Filter Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-1 overflow-x-auto max-w-full">
            {(["ALL", "N1", "N2", "N3", "N4", "N5"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedLevel === lvl
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-slate-950 font-bold shadow-md shadow-orange-950/40"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Mobile Quick Day Selector */}
          <div className="flex md:hidden items-center gap-1 overflow-x-auto w-full pb-1">
            <button
              onClick={() => setSelectedDay("ALL")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedDay === "ALL"
                  ? "bg-orange-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-400 border border-slate-800"
              }`}
            >
              All Days
            </button>
            {DAYS.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDay(d.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedDay === d.id
                    ? "bg-orange-500 text-slate-950 font-bold"
                    : "bg-slate-950 text-slate-400 border border-slate-800"
                }`}
              >
                {d.name.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timetable Desktop Grid with AM & PM Formatting */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-800/80 shadow-inner">
        <table className={`w-full text-left border-collapse ${selectedDay === "ALL" ? "min-w-[820px]" : "min-w-[320px]"}`}>
          <thead>
            <tr className="bg-slate-950 text-slate-300 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider">
              <th className="py-4 px-3 sm:px-4 w-36 sm:w-44 border-r border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1.5 text-orange-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Time (AM/PM)</span>
                </div>
              </th>
              {displayedDays.map((day) => (
                <th
                  key={day.id}
                  className={`py-4 px-3 border-r border-slate-800 last:border-r-0 ${
                    day.id === currentDayOfWeek
                      ? "bg-blue-950/40 text-blue-300 font-bold border-t-2 border-t-orange-400"
                      : ""
                  }`}
                >
                  <span className="text-sm font-semibold">{day.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {displayTimeRows.map((row) => {
              const isLunchBreak = row.isBreak;

              return (
                <tr
                  key={row.labelAmPm}
                  className={`hover:bg-slate-800/20 transition-colors ${
                    isLunchBreak ? "bg-slate-950/40" : ""
                  }`}
                >
                  {/* Time Column with Strict AM and PM Format */}
                  <td className="py-3.5 px-2 sm:px-3 border-r border-slate-800 text-center text-xs font-mono font-bold text-slate-200 bg-slate-950/60 whitespace-nowrap">
                    <span className="text-white block">{row.labelAmPm}</span>
                    {isLunchBreak && (
                      <span className="text-[10px] text-amber-400 font-sans font-medium block mt-0.5">
                        Lunch Break
                      </span>
                    )}
                  </td>

                  {/* Days Columns */}
                  {displayedDays.map((day) => {
                    const slot = findSlot(day.id, row.start24);
                    const isNow = isCurrentTimeSlot(row.start24, day.id);

                    if (isLunchBreak) {
                      return (
                        <td
                          key={day.id}
                          className="py-2.5 px-2 border-r border-slate-800 last:border-r-0 text-center bg-slate-950/20"
                        >
                          <span className="text-xs text-slate-600 italic">
                            Recess
                          </span>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={day.id}
                        className={`py-2 px-2 border-r border-slate-800 last:border-r-0 align-top transition-all ${
                          isNow ? "bg-blue-950/20" : ""
                        }`}
                      >
                        {slot ? (
                          <div
                            onClick={() => onSlotClick && onSlotClick(slot)}
                            className={`p-2.5 rounded-2xl border transition-all cursor-pointer hover:scale-[1.02] shadow-sm relative group ${getLevelBadgeColor(
                              slot.courseLevel
                            )} ${
                              isNow
                                ? "ring-2 ring-orange-500 shadow-orange-950/50"
                                : ""
                            }`}
                          >
                            {/* Hover Edit Indicator for Admin */}
                            {userRole === "ADMIN" && (
                              <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md bg-black/60 text-orange-300 transition-opacity">
                                <Edit3 className="w-3 h-3" />
                              </span>
                            )}

                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-black/50 text-white font-mono">
                                {slot.courseLevel}
                              </span>

                              {isNow && (
                                <span className="flex h-2 w-2 relative" title="Active Session">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                </span>
                              )}
                            </div>

                            <p className="font-bold text-xs leading-snug text-white line-clamp-2">
                              {slot.subject}
                            </p>

                            {/* Exact Slot Time in AM/PM */}
                            <div className="mt-1.5 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-300">
                              <span className="text-orange-300 font-semibold">
                                {formatTimeRangeAmPm(slot.startTime, slot.endTime)}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-slate-400">
                              {slot.staffName && (
                                <div className="flex items-center gap-1 truncate text-slate-300">
                                  <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{slot.staffName}</span>
                                </div>
                              )}
                              {slot.room && (
                                <div className="flex items-center gap-1 text-slate-400">
                                  <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                                  <span>{slot.room}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full min-h-[82px] flex items-center justify-center p-2 rounded-2xl border border-dashed border-slate-800/70 hover:border-slate-700 group transition-colors">
                            {userRole === "ADMIN" && onAddSlot ? (
                              <button
                                onClick={() => {
                                  onAddSlot(
                                    day.id,
                                    toAmPm(row.start24),
                                    selectedLevel === "ALL" ? "N5" : selectedLevel
                                  );
                                }}
                                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition-opacity"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Assign Slot
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-600">
                                Self-Study
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HourlyTimetable;
