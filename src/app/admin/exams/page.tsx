"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/navigation/Navbar";
import { UserSession, CourseLevel } from "@/lib/types";
import {
  ShieldAlert,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  Lock,
  ChevronDown,
  Trash2,
  HelpCircle,
  X,
  Award,
  CheckCircle2,
  FileCheck2,
  Edit3,
  User,
  Eye,
  Sparkles,
  Wand2,
} from "lucide-react";

interface ExamQuestionItem {
  id: string;
  questionText: string;
  questionType: string;
  optionsJson: string;
  correctOption: string;
  marks: number;
  orderIndex: number;
}

interface ExamItem {
  id: string;
  title: string;
  courseLevel: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalMarks: number;
  isPublished: boolean;
  proctoringRules?: string | null;
  _count: { questions: number; attempts: number };
}

interface AttemptItem {
  id: string;
  examId: string;
  studentId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  status: string;
  cheatCount: number;
  answersJson: string | null;
  cheatLogJson: string | null;
  student: {
    id: string;
    name: string;
    email: string;
    courseLevel: string;
    section: string;
  };
  exam: {
    id: string;
    title: string;
    totalMarks: number;
    durationMinutes: number;
    courseLevel: string;
    questions: ExamQuestionItem[];
  };
  violations: {
    id: string;
    violationType: string;
    details: string | null;
    timestamp: string;
    severity: string;
  }[];
}

