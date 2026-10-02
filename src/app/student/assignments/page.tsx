"use client";

import React, { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/navigation/Navbar";
import { UserSession, FormAssignmentData, FormQuestion } from "@/lib/types";
import {
  FileCheck,
  Calendar,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
  Lock,
  Unlock,
  Award,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Layers,
  X,
  Maximize2,
} from "lucide-react";

interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  courseLevel: string;
  dueDate: string;
  maxMarks: number;
  isGoogleForm?: boolean;
  formData?: FormAssignmentData | null;
  submissions: {
    id: string;
    content: string;
    fileUrl?: string | null;
    submittedAt: string;
    grade?: number | null;
    feedback?: string | null;
    status: string;
  }[];
}

export default function StudentAssignmentsPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Secure Assignment State
  const [activeAssignment, setActiveAssignment] = useState<AssignmentItem | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenRequiredModal, setShowFullscreenRequiredModal] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [submissionResult, setSubmissionResult] = useState<{
    score: number;
    maxMarks: number;
    submissionId: string;
  } | null>(null);

  // Security Toast & Navigation Lock Alert State
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);
  const [showNavLockModal, setShowNavLockModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Standard legacy assignment state
  const [legacyModalAssign, setLegacyModalAssign] = useState<AssignmentItem | null>(null);
  const [legacyContent, setLegacyContent] = useState("");

  useEffect(() => {
    fetchProfileAndAssignments();
  }, []);

  const fetchProfileAndAssignments = async () => {
    try {
      const userRes = await fetch("/api/auth/me");
      const userData = await userRes.json();
      if (!userData.user) {
        window.location.href = "/login";
        return;
      }
      setUser(userData.user);

      const assignRes = await fetch("/api/assignments");
      const assignData = await assignRes.json();
      setAssignments(assignData.assignments || []);
    } catch (err) {
      console.error("Failed to load assignments:", err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger temporary security warning toast
  const triggerSecurityWarning = useCallback((msg: string) => {
    setSecurityAlert(msg);
    setTimeout(() => {
      setSecurityAlert(null);
    }, 3500);
  }, []);

  // =========================================================================
  // ZERO-TOLERANCE ANTI-CHEAT & NAVIGATION LOCK EFFECT
  // =========================================================================
  useEffect(() => {
    if (!isStarted || isSubmitted) return;

    // 1. Intercept Clipboard & Context Menu
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerSecurityWarning("⚠️ Action Blocked: Copying question content is prohibited.");
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerSecurityWarning("⚠️ Action Blocked: Cutting content is prohibited.");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      triggerSecurityWarning("⚠️ Action Blocked: Pasting into the assignment is prohibited.");
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerSecurityWarning("⚠️ Right-Click Disabled: Context menu is locked during the assignment.");
    };

    // 2. Intercept DevTools & Copy/Paste Keyboard Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // F12 or Ctrl+Shift+I / J
      if (e.key === "F12" || (isCtrlOrCmd && e.shiftKey && (key === "i" || key === "j" || key === "c"))) {
        e.preventDefault();
        triggerSecurityWarning("⚠️ Developer Tools shortcuts are blocked.");
        return;
      }

      // Reload shortcuts: F5, Ctrl+R
      if (e.key === "F5" || (isCtrlOrCmd && key === "r")) {
        e.preventDefault();
        setShowNavLockModal(true);
        return;
      }

      // Alt+Left Arrow (Browser Back)
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "Left")) {
        e.preventDefault();
        setShowNavLockModal(true);
        return;
      }

      // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U
      if (isCtrlOrCmd && (key === "c" || key === "v" || key === "x" || key === "u")) {
        e.preventDefault();
        triggerSecurityWarning(`⚠️ Shortcut (Ctrl+${key.toUpperCase()}) is blocked during this assignment.`);
        return;
      }
    };

    // 3. Prevent Unload / Tab Close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Assignment in progress! Navigation is locked until you submit your answers.";
      return e.returnValue;
    };

    // 4. Trap Browser Back / Forward buttons with popstate
    window.history.pushState(null, "", window.location.href);
    const handlePopState = (e: PopStateEvent) => {
      window.history.pushState(null, "", window.location.href);
      setShowNavLockModal(true);
    };

    // 5. Intercept in-page Link Clicks
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
        setShowNavLockModal(true);
      }
    };

    // Attach listeners
    window.addEventListener("copy", handleCopy);
    window.addEventListener("cut", handleCut);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleGlobalClick, true);

    return () => {
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("cut", handleCut);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleGlobalClick, true);
    };
  }, [isStarted, isSubmitted, triggerSecurityWarning]);

  // Fullscreen State Tracker during Assignment
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = typeof document !== "undefined" ? (document as unknown as {
        fullscreenElement?: Element;
        webkitFullscreenElement?: Element;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
      }) : {};
      const inFullscreen = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(inFullscreen);
      if (isStarted && !isSubmitted && !inFullscreen) {
        setShowFullscreenRequiredModal(true);
        triggerSecurityWarning("⚠️ Fullscreen Mode Exited: Fullscreen is mandatory until submission.");
      } else if (inFullscreen) {
        setShowFullscreenRequiredModal(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, [isStarted, isSubmitted, triggerSecurityWarning]);

  // Open Google Form Assignment
  const handleOpenGoogleForm = (assign: AssignmentItem) => {
    setActiveAssignment(assign);
    setIsStarted(false);
    setIsSubmitted(false);
    setIsFullscreen(false);
    setShowFullscreenRequiredModal(false);
    setSelectedAnswers({});
    setSubmissionResult(null);
    setSecurityAlert(null);
  };

  // Begin Secure Assignment
  const handleStartSecureAssignment = async () => {
    try {
      if (typeof document !== "undefined" && document.documentElement && !document.fullscreenElement) {
        const el = document.documentElement as unknown as {
          requestFullscreen?: () => Promise<void>;
          webkitRequestFullscreen?: () => Promise<void>;
          msRequestFullscreen?: () => Promise<void>;
        };
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
          await el.msRequestFullscreen();
        }
        setIsFullscreen(true);
      }
    } catch (e) {
      console.warn("Fullscreen request error:", e);
    }
    setIsStarted(true);
    setIsSubmitted(false);
    // Push history state to lock back button
    window.history.pushState(null, "", window.location.href);
  };

  // Select Option for a Question
  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (!isStarted || isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  // Submit Google Form Answers
  const handleSubmitForm = async () => {
    if (!activeAssignment || submitting) return;

    const questions = activeAssignment.formData?.questions || [];
    const answeredCount = Object.keys(selectedAnswers).length;

    if (answeredCount < questions.length) {
      const confirmIncomplete = window.confirm(
        `You have answered ${answeredCount} of ${questions.length} questions. Unanswered questions will receive 0 marks. Submit now?`
      );
      if (!confirmIncomplete) return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: activeAssignment.id,
          answers: selectedAnswers,
          content: `Google Form Submission: ${answeredCount}/${questions.length} questions attempted.`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsSubmitted(true);
        setShowFullscreenRequiredModal(false);
        try {
          if (typeof document !== "undefined" && document.fullscreenElement) {
            const doc = document as unknown as { exitFullscreen?: () => Promise<void> };
            if (doc.exitFullscreen) {
              await doc.exitFullscreen();
            }
          }
        } catch (e) {}
        setSubmissionResult({
          score: data.grade !== undefined && data.grade !== null ? data.grade : 0,
          maxMarks: data.maxMarks || activeAssignment.maxMarks,
          submissionId: data.submission?.id || "",
        });
        fetchProfileAndAssignments();
      } else {
        alert(data.error || "Submission error.");
      }
    } catch (err) {
      console.error("Failed to submit assignment:", err);
      alert("Network error while submitting.");
    } finally {
      setSubmitting(false);
    }
  };

  // Legacy Text Assignment Submission
  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legacyModalAssign || !legacyContent.trim()) return;

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: legacyModalAssign.id,
          content: legacyContent,
        }),
      });
      if (res.ok) {
        setLegacyModalAssign(null);
        setLegacyContent("");
        fetchProfileAndAssignments();
      } else {
        alert("Failed to submit");
      }
    } catch (e) {
      console.error(e);
      alert("Error submitting");
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center text-slate-400">
        Loading assignments registry...
      </div>
    );
  }

  // =========================================================================
  // VIEW: ACTIVE GOOGLE FORM SECURE ASSIGNMENT ROOM
  // =========================================================================
  if (activeAssignment && activeAssignment.formData) {
    const questions = activeAssignment.formData.questions || [];
    const answeredCount = Object.keys(selectedAnswers).length;
    const progressPct = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

    return (
      <div className="min-h-screen bg-[#070D18] text-slate-100 select-none pb-24">
        {/* Top Sticky Proctoring & Navigation Lock Banner */}
        <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3 shadow-xl">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
                {isSubmitted ? <Unlock className="w-5 h-5 text-emerald-400" /> : <Lock className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm sm:text-base text-white tracking-tight">
                    {activeAssignment.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800">
                    JLPT {activeAssignment.courseLevel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {isSubmitted ? (
                    <span className="text-emerald-400 font-semibold">
                      Assignment Completed • Navigation Unlocked
                    </span>
                  ) : isStarted ? (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Navigation Locked Until Submission • Copy/Paste Disabled
                    </span>
                  ) : (
                    "Ready to Begin Secure Practicum"
                  )}
                </p>
              </div>
            </div>

            {/* Status or Progress */}
            {isStarted && !isSubmitted && (
              <div className="flex items-center gap-4">
                {!isFullscreen && (
                  <button
                    onClick={async () => {
                      try {
                        const el = document.documentElement as unknown as {
                          requestFullscreen?: () => Promise<void>;
                        };
                        if (el.requestFullscreen) {
                          await el.requestFullscreen();
                        }
                      } catch (e) {}
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-colors animate-bounce cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Lock Fullscreen
                  </button>
                )}
                <div className="text-right text-xs">
                  <span className="text-slate-400 block text-[10px]">Progress</span>
                  <span className="font-mono font-bold text-orange-400">
                    {answeredCount} / {questions.length} Answered
                  </span>
                </div>
                <div className="w-28 bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-orange-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
              </div>
            )}

            {isSubmitted && (
              <button
                onClick={() => setActiveAssignment(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                ← Return to Assignments
              </button>
            )}
          </div>
        </header>

        {/* Floating Security Warning Toast */}
        {securityAlert && (
          <div className="fixed top-20 right-4 z-50 max-w-sm p-4 rounded-2xl bg-rose-950/90 border border-rose-600 text-rose-200 text-xs shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{securityAlert}</span>
          </div>
        )}

        {/* Navigation Locked Alert Modal */}
        {showNavLockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="w-full max-w-md bg-slate-900 border border-rose-800/80 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-600 text-rose-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-white">
                Navigation Strictly Locked
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed">
                You have started this assignment. In accordance with zero-tolerance academic integrity rules, you{" "}
                <strong className="text-rose-400">cannot navigate away or exit</strong> until you have completed and submitted your answers.
              </p>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                Please complete the questions and click <strong>&quot;Submit Assignment&quot;</strong> below to unlock navigation.
              </div>

              <button
                onClick={() => setShowNavLockModal(false)}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 cursor-pointer"
              >
                Return to My Assignment
              </button>
            </div>
          </div>
        )}

        {/* Fullscreen Required Modal */}
        {showFullscreenRequiredModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="w-full max-w-md bg-slate-900 border border-amber-500/80 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-950/80 border border-amber-500 text-amber-400 flex items-center justify-center mx-auto">
                <Maximize2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-white">
                Fullscreen Mode Required
              </h3>

              <p className="text-xs text-slate-300 leading-relaxed">
                You have exited fullscreen mode. In accordance with platform integrity rules, this assignment must be completed within Fullscreen mode. Navigation remains locked until submission.
              </p>

              <button
                onClick={async () => {
                  try {
                    const el = document.documentElement as unknown as {
                      requestFullscreen?: () => Promise<void>;
                      webkitRequestFullscreen?: () => Promise<void>;
                      msRequestFullscreen?: () => Promise<void>;
                    };
                    if (el.requestFullscreen) {
                      await el.requestFullscreen();
                    } else if (el.webkitRequestFullscreen) {
                      await el.webkitRequestFullscreen();
                    } else if (el.msRequestFullscreen) {
                      await el.msRequestFullscreen();
                    }
                  } catch (e) {
                    console.error("Fullscreen restoration failed:", e);
                  }
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-orange-950/50 cursor-pointer flex items-center justify-center gap-2"
              >
                <Maximize2 className="w-4 h-4" />
                Restore Fullscreen Mode
              </button>
            </div>
          </div>
        )}

        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
          {/* STEP 1: PRE-FLIGHT VERIFICATION & START */}
          {!isStarted && !isSubmitted && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div className="p-3 rounded-2xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">
                    Secure Assignment Practicum
                  </h2>
                  <p className="text-xs text-slate-400">
                    Target JLPT Level: {activeAssignment.courseLevel} | Total Marks: {activeAssignment.maxMarks}
                  </p>
                </div>

              </div>

              {/* Instructions */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-2">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Assignment Guidelines:
                </h4>
                <p className="leading-relaxed">
                  {activeAssignment.formData.instructions || activeAssignment.description}
                </p>
              </div>

              {/* Mandatory Security Rules */}
              <div className="p-5 bg-rose-950/20 border border-rose-900/60 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>MANDATORY ACADEMIC SECURITY & NAVIGATION LOCKOUT:</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
                  <li>
                    <strong className="text-white">Fullscreen Enforced:</strong> Starting this assignment activates Fullscreen mode. Exiting fullscreen is restricted.
                  </li>
                  <li>
                    <strong className="text-white">Navigation Lock:</strong> Once started, you cannot leave, reload, or navigate away from this page until submission.
                  </li>
                  <li>
                    <strong className="text-white">Anti-Copy & Selection:</strong> Copying, cutting, or pasting question content is strictly intercepted and blocked.
                  </li>
                  <li>
                    <strong className="text-white">Context Menu & Shortcuts:</strong> Right-click menu and developer keyboard shortcuts are disabled.
                  </li>
                  <li>
                    <strong className="text-white">Unlocked on Completion:</strong> Navigation unlocks automatically after submitting your answers.
                  </li>
                </ul>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  onClick={() => setActiveAssignment(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 cursor-pointer"
                >
                  Cancel & Return
                </button>

                <button
                  onClick={handleStartSecureAssignment}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-xl shadow-orange-950/60 cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                  Enter Fullscreen & Begin Assignment
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ACTIVE QUESTIONNAIRE */}
          {isStarted && !isSubmitted && (
            <div className="space-y-6">
              {/* Question Cards */}
              {questions.map((q, idx) => {
                const isAnswered = selectedAnswers[q.id] !== undefined;

                return (
                  <div
                    key={q.id || idx}
                    className={`bg-slate-900 border rounded-3xl p-6 sm:p-7 shadow-xl space-y-4 transition-all ${
                      isAnswered ? "border-slate-700 bg-slate-900/95" : "border-slate-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          Question {idx + 1} of {questions.length}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-orange-950 text-orange-300 font-mono font-bold text-xs border border-orange-800">
                          {q.marks} {q.marks === 1 ? "Mark" : "Marks"}
                        </span>
                        {isAnswered && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Answered
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <div className="text-sm sm:text-base font-semibold text-white leading-relaxed select-none">
                      {q.questionText}
                    </div>

                    {/* Options (Radio selection) */}
                    <div className="space-y-2.5 pt-2">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = selectedAnswers[q.id] === optIdx;

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handleSelectOption(q.id, optIdx)}
                            className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer ${
                              isSelected
                                ? "bg-orange-600/20 border-orange-500 text-white shadow-md shadow-orange-950/30"
                                : "bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-colors ${
                                isSelected
                                  ? "bg-orange-500 text-white"
                                  : "bg-slate-900 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span className="text-xs sm:text-sm select-none flex-1">
                              {opt}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Submit Action Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white">Ready to Finish?</h4>
                  <p className="text-xs text-slate-400">
                    {answeredCount} of {questions.length} questions completed. Once submitted, your score will be calculated and navigation will unlock.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSubmitForm}
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs shadow-xl shadow-orange-950/50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? "Grading & Submitting..." : "Submit Assignment"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SUBMITTED SUCCESS & SCORE SUMMARY */}
          {isSubmitted && submissionResult && (
            <div className="bg-slate-900 border border-emerald-800/80 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-600 flex items-center justify-center mx-auto shadow-xl">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Submission Verified & Recorded
                </span>
                <h2 className="text-2xl font-black text-white mt-3">
                  Assignment Submitted Successfully!
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Your responses have been archived and your score has been recorded in the platform registry.
                </p>
              </div>

              {/* Score Display */}
              <div className="max-w-xs mx-auto p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Earned Score
                </span>
                <div className="text-4xl font-black text-emerald-400 font-mono">
                  {submissionResult.score} <span className="text-xl text-slate-500">/ {submissionResult.maxMarks}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Score percentage: {Math.round((submissionResult.score / submissionResult.maxMarks) * 100)}%
                </p>
              </div>

              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800/80 max-w-md mx-auto text-xs text-slate-300">
                <strong className="text-emerald-400 block mb-1">
                  🔓 Navigation is Now Unlocked
                </strong>
                You may now browse other sections, view your attendance, or check your schedule.
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  onClick={() => setActiveAssignment(null)}
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-lg shadow-orange-950/40 cursor-pointer"
                >
                  Return to Assignments Dashboard
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN ASSIGNMENTS DIRECTORY FOR STUDENTS
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#070D18] pb-16 text-slate-100">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold border border-orange-500/30">
              課題・Course Assignments
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Course Practicums & Assignments
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Access your JLPT {user.courseLevel} assignments, submit responses, and view evaluated marks.
          </p>
        </div>


        {/* Assignments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {assignments.length === 0 ? (
            <div className="col-span-2 p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl">
              <FileCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No assignments assigned</h3>
              <p className="text-xs text-slate-400 mt-1">
                You are all caught up! New homework exercises for JLPT {user.courseLevel} will appear here.
              </p>
            </div>
          ) : (
            assignments.map((assign) => {
              const submission = assign.submissions[0];
              const isDuePassed = new Date() > new Date(assign.dueDate);
              const isGoogleForm = assign.isGoogleForm && assign.formData;

              return (
                <div
                  key={assign.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all space-y-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-orange-950 text-orange-400 border border-orange-800 font-mono">
                          {assign.courseLevel}
                        </span>
                        {isGoogleForm && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-semibold">
                            Interactive MCQ
                          </span>
                        )}

                      </div>

                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          submission
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : isDuePassed
                            ? "bg-rose-950 text-rose-300 border border-rose-800"
                            : "bg-amber-950 text-amber-300 border border-amber-800"
                        }`}
                      >
                        {submission ? "Submitted" : isDuePassed ? "Overdue" : "Pending"}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">{assign.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line line-clamp-3">
                      {isGoogleForm && assign.formData?.instructions
                        ? assign.formData.instructions
                        : assign.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-orange-400" />
                        Due: {new Date(assign.dueDate).toLocaleDateString()}
                      </span>
                      <span className="font-mono text-orange-400 font-bold">
                        {assign.maxMarks} Marks
                      </span>
                    </div>

                    {submission && (
                      <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between text-emerald-400 font-semibold">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Submitted: {new Date(submission.submittedAt).toLocaleDateString()}
                          </span>
                          {submission.grade !== null && (
                            <span className="font-mono bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                              Score: {submission.grade}/{assign.maxMarks}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    {isGoogleForm ? (
                      <button
                        onClick={() => handleOpenGoogleForm(assign)}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          submission
                            ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                            : "bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-950/40"
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {submission ? "Review Submitted Assignment" : "Start Assignment"}
                      </button>

                    ) : (
                      <button
                        onClick={() => {
                          setLegacyModalAssign(assign);
                          setLegacyContent(submission?.content || "");
                        }}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FileCheck className="w-4 h-4 text-orange-400" />
                        {submission ? "Review / Resubmit Paper" : "Draft & Submit Response"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Legacy modal */}
        {legacyModalAssign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-orange-400" />
                  {legacyModalAssign.title}
                </h3>
                <button
                  onClick={() => setLegacyModalAssign(null)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleLegacySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Your Written Response (Composition / Translation)
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={legacyContent}
                    onChange={(e) => setLegacyContent(e.target.value)}
                    placeholder="Enter your essay or responses..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:border-orange-500 outline-none font-mono"
                  ></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setLegacyModalAssign(null)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs"
                  >
                    Submit Response
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
