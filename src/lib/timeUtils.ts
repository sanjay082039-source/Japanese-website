/**
 * Time utility functions for 12-hour AM/PM formatting and 24-hour conversions
 */

export function toAmPm(timeStr: string): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  if (/AM|PM/i.test(trimmed)) {
    // Already has AM/PM, normalize spacing and case
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match) {
      const h = match[1].padStart(2, "0");
      const m = match[2];
      const ampm = match[3].toUpperCase();
      return `${h}:${m} ${ampm}`;
    }
    return trimmed.toUpperCase();
  }

  const parts = trimmed.split(":");
  let h = parseInt(parts[0], 10);
  const m = parts[1] ? parts[1].slice(0, 2).padStart(2, "0") : "00";
  if (isNaN(h)) return trimmed;

  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12; // 0 becomes 12
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

export function to24Hour(timeStr: string): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return trimmed;

  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = match[3].toUpperCase();

  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  return `${String(h).padStart(2, "0")}:${m}`;
}

export function formatTimeRangeAmPm(start: string, end: string): string {
  return `${toAmPm(start)} - ${toAmPm(end)}`;
}

export const STANDARD_HOURLY_SLOTS = [
  { label: "09:00 AM - 10:00 AM", start24: "09:00", end24: "10:00", isBreak: false },
  { label: "10:00 AM - 11:00 AM", start24: "10:00", end24: "11:00", isBreak: false },
  { label: "11:00 AM - 12:00 PM", start24: "11:00", end24: "12:00", isBreak: false },
  { label: "12:00 PM - 01:00 PM", start24: "12:00", end24: "13:00", isBreak: true }, // Lunch / Break
  { label: "01:00 PM - 02:00 PM", start24: "13:00", end24: "14:00", isBreak: false },
  { label: "02:00 PM - 03:00 PM", start24: "14:00", end24: "15:00", isBreak: false },
  { label: "03:00 PM - 04:00 PM", start24: "15:00", end24: "16:00", isBreak: false },
];

export const TIME_AM_PM_OPTIONS = [
  "08:00 AM",
  "08:30 AM",
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
  "04:30 PM",
  "05:00 PM",
  "05:30 PM",
  "06:00 PM",
];
