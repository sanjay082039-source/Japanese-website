"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  HelpCircle,
  FileCheck2,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Send,
  Lock,
  RotateCcw,
  BookOpen,
  Award,
} from "lucide-react";

interface ViolationRecord {
  type: string;
  timestamp: string;
  details?: string;
}

export const DailyHomeworkWidget: React.FC = () => {
  const [homework, setHomework] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Proctoring Session States
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60); // 25 mins
  const [cheatCount, setCheatCount] = useState(0);
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const cheatCountRef = useRef(0);
  cheatCountRef.current = cheatCount;

  const playSecurityBeep = () => {
    try {
      if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  const loadHomework = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/student/daily-homework");
      if (res.ok) {
        const data = await res.json();
        setHomework(data.homework);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHomework();
  }, []);

  // Proctoring Event Listeners (Tab Switches, Window Blurs, Context Menu)
  const recordInfraction = useCallback((type: string, details: string) => {
    if (!isSessionActive) return;
    playSecurityBeep();

    setCheatCount((prev) => {
      const updated = prev + 1;
      setWarningMessage(`Proctoring Alert: ${details} (Warning ${updated}/3)`);
      setShowWarningModal(true);

      const record: ViolationRecord = {
        type,
        timestamp: new Date().toISOString(),
        details,
      };
      setViolations((v) => [...v, record]);

      if (updated >= 3) {
        // Auto-submit upon 3 infractions
        setTimeout(() => {
          handleAutoSubmit("Maximum proctoring infractions exceeded (3 warnings).");
        }, 1500);
      }

      return updated;
    });
  }, [isSessionActive]);

  useEffect(() => {
    if (!isSessionActive) return;

    // Fullscreen change listener
    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);
      if (!inFullscreen) {
        recordInfraction("FULLSCREEN_EXIT", "You exited fullscreen mode.");
      }
    };

    // Visibility change listener (Tab-switch interceptor)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordInfraction("TAB_SWITCH", "Tab switch or browser minimized detected.");
      }
    };

    // Window blur
    const handleWindowBlur = () => {
      recordInfraction("WINDOW_BLUR", "Focus shifted away from the test window.");
    };

    // Clipboard block
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      recordInfraction("CLIPBOARD_COPY", "Copy attempt prevented by proctoring guard.");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      recordInfraction("CLIPBOARD_PASTE", "Paste attempt prevented by proctoring guard.");
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isSessionActive, recordInfraction]);

  // Atomic Countdown Timer
  useEffect(() => {
    if (!isSessionActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit("Time limit expired (25:00).");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSessionActive]);

  const handleStartSession = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      // Fullscreen prompt ignored or unavailable
    }
    startTimeRef.current = Date.now();
    setCheatCount(0);
    setViolations([]);
    setRemainingSeconds(25 * 60);
    setCurrentIdx(0);
    setIsSessionActive(true);
  };

  const handleReEnterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {}
    setShowWarningModal(false);
  };

  const handleSelectAnswer = (qId: string, optIdx: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  };

  const handleAutoSubmit = async (reason: string) => {
    await submitHomeworkInternal(reason);
  };

  const handleSubmit = async () => {
    const answeredCount = Object.keys(selectedAnswers).length;
    const totalCount = homework?.questions?.length || 15;
    if (answeredCount < totalCount) {
      const confirmSubmit = window.confirm(
        `You have answered ${answeredCount} of ${totalCount} questions. Submit anyway?`
      );
      if (!confirmSubmit) return;
    }
    await submitHomeworkInternal();
  };

  const submitHomeworkInternal = async (disqualificationReason?: string) => {
    if (!homework || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg("");

    const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      const res = await fetch("/api/student/daily-homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: homework.id,
          answers: selectedAnswers,
          cheatCount: cheatCountRef.current,
          violations,
          timeSpentSeconds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to submit proctored homework.");
      } else {
        setSubmitResult(data);
        setIsSessionActive(false);

        // Exit fullscreen upon submission
        if (document.fullscreenElement && document.exitFullscreen) {
          try {
            await document.exitFullscreen();
          } catch {}
        }

        loadHomework(); // Reload with evaluated view
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-3xl text-center text-xs text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading personalized 15-question proctored practicum...
      </div>
    );
  }

  if (!homework) return null;

  const questions = homework.questions || [];
  const currentQ = questions[currentIdx] || questions[0];
  const totalAnswered = Object.keys(selectedAnswers).length;

  return (
    <div className="bg-gradient-to-br from-[#0c1a2d] to-slate-900 border border-[#296ec2]/40 rounded-3xl p-4 sm:p-7 shadow-2xl mb-8 select-none">
      {/* ============================================================== */}
      {/* 1. PRE-SESSION LOBBY (Before Starting Proctored Test)          */}
      {/* ============================================================== */}
      {!isSessionActive && !homework.isSubmitted && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#f06449]/20 border border-[#f06449]/40 flex items-center justify-center text-[#ff7c62] shadow-lg shadow-orange-950/40">
                <ShieldAlert className="w-6 h-6 text-[#ff7c62]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#f06449]/20 text-[#ff7c62] font-black border border-[#f06449]/40 font-mono">
                    PROCTORED PRACTICUM
                  </span>
                  <span className="text-xs text-blue-300 font-bold font-mono">
                    15 Questions • 30 Marks
                  </span>
                </div>
                <h3 className="font-extrabold text-lg text-white mt-1">
                  {homework.title}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5" /> Due Today (23:59)
              </span>
            </div>
          </div>

          {/* Security & Proctoring Rules Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-2 text-blue-400 font-bold">
                <Clock className="w-4 h-4" />
                <span>25-Minute Timed Hall</span>
              </div>
              <p className="text-[11px] text-slate-400">
                The session auto-submits once the 25-minute timer elapses. Manage your time efficiently across all 15 questions.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-2 text-orange-400 font-bold">
                <Maximize2 className="w-4 h-4" />
                <span>Mandatory Fullscreen</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Full-screen mode is required throughout the test. Exiting triggers warning alerts and records telemetry.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <Lock className="w-4 h-4" />
                <span>Anti-Cheat Guard</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Tab-switching, minimizing, copy/paste, and devtools are locked. 3 infractions trigger automatic submission.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-300 flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-white mb-0.5">Competency Coverage (15 Questions):</strong>
              Kanji Orthography (3), Vocabulary Collocations (3), Grammar & Conjugations (4), Particle Nuances (3), and Reading Comprehension (2).
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleStartSession}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#f06449] to-orange-500 hover:from-[#d9533a] hover:to-orange-600 text-white font-extrabold text-sm flex items-center gap-2 shadow-xl shadow-orange-950/50 transition-all hover:scale-105 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Enter Proctored Homework Session</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. ACTIVE PROCTORED TESTING ENVIRONMENT                        */}
      {/* ============================================================== */}
      {isSessionActive && currentQ && (
        <div
          className="space-y-6 select-none"
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onPaste={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Top Proctoring Security HUD */}
          <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-bold text-sm">
                <Clock className={`w-4 h-4 ${remainingSeconds < 180 ? "text-rose-400 animate-pulse" : "text-blue-400"}`} />
                <span className={remainingSeconds < 180 ? "text-rose-400" : "text-white"}>
                  {formatTimer(remainingSeconds)}
                </span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs">
                {cheatCount === 0 ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" /> Clean Session
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" /> {cheatCount}/3 Warnings
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">
                Answered: <strong className="text-orange-400 font-mono">{totalAnswered}</strong> / {questions.length}
              </span>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-950/40 transition-all cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>{isSubmitting ? "Submitting..." : "Submit Test"}</span>
              </button>
            </div>
          </div>

          {/* 15 Questions Navigation Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-white">Question Matrix (1 to 15)</span>
              <span className="text-[11px] font-mono">
                {Math.round((totalAnswered / questions.length) * 100)}% Complete
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {questions.map((q: any, idx: number) => {
                const isAnswered = selectedAnswers[q.id] !== undefined;
                const isCurrent = idx === currentIdx;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-8 h-8 rounded-xl font-mono text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-orange-500 text-slate-950 ring-2 ring-orange-300 scale-105"
                        : isAnswered
                        ? "bg-blue-600 text-white border border-blue-400"
                        : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Question Display Card */}
          <div className="p-6 rounded-3xl bg-slate-950/90 border border-slate-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-bold text-[10px] border border-blue-500/30">
                  {currentQ.category || `QUESTION ${currentIdx + 1}`}
                </span>
                <span className="text-slate-400 text-xs">
                  Problem {currentIdx + 1} of {questions.length}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-lg bg-orange-950 text-orange-300 font-mono font-bold text-xs border border-orange-800">
                {currentQ.marks || 2} Marks
              </span>
            </div>

            {/* Japanese Prompt */}
            <h4 className="text-base sm:text-lg font-bold text-white leading-relaxed pt-1">
              {currentQ.questionText}
            </h4>

            {/* 4 Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {currentQ.options.map((opt: string, oIdx: number) => {
                const isSelected = selectedAnswers[currentQ.id] === oIdx;

                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => handleSelectAnswer(currentQ.id, oIdx)}
                    className={`p-3.5 rounded-2xl text-left text-xs sm:text-sm font-medium border transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? "bg-[#f06449] border-[#f06449] text-white shadow-lg shadow-[#f06449]/30 scale-[1.01]"
                        : "bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-800/80"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-white text-orange-600" : "bg-slate-950 text-slate-400"
                      }`}
                    >
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    <span className="flex-1">{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Next / Prev Controls */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
              <button
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-950/40 transition-all cursor-pointer"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#f06449] hover:bg-[#d9533a] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-orange-950/40 transition-all cursor-pointer"
                >
                  <FileCheck2 className="w-4 h-4" />
                  {isSubmitting ? "Evaluating..." : "Finish & Submit"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. EVALUATED / SUBMITTED RESULT VIEW                           */}
      {/* ============================================================== */}
      {homework.isSubmitted && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  OFFICIALLY GRADED
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Submitted: {homework.submittedAt ? new Date(homework.submittedAt).toLocaleDateString() : "Today"}
                </span>
              </div>
              <h3 className="font-extrabold text-lg text-white mt-1">
                {homework.title}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-right">
                <span className="text-[10px] text-slate-400 block">Final Score</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  {homework.grade}%
                </span>
              </div>
            </div>
          </div>

          {/* Feedback & Integrity Summary */}
          {homework.feedback && (
            <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30 text-xs text-blue-200 flex items-start gap-3">
              <Award className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white mb-0.5">Faculty Evaluation:</strong>
                {homework.feedback}
              </div>
            </div>
          )}

          {/* Complete 15 Questions Review with Nuance Explanations */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Itemized 15-Question Performance Transcript
            </h4>

            {questions.map((q: any, idx: number) => {
              const studentAnswer = selectedAnswers[q.id];
              const isCorrect = studentAnswer !== undefined && studentAnswer === q.correctOption;

              return (
                <div
                  key={q.id}
                  className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-300 font-mono">
                      Q{idx + 1}. [{q.category || "GENERAL"}]
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {q.marks || 2} Marks
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-white">{q.questionText}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    {q.options.map((opt: string, oIdx: number) => {
                      const isOptionCorrect = q.correctOption === oIdx;
                      const wasSelected = studentAnswer === oIdx;

                      return (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-xl border flex items-center justify-between ${
                            isOptionCorrect
                              ? "bg-emerald-950/80 border-emerald-500 text-emerald-200 font-semibold"
                              : wasSelected
                              ? "bg-rose-950/80 border-rose-500 text-rose-200"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400 font-bold">
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <span>{opt}</span>
                          </div>

                          {isOptionCorrect && (
                            <span className="text-[10px] bg-emerald-900 px-1.5 py-0.5 rounded text-emerald-200 font-bold">
                              Correct
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 mt-2">
                      <strong className="text-emerald-400 font-bold block mb-0.5">Grammatical & Linguistic Analysis:</strong>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. PROCTORING SECURITY ALERT OVERLAY MODAL                     */}
      {/* ============================================================== */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <ShieldAlert className="w-6 h-6 text-rose-400 animate-pulse" />
            </div>

            <h3 className="text-base font-extrabold text-white">
              Proctoring Security Alert
            </h3>

            <p className="text-xs text-rose-300 font-medium leading-relaxed">
              {warningMessage}
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
              All window shifts and fullscreen exits are logged in your academic dossier. 3 total warnings trigger immediate session auto-submission.
            </div>

            <button
              onClick={handleReEnterFullscreen}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40 transition-all cursor-pointer"
            >
              Acknowledge & Return to Fullscreen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
