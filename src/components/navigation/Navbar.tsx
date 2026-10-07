"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserSession } from "@/lib/types";
import {
  Calendar,
  ClipboardList,
  FileCheck2,
  Users,
  ShieldAlert,
  LogOut,
  LayoutDashboard,
  Clock,
  BookOpen,
  Menu,
  X,
  ChevronRight,
  Bot,
  Video,
  Fingerprint,
  Sparkles,
  QrCode,
} from "lucide-react";

interface NavbarProps {
  user: UserSession;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Live Attendance stats for the Attendance option in the menu
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null);

  // Fetch Attendance stats on mount
  useEffect(() => {
    let isMounted = true;
    async function loadAttendance() {
      try {
        const res = await fetch("/api/attendance");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.overallRate !== undefined) {
            setAttendanceRate(Number(data.overallRate));
          }
        }
      } catch (err) {
        console.error("Failed to fetch attendance:", err);
      }
    }
    loadAttendance();
    return () => {
      isMounted = false;
    };
  }, []);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Close menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  // Lock body scroll when menu is open on mobile
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const isAdmin = user.role === "ADMIN";

  const studentLinks = [
    {
      href: "/student/dashboard",
      label: "Dashboard",
      description: "Overview of academic progress & standing",
      icon: LayoutDashboard,
    },
    {
      href: "/student/ai-sensei",
      label: "AI Sensei Partner",
      description: "Interactive Japanese chat & @explain vocab",
      icon: Bot,
    },
    {
      href: "/student/chapters",
      label: "Video Chapters & Notes",
      description: "Lecture notes & gated completion quizzes",
      icon: Video,
    },
    {
      href: "/student/scan",
      label: "QR Attendance Scanner",
      description: "Scan classroom dynamic QR with GPS lock",
      icon: QrCode,
    },
    {
      href: "/student/attendance",
      label: "Attendance Ledger",
      description: "Verified session logs & geofence audit",
      icon: Clock,
      badge: attendanceRate !== null ? `${attendanceRate}%` : undefined,
      badgeColor: attendanceRate !== null && attendanceRate >= 75 ? "emerald" : "amber",
    },
    {
      href: "/student/timetable",
      label: "Timetable",
      description: "Hourly schedule in AM/PM format",
      icon: Calendar,
    },
    {
      href: "/student/assignments",
      label: "Daily AI Homework",
      description: "Personalized anti-collusion practicums",
      icon: FileCheck2,
    },
    {
      href: "/student/exams",
      label: "Exams",
      description: "Secure proctored testing room",
      icon: ClipboardList,
    },
  ];

  const adminLinks = [
    {
      href: "/admin/dashboard",
      label: "Overview",
      description: "Command console & student progress",
      icon: LayoutDashboard,
    },
    {
      href: "/admin/attendance",
      label: "QR Sessions & Attendance",
      description: "Projector dynamic QR, live kiosk & override",
      icon: QrCode,
      badge: attendanceRate !== null ? `${attendanceRate}%` : undefined,
      badgeColor: attendanceRate !== null && attendanceRate >= 75 ? "emerald" : "amber",
    },
    {
      href: "/admin/students",
      label: "Student Directory & Dossiers",
      description: "360° student record, devices & Excel export",
      icon: Users,
    },
    {
      href: "/admin/chapters",
      label: "Chapter Publisher",
      description: "Video lecture manager & quiz attachments",
      icon: Video,
    },
    {
      href: "/admin/timetable",
      label: "Master Timetable",
      description: "AM/PM scheduler & hourly planner",
      icon: Calendar,
    },
    {
      href: "/admin/exams",
      label: "Exam & AI Generator",
      description: "Evaluation module & AI test builder",
      icon: ShieldAlert,
    },
    {
      href: "/admin/assignments",
      label: "Assignments",
      description: "Publish assignments & evaluate scoring",
      icon: BookOpen,
    },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  return (
    <>
      {/* Clean Top Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#081220]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Sole Navigation Control & Main Brand Title */}
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
            {/* Sole Menu Toggle Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="btn-spring flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl bg-slate-900/90 border border-white/10 hover:border-[#f06449]/50 hover:bg-slate-800 text-slate-100 transition-all cursor-pointer shadow-sm group shrink-0"
            >
              {isMenuOpen ? (
                <X className="w-4 h-4 text-[#ff7c62] group-hover:rotate-90 transition-transform duration-200" />
              ) : (
                <Menu className="w-4 h-4 text-[#ff7c62] group-hover:scale-110 transition-transform duration-200" />
              )}
              <span className="text-xs font-bold tracking-wide">
                {isMenuOpen ? "Close" : "Menu"}
              </span>
            </button>

            {/* Main Brand Title: RIT JAPANESE COURSE */}
            <Link
              href={isAdmin ? "/admin/dashboard" : "/student/dashboard"}
              className="flex items-center gap-2 sm:gap-2.5 group min-w-0"
            >
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border border-[#f06449]/40 shadow-md shadow-[#081220]/60 group-hover:scale-105 transition-transform shrink-0 bg-[#081220]">
                <img
                  src="/logo.png"
                  alt="RIT Japanese Portal Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs sm:text-base tracking-tight text-white truncate">
                    RIT <span className="text-[#ff7c62]">JAPANESE COURSE</span>
                  </span>
                  <span className="hidden sm:inline-flex text-[9px] px-1.5 py-0.5 rounded bg-[#296ec2]/20 text-[#93c5fd] font-medium border border-[#296ec2]/35 shrink-0">
                    JLPT Academy
                  </span>
                </div>
                <p className="text-[9px] sm:text-[11px] text-[#ff7c62] font-bold tracking-wider uppercase truncate">
                  BELIEVE IN THE POSSIBILITIES
                </p>
              </div>
            </Link>
          </div>

          {/* Right: User Identity & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-200">{user.name}</span>
              <div className="flex items-center gap-1 justify-end">
                <span
                  className={`text-[10px] px-1.5 rounded font-mono font-bold ${
                    isAdmin
                      ? "bg-[#2a1714] text-[#ff7c62] border border-[#f06449]/40"
                      : "bg-[#0f294d] text-[#93c5fd] border border-[#1b4987]"
                  }`}
                >
                  {user.role}
                </span>
                <span className="text-[10px] px-1.5 rounded bg-slate-900 text-slate-300 border border-white/10 font-mono">
                  JLPT {user.courseLevel} ({user.section})
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Log Out"
              className="btn-spring p-2 rounded-xl bg-slate-900/90 border border-white/10 text-slate-400 hover:text-[#ff7c62] hover:border-[#f06449]/40 hover:bg-slate-800 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* COLLAPSIBLE SIDEBAR / DRAWER MENU (OPEN & CLOSE WISE)                */}
      {/* ==================================================================== */}
      {/* Backdrop Overlay */}
      <div
        onClick={() => setIsMenuOpen(false)}
        className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-md transition-opacity duration-350 ${
          isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-over Drawer (Clean, Smooth & Scrollable with Spring Physics) */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-sm sm:w-96 bg-[#081220]/95 backdrop-blur-2xl border-r border-[#296ec2]/20 shadow-2xl flex flex-col justify-between transition-transform duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] transform overflow-hidden ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header (Fixed at top of drawer) */}
        <div className="p-5 border-b border-white/10 shrink-0 space-y-3 bg-[#081220]/90">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-[#f06449]/30 bg-[#081220]">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-white tracking-tight">
                  RIT <span className="text-[#ff7c62]">JAPANESE COURSE</span>
                </span>
                <p className="text-[10px] text-[#ff7c62] font-bold uppercase tracking-wider">
                  BELIEVE IN THE POSSIBILITIES
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
              title="Close Menu (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="p-3 bg-[#0b1a2d]/90 border border-[#296ec2]/20 rounded-2xl flex items-center justify-between">
            <div>
              <div className="font-bold text-xs text-white">{user.name}</div>
              <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  isAdmin
                    ? "bg-[#2a1714] text-[#ff7c62] border border-[#f06449]/40"
                    : "bg-[#0f294d] text-[#93c5fd] border border-[#1b4987]"
                }`}
              >
                {user.role}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-800 font-mono">
                JLPT {user.courseLevel} ({user.section})
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Options List (Including Attendance like other options) */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-2 scroll-smooth">
          <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            {isAdmin ? "Admin Management Modules" : "Student Academic Modules"}
          </div>

          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== "/admin/dashboard" && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`btn-spring group flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#296ec2]/20 border-[#296ec2]/50 text-white shadow-lg shadow-[#081220]/50"
                    : "bg-slate-900/60 border-white/5 text-slate-300 hover:bg-slate-800/80 hover:border-white/10"
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                    isActive
                      ? "bg-gradient-to-br from-[#296ec2] to-[#1b4987] text-white shadow-md shadow-[#081220]/60"
                      : "bg-slate-900 text-slate-400 group-hover:text-[#5c9ee6]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs">{link.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {"badge" in link && link.badge && (
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                            link.badgeColor === "emerald"
                              ? "bg-emerald-950/80 text-emerald-300 border-emerald-800/80"
                              : "bg-[#2a1714] text-[#ff7c62] border-[#f06449]/40"
                          }`}
                        >
                          {link.badge}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isActive ? "text-[#ff7c62] translate-x-0.5" : "text-slate-600"
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-1">
                    {link.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Drawer Bottom Footer (Fixed at bottom of drawer) */}
        <div className="p-4 pb-safe border-t border-white/10 bg-[#060d17] shrink-0 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              RIT Course Network Online
            </span>
            <span className="font-mono text-[10px] text-slate-500">JLPT Certified</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-[#ff7c62] hover:text-[#ffa694] transition-all cursor-pointer min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            Sign Out of Portal
          </button>
        </div>
      </aside>
    </>
  );
};

export default Navbar;