export default function AdminExamsManagerPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Exam Form Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [courseLevel, setCourseLevel] = useState<CourseLevel>("N5");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [totalMarks, setTotalMarks] = useState(50);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - 30);
    return d.toISOString().slice(0, 16);
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 16);
  });

  // Proctoring Toggles
  const [clipboardBlock, setClipboardBlock] = useState(true);
  const [devtoolsBlock, setDevtoolsBlock] = useState(true);
  const [tabSwitchLimit, setTabSwitchLimit] = useState(3);
  const [fullScreenRequired, setFullScreenRequired] = useState(true);

  // AI Exam Generator Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiFocusArea, setAiFocusArea] = useState("KANJI_VOCAB");
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiDuration, setAiDuration] = useState(30);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Question Items
  const [questions, setQuestions] = useState<
    { questionText: string; questionType: string; options: string[]; correctOption: string; marks: number }[]
  >([
    {
      questionText: "「川」の正しい読み方はどれですか？",
      questionType: "MCQ",
      options: ["やま", "かわ", "うみ", "そら"],
      correctOption: "1",
      marks: 10,
    },
    {
      questionText: "今日＿＿とても暑いですね。下線に入る助詞は？",
      questionType: "MCQ",
      options: ["は", "が", "を", "に"],
      correctOption: "0",
      marks: 10,
    },
  ]);

  const [message, setMessage] = useState<string | null>(null);

  // Evaluation Modal State (Host Side)
  const [evaluatingAttempt, setEvaluatingAttempt] = useState<AttemptItem | null>(null);
  const [evaluatorScore, setEvaluatorScore] = useState<number>(0);
  const [evaluatorStatus, setEvaluatorStatus] = useState<string>("GRADED");
  const [evaluatorFeedback, setEvaluatorFeedback] = useState<string>("");
  const [isSavingEvaluation, setIsSavingEvaluation] = useState(false);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProfileAndExams();
  }, []);

  const fetchProfileAndExams = async () => {
    try {
      const userRes = await fetch("/api/auth/me");
      const userData = await userRes.json();
      if (!userData.user || userData.user.role !== "ADMIN") {
        window.location.href = "/login";
        return;
      }
      setUser(userData.user);

      // Fetch exams
      const examsRes = await fetch("/api/exams?courseLevel=ALL");
      const examsData = await examsRes.json();
      setExams(examsData.exams || []);

      // Fetch attempts for host evaluation
      const attemptsRes = await fetch("/api/admin/exams/attempts");
      const attemptsData = await attemptsRes.json();
      setAttempts(attemptsData.attempts || []);
    } catch (err) {
      console.error("Failed to load exams and attempts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        questionText: "",
        questionType: "MCQ",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctOption: "0",
        marks: 10,
      },
    ]);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || questions.length === 0) return;

    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          courseLevel,
          durationMinutes,
          totalMarks,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          isPublished: true,
          proctoringRules: {
            clipboardBlock,
            devtoolsBlock,
            fullScreenRequired,
            tabSwitchLimit,
            selectionBlock: true,
          },
          questions,
        }),
      });

      if (res.ok) {
        setMessage("Examination published with active proctoring rules!");
        setTimeout(() => {
          setIsModalOpen(false);
          fetchProfileAndExams();
        }, 1000);
      }
    } catch (err) {
      console.error("Exam creation failed:", err);
    }
  };

  // Open Host Evaluator Modal
  const handleOpenEvaluation = (attempt: AttemptItem) => {
    setEvaluatingAttempt(attempt);
    setEvaluatorScore(attempt.score !== null ? attempt.score : 0);
    setEvaluatorStatus(attempt.status === "DISQUALIFIED" ? "DISQUALIFIED" : "GRADED");
    setEvaluatorFeedback("");
    setEvalMessage(null);
  };

  // Save Host Evaluation
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluatingAttempt) return;

    setIsSavingEvaluation(true);
    setEvalMessage(null);

    try {
      const res = await fetch("/api/admin/exams/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: evaluatingAttempt.id,
          score: evaluatorScore,
          status: evaluatorStatus,
          evaluatorFeedback,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setEvalMessage("Evaluation successfully saved and finalized!");
        // Update local attempts state
        setAttempts((prev) =>
          prev.map((a) =>
            a.id === evaluatingAttempt.id
              ? { ...a, score: evaluatorScore, status: evaluatorStatus }
              : a
          )
        );
        setTimeout(() => {
          setEvaluatingAttempt(null);
          setEvalMessage(null);
          fetchProfileAndExams();
        }, 1200);
      } else {
        setEvalMessage(data.error || "Failed to save evaluation.");
      }
    } catch (err) {
      setEvalMessage("Network error saving evaluation.");
    } finally {
      setIsSavingEvaluation(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading Examination Management & Evaluation Engine...
      </div>
    );
  }

  // Parse student answers for modal view
  let parsedStudentAnswers: Record<string, string> = {};
  if (evaluatingAttempt?.answersJson) {
    try {
      parsedStudentAnswers = JSON.parse(evaluatingAttempt.answersJson);
    } catch {
      parsedStudentAnswers = {};
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                Exam Control & Evaluation
              </span>
              <span className="text-xs text-slate-400">Assessment & Grading Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Examination & Host-Side Evaluation Manager
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Publish timed tests across JLPT tiers, inspect candidate infractions, and evaluate/grade student attempts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAiModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#296ec2] to-[#1b4987] hover:from-[#3b82f6] hover:to-[#2563eb] text-white font-bold text-xs shadow-lg shadow-[#081220]/60 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#93c5fd]" />
              AI Assessment Generator
            </button>

            <button
              onClick={() => {
                setTitle("");
                setMessage(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Manual Exam
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 1: PUBLISHED EXAMS OVERVIEW                           */}
        {/* ============================================================== */}
        <div className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-rose-500" />
            Configured Examinations ({exams.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                      {exam.courseLevel}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                      Published
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white leading-snug line-clamp-2">
                    {exam.title}
                  </h3>

                  <div className="mt-4 p-3 bg-slate-950/70 border border-slate-800 rounded-2xl grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Duration</span>
                      <span className="font-bold text-slate-200">{exam.durationMinutes} mins</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Total Marks</span>
                      <span className="font-bold text-slate-200">{exam.totalMarks} Marks</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Questions</span>
                      <span className="font-bold text-slate-200">{exam._count.questions} Items</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Attempts</span>
                      <span className="font-bold text-slate-200">{exam._count.attempts} Submitted</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-xs flex items-center justify-between text-slate-400 border-t border-slate-800">
                  <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5" /> Proctor Active
                  </span>
                  <span className="font-mono text-[10px]">Strike Limit: 3</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ============================================================== */}
        {/* SECTION 2: CANDIDATE ATTEMPTS & HOST EVALUATION REGISTRY       */}
        {/* (Includes the requested dedicated Evaluation Column for Host) */}
        {/* ============================================================== */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-rose-500" />
                <h2 className="text-lg font-bold text-white">
                  Candidate Attempts & Host-Side Evaluation Registry
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Review submitted exam papers, verify subjective written responses, and enter host evaluator marks.
              </p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-800 text-slate-300">
              Total Attempts: {attempts.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">JLPT Tier</th>
                  <th className="py-3 px-4">Exam Title</th>
                  <th className="py-3 px-4 text-center">Infractions</th>
                  <th className="py-3 px-4 text-center">Attempt Status</th>
                  <th className="py-3 px-4 text-center">Raw/Auto Score</th>
                  {/* REQUESTED DEDICATED COLUMN FOR HOST EVALUATION */}
                  <th className="py-3 px-4 text-center bg-rose-950/20 border-l border-r border-rose-500/20 text-rose-300">
                    Host Evaluation & Grading
                  </th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {attempts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No candidate exam attempts logged yet.
                    </td>
                  </tr>
                ) : (
                  attempts.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">
                        <div>
                          <span>{att.student.name}</span>
                          <span className="block text-[11px] text-slate-500 font-normal">{att.student.email}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                          {att.student.courseLevel}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-300 font-medium max-w-[200px] truncate">
                        {att.exam.title}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold ${
                            att.cheatCount > 0
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "text-slate-500"
                          }`}
                        >
                          {att.cheatCount} strikes
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            att.status === "GRADED"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : att.status === "DISQUALIFIED"
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "bg-amber-950 text-amber-300 border border-amber-800"
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-200">
                        {att.score !== null ? `${att.score} / ${att.exam.totalMarks}` : "Pending"}
                      </td>

                      {/* REQUESTED DEDICATED COLUMN ON HOST SIDE */}
                      <td className="py-3 px-4 text-center bg-rose-950/10 border-l border-r border-rose-500/20">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-bold text-sm text-white">
                            {att.score !== null ? `${att.score}` : "—"}{" "}
                            <span className="text-[10px] text-slate-400">/ {att.exam.totalMarks}</span>
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.2 rounded-full font-bold uppercase ${
                              att.status === "GRADED"
                                ? "bg-emerald-900/60 text-emerald-300"
                                : "bg-amber-900/60 text-amber-300"
                            }`}
                          >
                            {att.status === "GRADED" ? "Evaluated" : "Needs Review"}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleOpenEvaluation(att)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-all hover:scale-105"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Evaluate</span>
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
        {/* HOST EVALUATION & GRADING MODAL                               */}
        {/* ============================================================== */}
        {evaluatingAttempt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-rose-500" />
                  <h3 className="text-lg font-bold text-white">
                    Host Assessment Evaluator & Grading Console
                  </h3>
                </div>
                <button
                  onClick={() => setEvaluatingAttempt(null)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {evalMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                  {evalMessage}
                </div>
              )}

              {/* Candidate & Assessment Context Header */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Candidate</span>
                  <span className="font-bold text-white text-sm">{evaluatingAttempt.student.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">JLPT Tier & Section</span>
                  <span className="font-bold text-rose-400">
                    {evaluatingAttempt.student.courseLevel} (Sec {evaluatingAttempt.student.section})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Exam Total Marks</span>
                  <span className="font-bold text-white font-mono">{evaluatingAttempt.exam.totalMarks} Marks</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Security Infractions</span>
                  <span
                    className={`font-bold font-mono ${
                      evaluatingAttempt.cheatCount > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {evaluatingAttempt.cheatCount} strikes logged
                  </span>
                </div>
              </div>

              {/* Questions & Candidate Response Review */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Candidate Responses Breakdown ({evaluatingAttempt.exam.questions.length} Items)
                </h4>

                <div className="space-y-4">
                  {evaluatingAttempt.exam.questions.map((q, idx) => {
                    const candidateAnswer = parsedStudentAnswers[q.id];
                    let parsedOptions: string[] = [];
                    try {
                      parsedOptions = JSON.parse(q.optionsJson);
                    } catch {
                      parsedOptions = [];
                    }

                    const isMCQ = q.questionType === "MCQ";
                    const isCorrect = isMCQ && candidateAnswer === q.correctOption;

                    return (
                      <div
                        key={q.id}
                        className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-400 font-mono">
                            Q{idx + 1} [{q.questionType}]
                          </span>
                          <span className="font-mono text-slate-400 font-semibold">
                            Weight: {q.marks} Marks
                          </span>
                        </div>

                        <p className="text-slate-200 font-medium text-sm">{q.questionText}</p>

                        {isMCQ ? (
                          <div className="mt-2 space-y-1">
                            <div className="text-[11px] text-slate-400">
                              Selected Option:{" "}
                              <strong className={isCorrect ? "text-emerald-400" : "text-rose-400"}>
                                {candidateAnswer !== undefined && parsedOptions[parseInt(candidateAnswer, 10)]
                                  ? `${candidateAnswer} (${parsedOptions[parseInt(candidateAnswer, 10)]})`
                                  : "Unanswered"}
                              </strong>{" "}
                              {isCorrect ? "(Correct ✓)" : `(Expected: ${q.correctOption} - ${parsedOptions[parseInt(q.correctOption, 10)]})`}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                              Candidate Written Japanese Response:
                            </span>
                            <p className="text-slate-200 font-mono text-xs whitespace-pre-line leading-relaxed">
                              {candidateAnswer || "(No written text response submitted by candidate)"}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Host Evaluation Controls Form */}
              <form onSubmit={handleSaveEvaluation} className="space-y-4 pt-4 border-t border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Final Evaluated Score (Out of {evaluatingAttempt.exam.totalMarks})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      max={evaluatingAttempt.exam.totalMarks}
                      required
                      value={evaluatorScore}
                      onChange={(e) => setEvaluatorScore(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 font-mono focus:border-rose-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Evaluation Status
                    </label>
                    <select
                      value={evaluatorStatus}
                      onChange={(e) => setEvaluatorStatus(e.target.value)}
                      aria-label="Evaluation status"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-rose-500 outline-none"
                    >
                      <option value="GRADED">GRADED (Official Evaluation Complete)</option>
                      <option value="SUBMITTED">SUBMITTED (Pending Further Review)</option>
                      <option value="DISQUALIFIED">DISQUALIFIED (Proctoring Violation)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Evaluator Feedback & Instructor Comments
                  </label>
                  <textarea
                    rows={3}
                    value={evaluatorFeedback}
                    onChange={(e) => setEvaluatorFeedback(e.target.value)}
                    placeholder="Enter grading notes, kanji correction feedback, or dokkai critique..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:border-rose-500 outline-none"
                  ></textarea>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEvaluatingAttempt(null)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEvaluation}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-rose-950/40"
                  >
                    {isSavingEvaluation ? "Saving..." : "Save Host Evaluation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Exam Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  Configure New Proctored Assessment
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {message && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
                  {message}
                </div>
              )}

              <form onSubmit={handleCreateExam} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Exam Title</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. JLPT N4 Comprehensive Mid-Term Assessment"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-rose-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Target JLPT Tier</label>
                    <select
                      value={courseLevel}
                      onChange={(e) => setCourseLevel(e.target.value as CourseLevel)}
                      aria-label="Target JLPT Tier"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-rose-500 outline-none"
                    >
                      <option value="N1">N1 (Advanced)</option>
                      <option value="N2">N2 (Pre-Advanced)</option>
                      <option value="N3">N3 (Intermediate)</option>
                      <option value="N4">N4 (Elementary)</option>
                      <option value="N5">N5 (Beginner)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Duration (Mins)</label>
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Total Marks</label>
                    <input
                      type="number"
                      value={totalMarks}
                      onChange={(e) => setTotalMarks(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Window Starts</label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Window Closes</label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>

                {/* Anti-Cheat Rules Configuration */}
                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Proctoring & Anti-Cheat Rules Configuration
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={clipboardBlock}
                        onChange={(e) => setClipboardBlock(e.target.checked)}
                        className="accent-rose-500 rounded"
                      />
                      <span>Intercept Copy / Paste / Context Menu</span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={devtoolsBlock}
                        onChange={(e) => setDevtoolsBlock(e.target.checked)}
                        className="accent-rose-500 rounded"
                      />
                      <span>Block DevTools (F12, Ctrl+Shift+I)</span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fullScreenRequired}
                        onChange={(e) => setFullScreenRequired(e.target.checked)}
                        className="accent-rose-500 rounded"
                      />
                      <span>Enforce Fullscreen Mode Lock</span>
                    </label>

                    <div className="flex items-center gap-2 text-slate-300">
                      <span>Tab Switch Limit:</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={tabSwitchLimit}
                        onChange={(e) => setTabSwitchLimit(parseInt(e.target.value, 10))}
                        className="w-14 bg-slate-900 border border-slate-800 rounded px-2 py-1 font-mono text-center"
                      />
                      <span>strikes</span>
                    </div>
                  </div>
                </div>

                {/* Question Items Editor */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Assessment Questions ({questions.length})
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-rose-400 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Question
                    </button>
                  </div>

                  <div className="space-y-4">
                    {questions.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-400 font-mono">
                            Q{qIdx + 1} [{q.questionType}]
                          </span>
                          {questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qIdx))}
                              className="text-slate-500 hover:text-rose-400 text-xs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <input
                          type="text"
                          required
                          value={q.questionText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setQuestions((prev) =>
                              prev.map((item, i) => (i === qIdx ? { ...item, questionText: val } : item))
                            );
                          }}
                          placeholder="Question prompt in Japanese or English..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                        />

                        {q.questionType === "MCQ" && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct_${qIdx}`}
                                  checked={q.correctOption === String(oIdx)}
                                  onChange={() => {
                                    setQuestions((prev) =>
                                      prev.map((item, i) =>
                                        i === qIdx ? { ...item, correctOption: String(oIdx) } : item
                                      )
                                    );
                                  }}
                                  className="accent-rose-500"
                                />
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setQuestions((prev) =>
                                      prev.map((item, i) =>
                                        i === qIdx
                                          ? {
                                              ...item,
                                              options: item.options.map((o, idx) =>
                                                idx === oIdx ? val : o
                                              ),
                                            }
                                          : item
                                      )
                                    );
                                  }}
                                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/40"
                  >
                    Publish Assessment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL 2: AI EXAM GENERATOR (GEMINI STRUCTURED PROMPT)          */}
        {/* ============================================================== */}
        {isAiModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-[#93c5fd]">
                    <Sparkles className="w-5 h-5 text-[#93c5fd]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      AI JLPT Assessment Generator
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Powered by Gemini 1.5 Pro / Flash with strict schema validation.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAiModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Target JLPT Proficiency Level
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {(["N5", "N4", "N3", "N2", "N1"] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setCourseLevel(lvl)}
                        className={`py-2 rounded-xl text-xs font-bold font-mono border transition-all ${
                          courseLevel === lvl
                            ? "bg-[#f06449] border-[#f06449] text-white shadow-md shadow-[#f06449]/30"
                            : "bg-slate-950 border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Syllabus Focus Area
                  </label>
                  <select
                    value={aiFocusArea}
                    onChange={(e) => setAiFocusArea(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="KANJI_VOCAB">Kanji & Vocabulary (文字・語彙)</option>
                    <option value="GRAMMAR">Grammar & Syntax (文法)</option>
                    <option value="READING_COMPREHENSION">Reading Comprehension (読解)</option>
                    <option value="MIXED">Comprehensive Mixed Assessment (総合試験)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Assessment Question Limit (Set by Admin)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={aiQuestionCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setAiQuestionCount(isNaN(val) ? 5 : Math.max(1, Math.min(50, val)));
                        }}
                        className="w-24 bg-slate-950 border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold text-center outline-none focus:border-[#f06449]"
                      />
                      <div className="flex flex-wrap gap-1">
                        {[5, 10, 15, 20, 25, 30].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setAiQuestionCount(count)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all ${
                              aiQuestionCount === count
                                ? "bg-[#f06449] text-white"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Total: {aiQuestionCount} questions ({aiQuestionCount * 2} total marks)
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Time Allowed
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={180}
                        value={aiDuration}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setAiDuration(isNaN(val) ? 30 : Math.max(5, Math.min(180, val)));
                        }}
                        className="w-24 bg-slate-950 border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold text-center outline-none focus:border-[#f06449]"
                      />
                      <span className="text-xs text-slate-400 font-mono">Minutes</span>
                      <div className="flex gap-1 ml-auto">
                        {[15, 30, 45, 60, 90].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setAiDuration(mins)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-all ${
                              aiDuration === mins
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 text-slate-400 hover:text-white"
                            }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-white/5 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    Proctoring Protocols Automatically Attached:
                  </div>
                  <p>
                    Full-screen lock, DevTools interception, clipboard blocking, and tab-switch telemetry tracking with 3-strike auto-disqualification.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isGeneratingAi}
                  onClick={async () => {
                    setIsGeneratingAi(true);
                    try {
                      const res = await fetch("/api/admin/exams/ai-generate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          courseLevel,
                          focusArea: aiFocusArea,
                          questionCount: aiQuestionCount,
                          durationMinutes: aiDuration,
                        }),
                      });

                      if (res.ok) {
                        setIsAiModalOpen(false);
                        window.location.reload();
                      } else {
                        const err = await res.json();
                        alert(err.error || "Failed to generate exam.");
                      }
                    } catch (e: any) {
                      alert(e.message || "Network error");
                    } finally {
                      setIsGeneratingAi(false);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#296ec2] to-[#1b4987] hover:from-[#3b82f6] hover:to-[#2563eb] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#081220]/60 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingAi ? "Synthesizing Exam Items..." : "Generate & Publish Assessment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
