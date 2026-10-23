"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProctoringEngine } from "@/hooks/useProctoringEngine";
import {
  ShieldAlert,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Send,
  Lock,
} from "lucide-react";

interface ExamQuestionData {
  id: string;
  questionText: string;
  questionType: string;
  options: string[];
  marks: number;
  orderIndex: number;
}

interface ExamSessionData {
  attemptId: string;
  startedAt: string;
  serverTime: string;
  durationMinutes: number;
  remainingSeconds: number;
  proctoringRules?: {
    clipboardBlock: boolean;
    devtoolsBlock: boolean;
    tabSwitchLimit: number;
    fullScreenRequired: boolean;
    selectionBlock: boolean;
  };
  exam: {
    id: string;
    title: string;
    description: string;
    courseLevel: string;
    totalMarks: number;
    questions: ExamQuestionData[];
  };
}

export default function ExamRoomPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<ExamSessionData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examFinished, setExamFinished] = useState<{
    score: number;
    totalPossible: number;
    status: string;
  } | null>(null);
  const [showNavLockModal, setShowNavLockModal] = useState(false);
  const [hasEnteredOnce, setHasEnteredOnce] = useState(false);

  // Sound cues for security alerts
  const playAlertBeep = () => {
    try {
      if (typeof window !== "undefined" && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // AudioContext unavailable or blocked by autoplay policy
    }
  };

  // Submit Exam API Handler
  const handleFinalSubmit = useCallback(
    async (isAuto = false, isDisqual = false, reason = "") => {
      if (isSubmitting || examFinished) return;
      setIsSubmitting(true);

      try {
        const res = await fetch(`/api/exams/${examId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers,
            isAutoSubmit: isAuto,
            isDisqualified: isDisqual,
            reason,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setExamFinished({
            score: data.score,
            totalPossible: data.totalPossible,
            status: data.status,
          });
          // Safely exit fullscreen upon completion
          try {
            if (typeof document !== "undefined" && document.fullscreenElement) {
              const doc = document as unknown as { exitFullscreen?: () => Promise<void> };
              if (doc.exitFullscreen) {
                await doc.exitFullscreen();
              }
            }
          } catch {}
        } else {
          setErrorMessage(data.error || "Submission failed");
        }
      } catch (err) {
        setErrorMessage("Network error during exam submission");
      } finally {
        setIsSubmitting(false);
      }
    },
    [examId, answers, isSubmitting, examFinished]
  );

  // Hook up Proctoring Engine
  const {
    violationCount,
    lastWarning,
    isFullscreen,
    isDisqualified,
    infractionsRemaining,
    requestFullScreen,
    exitFullScreen,
    clearWarning,
  } = useProctoringEngine({
    examId,
    attemptId: sessionData?.attemptId,
    rules: sessionData?.proctoringRules || {
      clipboardBlock: true,
      devtoolsBlock: true,
      tabSwitchLimit: 3,
      fullScreenRequired: true,
      selectionBlock: true,
    },
    maxInfractions: sessionData?.proctoringRules?.tabSwitchLimit || 3,
    isActive: Boolean(sessionData && !examFinished),
    onViolation: () => {
      playAlertBeep();
    },
    onDisqualify: (reason) => {
      playAlertBeep();
      handleFinalSubmit(false, true, reason);
    },
    onAutoSubmit: (reason) => {
      handleFinalSubmit(true, false, reason);
    },
  });

  // Navigation Lockout Protocol during active examination
  useEffect(() => {
    if (!sessionData || examFinished || isDisqualified) return;

    // 1. Prevent tab close / page reload
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Examination in progress! Navigation is locked until you submit your examination.";
      return e.returnValue;
    };

    // 2. Trap browser back / forward buttons
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      setShowNavLockModal(true);
    };

    // 3. Intercept in-page links
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
        setShowNavLockModal(true);
      }
    };

    // 4. Intercept reload / navigation shortcuts
    const handleNavKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // F5 or Ctrl+R
      if (e.key === "F5" || (isCtrlOrCmd && key === "r")) {
        e.preventDefault();
        setShowNavLockModal(true);
        return;
      }
      // Alt + Left Arrow (Browser Back)
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "Left")) {
        e.preventDefault();
        setShowNavLockModal(true);
        return;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleGlobalClick, true);
    window.addEventListener("keydown", handleNavKeyDown, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleGlobalClick, true);
      window.removeEventListener("keydown", handleNavKeyDown, true);
    };
  }, [sessionData, examFinished, isDisqualified]);

  // Fetch or initialize attempt on mount
  useEffect(() => {
    async function initExam() {
      try {
        const res = await fetch(`/api/exams/${examId}/attempt`, {
          method: "POST",
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.attempt) {
            setExamFinished({
              score: data.attempt.score || 0,
              totalPossible: 50,
              status: data.attempt.status,
            });
          }
          setErrorMessage(data.error || "Unable to start examination.");
          setLoading(false);
          return;
        }

        setSessionData(data);
        setRemainingTime(data.remainingSeconds);
        setLoading(false);
      } catch (err) {
        setErrorMessage("Network error initializing examination.");
        setLoading(false);
      }
    }

    initExam();
  }, [examId]);

  // Server-Synchronized Hard Countdown Timer
  useEffect(() => {
    if (!sessionData || examFinished || isDisqualified) return;

    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit(true, false, "Allotted Examination Time Expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionData, examFinished, isDisqualified, handleFinalSubmit]);

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleSelectAnswer = (qId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: value,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-semibold text-sm">Initializing Secure Proctoring Environment...</p>
        <span className="text-xs text-slate-500 mt-1">Synchronizing Atomic Server Clock & Security Guard</span>
      </div>
    );
  }

  if (errorMessage && !sessionData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Examination Access Notice</h2>
          <p className="text-xs text-slate-400">{errorMessage}</p>
          <button
            onClick={() => router.push("/student/dashboard")}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Examination Finished Screen
  if (examFinished) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
              examFinished.status === "DISQUALIFIED"
                ? "bg-rose-500/20 text-rose-500"
                : "bg-emerald-500/20 text-emerald-400"
            }`}
          >
            {examFinished.status === "DISQUALIFIED" ? (
              <AlertTriangle className="w-8 h-8" />
            ) : (
              <CheckCircle2 className="w-8 h-8" />
            )}
          </div>

          <div>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-slate-800 text-slate-300">
              Status: {examFinished.status}
            </span>
            <h1 className="text-2xl font-black text-white mt-2">
              {examFinished.status === "DISQUALIFIED"
                ? "Examination Disqualified"
                : "Examination Submitted"}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {examFinished.status === "DISQUALIFIED"
                ? "Your attempt exceeded the maximum proctoring violation threshold. Answers invalidated."
                : "Your responses have been securely logged and evaluated on the platform server."}
            </p>
          </div>

          <div className="p-6 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2">
            <span className="text-xs text-slate-400 uppercase font-semibold">Provisional Score</span>
            <div className="text-4xl font-black text-white font-mono">
              {examFinished.score} <span className="text-lg text-slate-500">/ {examFinished.totalPossible}</span>
            </div>
            <p className="text-[11px] text-slate-500">
              MCQ questions evaluated instantly. Subjective answers pending instructor review.
            </p>
          </div>

          <button
            onClick={() => router.push("/student/exams")}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40"
          >
            Back to Examination Hall
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = sessionData?.exam.questions[currentQuestionIdx];
  const totalQuestions = sessionData?.exam.questions.length || 0;

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col select-none proctor-protected"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* MANDATORY FULLSCREEN ENFORCEMENT OVERLAY */}
      {!isFullscreen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-3 sm:p-6 select-none overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-rose-600/80 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-4 sm:space-y-6 text-center max-h-[92vh] overflow-y-auto">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-950/80 border border-rose-500 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
              {hasEnteredOnce ? (
                <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse text-amber-400" />
              ) : (
                <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-rose-400" />
              )}
            </div>

            <div>
              <span className="text-[10px] sm:text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-800">
                {hasEnteredOnce ? "⚠️ Fullscreen Mode Interrupted" : "Proctored Exam Verification"}
              </span>
              <h2 className="text-lg sm:text-2xl font-black text-white mt-2.5 sm:mt-3">
                {hasEnteredOnce ? "Fullscreen Mode Required" : "Enter Secure Exam Room"}
              </h2>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {hasEnteredOnce ? (
                  <>
                    You have exited Fullscreen mode. To maintain zero-tolerance academic integrity, you <strong className="text-rose-400">cannot proceed or view questions</strong> outside of Fullscreen mode.
                  </>
                ) : (
                  <>
                    You are about to begin <strong className="text-white">{sessionData?.exam.title}</strong> (JLPT {sessionData?.exam.courseLevel}). This examination requires mandatory Fullscreen mode and navigation locking.
                  </>
                )}
              </p>
            </div>

            {/* Protocol highlights */}
            <div className="p-3.5 sm:p-4 bg-slate-950/80 rounded-2xl border border-slate-800 text-left text-xs text-slate-300 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-[10px] sm:text-[11px] uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Strict Examination Protocols:</span>
              </div>
              <ul className="text-[10px] sm:text-[11px] text-slate-400 space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-200">Fullscreen Locked:</strong> Exiting fullscreen logs an academic infraction strike.</li>
                <li><strong className="text-slate-200">Navigation Blocked:</strong> Back/Forward, Tab closing, and Reload are locked until submission.</li>
                <li><strong className="text-slate-200">Evaluation:</strong> Responses are securely evaluated and submitted upon completion.</li>
              </ul>
            </div>

            <button
              onClick={async () => {
                await requestFullScreen();
                setHasEnteredOnce(true);
              }}
              className="w-full py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs sm:text-sm tracking-wide shadow-xl shadow-rose-950/60 flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:scale-[1.01]"
            >
              <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
              {hasEnteredOnce ? "Restore Fullscreen Mode & Resume" : "Enter Fullscreen Mode & Begin Exam"}
            </button>
          </div>
        </div>
      )}

      {/* NAVIGATION LOCKED POPUP MODAL */}
      {showNavLockModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-rose-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-600 text-rose-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Navigation Strictly Locked</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are currently taking an official examination. In accordance with zero-tolerance academic integrity rules, you <strong className="text-rose-400">cannot navigate away, reload, or exit</strong> until you have completed and submitted your examination.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              Please finish answering the questions and click <strong>&quot;Submit Examination&quot;</strong> to unlock navigation.
            </div>
            <button
              onClick={() => setShowNavLockModal(false)}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/50 cursor-pointer"
            >
              Return to My Examination
            </button>
          </div>
        </div>
      )}

      {/* Top Security & Countdown Navigation Bar */}
      <header className="sticky top-0 z-50 bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-4 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden border border-slate-700 shrink-0 bg-slate-900">
            <img
              src="/logo.png"
              alt="RIT Japanese Portal Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 proctor-active-pulse shrink-0"></span>
            <span className="text-[11px] sm:text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
              <ShieldAlert className="w-3.5 h-3.5" />
              Proctor Engine Active
            </span>
          </div>

          <span className="hidden md:inline text-xs text-slate-500">|</span>
          <span className="hidden md:inline text-xs font-semibold text-slate-300 truncate max-w-[200px]">
            {sessionData?.exam.title} ({sessionData?.exam.courseLevel})
          </span>
        </div>

        {/* Countdown Timer with Hard Server Sync */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border font-mono font-bold text-xs sm:text-sm ${
              remainingTime <= 300
                ? "bg-rose-950/70 border-rose-500 text-rose-300 animate-pulse"
                : "bg-slate-950 border-slate-800 text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
            <span>{formatRemaining(remainingTime)}</span>
          </div>

          {/* Fullscreen Enforcer Button */}
          {!isFullscreen && (
            <button
              onClick={requestFullScreen}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] sm:text-xs font-bold hover:bg-amber-500/30 transition-colors animate-bounce"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Lock </span>Fullscreen
            </button>
          )}

          {/* Infraction Counter Badge */}
          <div
            className={`px-2.5 sm:px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold border font-mono ${
              violationCount > 0
                ? "bg-rose-950 text-rose-300 border-rose-700"
                : "bg-slate-950 text-slate-400 border-slate-800"
            }`}
          >
            <span className="hidden xs:inline">Strikes: </span>{violationCount}/3
          </div>
        </div>
      </header>

      {/* Violation Alert Banner */}
      {lastWarning && (
        <div className="bg-rose-600 text-white px-4 py-3 flex items-center justify-between text-xs font-bold shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>SECURITY WARNING: {lastWarning} (Infractions remaining: {infractionsRemaining})</span>
          </div>
          <button
            onClick={clearWarning}
            className="px-2 py-0.5 rounded bg-black/40 hover:bg-black/60 text-[10px] uppercase font-mono"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Main Examination Hall Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 Columns: Active Question Editor */}
        <div className="lg:col-span-3 flex flex-col justify-between bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {currentQuestion ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-400 font-bold border border-rose-500/30">
                    Question {currentQuestionIdx + 1} of {totalQuestions}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    [{currentQuestion.questionType}]
                  </span>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-300">
                  Worth: {currentQuestion.marks} Marks
                </span>
              </div>

              {/* Question Text */}
              <div className="space-y-2">
                <h2 className="text-base sm:text-lg font-bold text-white leading-relaxed">
                  {currentQuestion.questionText}
                </h2>
              </div>

              {/* Options or Textarea */}
              {currentQuestion.questionType === "MCQ" ? (
                <div className="space-y-3 pt-2">
                  {currentQuestion.options.map((opt, optIdx) => {
                    const isSelected = answers[currentQuestion.id] === String(optIdx);
                    return (
                      <label
                        key={optIdx}
                        onClick={() => handleSelectAnswer(currentQuestion.id, String(optIdx))}
                        className={`w-full p-4 rounded-2xl border text-sm flex items-center gap-4 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-rose-950/40 border-rose-500 text-white shadow-lg shadow-rose-950/50"
                            : "bg-slate-950/70 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-rose-500 bg-rose-600 text-white"
                              : "border-slate-600"
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-white"></span>}
                        </div>
                        <span className="font-medium text-sm leading-normal">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <label className="text-xs text-slate-400 block font-semibold">
                    Type your Japanese answer / sentence explanation below:
                  </label>
                  <textarea
                    rows={6}
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => handleSelectAnswer(currentQuestion.id, e.target.value)}
                    placeholder="Type your response here..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                  ></textarea>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">No question data loaded.</div>
          )}

          {/* Question Navigation Controls */}
          <div className="pt-8 border-t border-slate-800 flex items-center justify-between gap-4 mt-8">
            <button
              onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
              disabled={currentQuestionIdx === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>

            <span className="text-xs text-slate-400 font-mono">
              Answered: {Object.keys(answers).length} / {totalQuestions}
            </span>

            {currentQuestionIdx < totalQuestions - 1 ? (
              <button
                onClick={() => setCurrentQuestionIdx((p) => Math.min(totalQuestions - 1, p + 1))}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-950/40"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleFinalSubmit(false, false, "Manual submission by candidate")}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-950/40"
              >
                <Send className="w-4 h-4" /> {isSubmitting ? "Submitting..." : "Submit Examination"}
              </button>
            )}
          </div>
        </div>

        {/* Right 1 Column: Question Grid Palette & Integrity Status */}
        <div className="space-y-6">
          {/* Question Palette */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Question Navigator
            </h3>

            <div className="grid grid-cols-5 gap-2">
              {sessionData?.exam.questions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== "";
                const isCurrent = idx === currentQuestionIdx;

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={`h-10 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center ${
                      isCurrent
                        ? "ring-2 ring-rose-500 bg-rose-600 text-white"
                        : isAnswered
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : "bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-600"></span> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-700"></span> Pending
              </span>
            </div>
          </div>

          {/* Anti-Cheat Shield Diagnostics */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Security Telemetry
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Clipboard Lock:</span>
                <span className="text-emerald-400 font-mono">ENGAGED</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">Text Selection:</span>
                <span className="text-emerald-400 font-mono">BLOCKED</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-800">
                <span className="text-slate-400">DevTools Shortcut:</span>
                <span className="text-emerald-400 font-mono">INTERCEPTED</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-400">Window Visibility:</span>
                <span className="text-emerald-400 font-mono">MONITORED</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button
                onClick={() => handleFinalSubmit(false, false, "Manual candidate submit")}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40"
              >
                Finish & Submit Exam
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
