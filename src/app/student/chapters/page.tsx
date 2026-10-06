"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/navigation/Navbar";
import { UserSession } from "@/lib/types";
import {
  Video,
  BookOpen,
  Lock,
  CheckCircle2,
  Play,
  FileText,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface ChapterItem {
  id: string;
  title: string;
  description?: string;
  courseLevel: string;
  chapterNumber: number;
  videoUrl: string;
  durationSeconds: number;
  notesContent: string;
  resources: Array<{ name: string; url: string }>;
  quizQuestions: Array<{
    id: string;
    questionText: string;
    options: string[];
    correctOption: number;
    explanation?: string;
  }>;
  watchPercentage: number;
  videoCompleted: boolean;
  quizSubmitted: boolean;
  quizScore: number | null;
}

export default function StudentChaptersPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<ChapterItem | null>(null);
  const [watchProgress, setWatchProgress] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const authRes = await fetch("/api/auth/me");
        if (authRes.ok) {
          const authData = await authRes.json();
          setUser(authData.user);
        }

        const chRes = await fetch("/api/chapters");
        if (chRes.ok) {
          const chData = await chRes.json();
          setChapters(chData.chapters);
          if (chData.chapters.length > 0) {
            setSelectedChapter(chData.chapters[0]);
            setWatchProgress(chData.chapters[0].watchPercentage);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadData();
  }, []);

  // Update watch progress on the server
  const handleSimulateWatch = async (targetPct: number) => {
    if (!selectedChapter) return;
    try {
      const res = await fetch("/api/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_VIDEO_PROGRESS",
          chapterId: selectedChapter.id,
          watchPercentage: targetPct,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setWatchProgress(data.watchPercentage);
        setSelectedChapter((prev) =>
          prev
            ? {
                ...prev,
                watchPercentage: data.watchPercentage,
                videoCompleted: data.videoCompleted,
              }
            : null
        );
        // Refresh chapter list item
        setChapters((prev) =>
          prev.map((c) =>
            c.id === selectedChapter.id
              ? { ...c, watchPercentage: data.watchPercentage, videoCompleted: data.videoCompleted }
              : c
          )
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAnswer = (qId: string, optIdx: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optIdx }));
  };

  const handleSubmitQuiz = async () => {
    if (!selectedChapter) return;
    setIsSubmittingQuiz(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT_CHAPTER_QUIZ",
          chapterId: selectedChapter.id,
          answers: selectedAnswers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to submit quiz.");
      } else {
        setQuizResult({ score: data.score, message: data.message });
        setSelectedChapter((prev) =>
          prev ? { ...prev, quizSubmitted: true, quizScore: data.score } : null
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error.");
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#081220] text-slate-100 pb-16">
      {user && <Navbar user={user} />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#296ec2]/20 text-[#93c5fd] font-semibold border border-[#296ec2]/30 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" />
                Lecture Completion Gates
              </span>
              {user && (
                <span className="text-xs text-slate-400 font-mono">
                  JLPT {user.courseLevel} Curriculum
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Curriculum Notes & Gated Video Practicums
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Watch complete video lectures to 100% completion to unlock chapter comprehension quizzes and earn certified marks.
            </p>
          </div>
        </div>

        {/* Two-Column Grid: Left Chapters List, Right Active Unit */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Chapters Directory (1 Col) */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Course Chapters
            </h2>

            {chapters.length === 0 ? (
              <div className="p-4 bg-slate-900/60 border border-white/10 rounded-2xl text-xs text-slate-500 text-center">
                No chapters published for JLPT {user?.courseLevel} yet.
              </div>
            ) : (
              chapters.map((ch) => {
                const isSelected = selectedChapter?.id === ch.id;
                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setSelectedChapter(ch);
                      setWatchProgress(ch.watchPercentage);
                      setSelectedAnswers({});
                      setQuizResult(null);
                      setErrorMsg("");
                    }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#296ec2]/20 border-[#296ec2]/60 text-white shadow-lg shadow-[#081220]/60"
                        : "bg-slate-900/60 border-white/10 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="font-mono font-bold text-[#ff7c62]">
                        Unit {ch.chapterNumber}
                      </span>
                      {ch.videoCompleted ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 100%
                        </span>
                      ) : (
                        <span className="font-mono">{ch.watchPercentage}% watched</span>
                      )}
                    </div>
                    <div className="font-bold text-sm text-white line-clamp-1">{ch.title}</div>
                    <div className="mt-2 w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${ch.videoCompleted ? "bg-emerald-500" : "bg-[#f06449]"}`}
                        style={{ width: `${ch.watchPercentage}%` }}
                      ></div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Player, Notes & Gated Quiz (3 Cols) */}
          <div className="lg:col-span-3 space-y-8">
            {selectedChapter ? (
              <>
                {/* 1. Video Player Container */}
                <div className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
                  <div className="aspect-video w-full bg-slate-950 relative flex items-center justify-center border-b border-white/10">
                    {/* Simulated/Embed Video Player */}
                    <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-950 via-[#0b1a2d] to-slate-950">
                      <div className="w-16 h-16 rounded-full bg-[#f06449]/20 border border-[#f06449]/50 flex items-center justify-center text-[#ff7c62] mb-3 shadow-lg">
                        <Play className="w-8 h-8 translate-x-0.5" />
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                        {selectedChapter.title}
                      </h3>
                      <p className="text-xs text-slate-400 max-w-md">
                        {selectedChapter.description || "Official RIT Japanese Video Lecture."}
                      </p>

                      {/* Video Player Progress Simulator Controls */}
                      <div className="mt-6 w-full max-w-md bg-slate-900/90 border border-white/10 rounded-2xl p-4 shadow-xl">
                        <div className="flex items-center justify-between text-xs font-semibold mb-2">
                          <span className="text-slate-300">Watch Completion Gate</span>
                          <span
                            className={`font-mono font-bold ${
                              watchProgress >= 100 ? "text-emerald-400" : "text-[#ff7c62]"
                            }`}
                          >
                            {watchProgress}% / 100%
                          </span>
                        </div>
                        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-white/5 mb-3">
                          <div
                            className={`h-full transition-all duration-300 ${
                              watchProgress >= 100 ? "bg-emerald-500" : "bg-[#f06449]"
                            }`}
                            style={{ width: `${watchProgress}%` }}
                          ></div>
                        </div>

                        {/* Scrub / Progress controls */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-500">
                            Anti-skip active: complete video to unlock quiz
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleSimulateWatch(Math.min(100, watchProgress + 25))}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 border border-white/10 transition-colors cursor-pointer"
                            >
                              +25% Watch
                            </button>
                            <button
                              onClick={() => handleSimulateWatch(100)}
                              className="px-3 py-1 rounded-lg bg-[#296ec2] hover:bg-[#1b4987] text-[11px] font-bold text-white shadow transition-colors cursor-pointer"
                            >
                              Complete (100%)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Chapter Notes Section */}
                  <div className="p-6">
                    <div className="flex items-center gap-2 pb-4 border-b border-white/10 text-white font-bold text-base">
                      <BookOpen className="w-5 h-5 text-[#93c5fd]" />
                      Lecture Study Notes & Syllabus Synopsis
                    </div>
                    <div className="mt-4 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {selectedChapter.notesContent || "No additional lecture notes attached."}
                    </div>
                  </div>
                </div>

                {/* 2. Gated Comprehension Quiz Container */}
                <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <HelpCircle className="w-5 h-5 text-[#ff7c62]" />
                      <div>
                        <h3 className="text-base font-bold text-white">
                          Chapter Comprehension Quiz
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Gated evaluation requirement for JLPT {selectedChapter.courseLevel} credits.
                        </p>
                      </div>
                    </div>

                    <div>
                      {selectedChapter.videoCompleted ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Gate Unlocked
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" /> Locked (Requires 100% Watch)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Blur Overlay if Video NOT 100% completed */}
                  {!selectedChapter.videoCompleted ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-xl">
                        <Lock className="w-7 h-7" />
                      </div>
                      <h4 className="text-base font-bold text-white">
                        Quiz Locked by Video Gate
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm">
                        You have currently completed {watchProgress}% of the lecture. Please finish the video above to unlock the comprehension questions.
                      </p>
                      <button
                        onClick={() => handleSimulateWatch(100)}
                        className="mt-2 px-4 py-2 rounded-xl bg-[#f06449] hover:bg-[#d9533a] text-white font-bold text-xs transition-all shadow-lg shadow-[#f06449]/20 cursor-pointer"
                      >
                        Finish Lecture Video Now
                      </button>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-6">
                      {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
                          {errorMsg}
                        </div>
                      )}

                      {quizResult && (
                        <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between">
                          <span>{quizResult.message}</span>
                          <span className="font-bold text-sm">Score: {quizResult.score}%</span>
                        </div>
                      )}

                      {selectedChapter.quizQuestions.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-500">
                          No quiz attached to this chapter.
                        </div>
                      ) : (
                        selectedChapter.quizQuestions.map((q, idx) => (
                          <div
                            key={q.id}
                            className="p-4 rounded-2xl bg-slate-950/70 border border-white/5 space-y-3"
                          >
                            <span className="text-xs font-bold text-[#93c5fd]">
                              Question {idx + 1}
                            </span>
                            <p className="text-sm font-semibold text-white">{q.questionText}</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                              {q.options.map((opt, oIdx) => {
                                const isSelected = selectedAnswers[q.id] === oIdx;
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => handleSelectAnswer(q.id, oIdx)}
                                    className={`p-3 rounded-xl text-left text-xs font-medium border transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-[#f06449] border-[#f06449] text-white shadow-md shadow-[#f06449]/20"
                                        : "bg-slate-900 border-white/10 text-slate-300 hover:border-white/20"
                                    }`}
                                  >
                                    <span className="font-mono text-slate-400 mr-2">
                                      {String.fromCharCode(65 + oIdx)}.
                                    </span>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}

                      {selectedChapter.quizQuestions.length > 0 && !selectedChapter.quizSubmitted && (
                        <div className="pt-4 border-t border-white/10 flex justify-end">
                          <button
                            onClick={handleSubmitQuiz}
                            disabled={isSubmittingQuiz}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
                          >
                            {isSubmittingQuiz ? "Submitting Quiz..." : "Submit Comprehension Quiz"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center bg-slate-900/60 border border-white/10 rounded-3xl text-slate-400 text-sm">
                Select a course chapter from the left to view notes and video practicums.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
