"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/navigation/Navbar";
import { UserSession, CourseLevel, FormQuestion, FormAssignmentData } from "@/lib/types";
import {
  BookOpen,
  Plus,
  Calendar,
  CheckCircle2,
  User,
  Award,
  X,
  Trash2,
  HelpCircle,
  FileText,
  ListPlus,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
} from "lucide-react";

interface SubmissionDetail {
  id: string;
  content: string;
  fileUrl?: string | null;
  submittedAt: string;
  grade?: number | null;
  feedback?: string | null;
  status: string;
  student: {
    id: string;
    name: string;
    email: string;
    courseLevel: string;
    section: string;
  };
}

interface AssignmentWithSubs {
  id: string;
  title: string;
  description: string;
  courseLevel: string;
  dueDate: string;
  maxMarks: number;
  isGoogleForm?: boolean;
  formData?: FormAssignmentData | null;
  submissions: SubmissionDetail[];
  _count: { submissions: number };
}

export default function AdminAssignmentsPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithSubs[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("ALL");

  // Google Form Builder Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [courseLevel, setCourseLevel] = useState<CourseLevel>("N5");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  // Dynamic Google Form Questions
  const [questions, setQuestions] = useState<FormQuestion[]>([
    {
      id: "q_1",
      questionText: "「食べる」の過去形は何ですか？ (What is the past tense of 'taberu'?)",
      questionType: "MCQ",
      options: ["食べました", "食べます", "食べた", "食べない"],
      correctOption: 0,
      marks: 5,
    },
    {
      id: "q_2",
      questionText: "空欄に入る最も適当な言葉を選んでください: 私は毎日日本語___勉強します。",
      questionType: "MCQ",
      options: ["を", "に", "で", "へ"],
      correctOption: 0,
      marks: 5,
    },
  ]);

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedResponsesId, setExpandedResponsesId] = useState<string | null>(null);
  const [selectedSubDetail, setSelectedSubDetail] = useState<SubmissionDetail | null>(null);

  // Auto-calculated total marks from sum of each question's marks
  const totalCalculatedMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  useEffect(() => {
    fetchProfileAndAssignments();
  }, [filterLevel]);

  const fetchProfileAndAssignments = async () => {
    try {
      const userRes = await fetch("/api/auth/me");
      const userData = await userRes.json();
      if (!userData.user || userData.user.role !== "ADMIN") {
        window.location.href = "/login";
        return;
      }
      setUser(userData.user);

      const url = filterLevel === "ALL" ? "/api/assignments" : `/api/assignments?courseLevel=${filterLevel}`;
      const assignRes = await fetch(url);
      const assignData = await assignRes.json();
      setAssignments(assignData.assignments || []);
    } catch (err) {
      console.error("Failed to load assignments:", err);
    } finally {
      setLoading(false);
    }
  };

  // Add a new question to the Google Form builder
  const handleAddQuestion = () => {
    const newQ: FormQuestion = {
      id: `q_${Date.now()}`,
      questionText: "",
      questionType: "MCQ",
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      correctOption: 0,
      marks: 5, // Default 5 marks per question
    };
    setQuestions([...questions, newQ]);
  };

  // Update a question field
  const handleUpdateQuestion = (index: number, updates: Partial<FormQuestion>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    setQuestions(updated);
  };

  // Remove a question
  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      alert("At least one question is required for a Google Form assignment.");
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // Add an option to a question
  const handleAddOption = (qIndex: number) => {
    const q = questions[qIndex];
    const newOptions = [...q.options, `Option ${q.options.length + 1}`];
    handleUpdateQuestion(qIndex, { options: newOptions });
  };

  // Update option text
  const handleUpdateOption = (qIndex: number, optIndex: number, text: string) => {
    const q = questions[qIndex];
    const newOptions = [...q.options];
    newOptions[optIndex] = text;
    handleUpdateQuestion(qIndex, { options: newOptions });
  };

  // Remove option
  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    const q = questions[qIndex];
    if (q.options.length <= 2) {
      alert("Each multiple choice question must have at least 2 options.");
      return;
    }
    const newOptions = q.options.filter((_, i) => i !== optIndex);
    let newCorrect = q.correctOption;
    if (newCorrect >= newOptions.length) {
      newCorrect = newOptions.length - 1;
    }
    handleUpdateQuestion(qIndex, { options: newOptions, correctOption: newCorrect });
  };

  // Load a JLPT template
  const handleLoadTemplate = (level: CourseLevel) => {
    setCourseLevel(level);
    setTitle(`${level} Kanji & Grammar Comprehensive Form Quiz`);
    setInstructions(`Instructions: Complete all multiple-choice questions. Select the single best answer for each question.`);
    if (level === "N5" || level === "N4") {
      setQuestions([
        {
          id: `q_${Date.now()}_1`,
          questionText: "「山」の正しい読み方はどれですか？",
          questionType: "MCQ",
          options: ["やま (yama)", "かわ (kawa)", "うみ (umi)", "そら (sora)"],
          correctOption: 0,
          marks: 5,
        },
        {
          id: `q_${Date.now()}_2`,
          questionText: "図書館____本を借りました。適切な助詞を選んでください。",
          questionType: "MCQ",
          options: ["で", "に", "を", "へ"],
          correctOption: 0,
          marks: 5,
        },
        {
          id: `q_${Date.now()}_3`,
          questionText: "「きのう 友達と えいがを ______。」過去形を選びなさい。",
          questionType: "MCQ",
          options: ["見ました", "見ます", "見る", "見ない"],
          correctOption: 0,
          marks: 5,
        },
      ]);
    } else {
      setQuestions([
        {
          id: `q_${Date.now()}_1`,
          questionText: "「迅速」の正しい読み方と意味に最も近いものを選びなさい。",
          questionType: "MCQ",
          options: ["じんそく (Quick / Prompt)", "しんそく", "じんぞく", "しんぞく"],
          correctOption: 0,
          marks: 10,
        },
        {
          id: `q_${Date.now()}_2`,
          questionText: "次の文の空欄に入る最も適切な接続表現を選びなさい:「悪天候に_____、試合は予定通り開催された。」",
          questionType: "MCQ",
          options: ["かかわらず", "ともなって", "したがって", "反して"],
          correctOption: 0,
          marks: 10,
        },
      ]);
    }
  };

  // Submit and Publish the Google Form assignment
  const handlePublishAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setMessage({ text: "Please enter an assignment title.", type: "error" });
      return;
    }

    // Validate that questions have non-empty text
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].questionText.trim()) {
        setMessage({ text: `Question ${i + 1} cannot have an empty prompt.`, type: "error" });
        return;
      }
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          instructions: instructions || "Please answer all questions carefully.",
          courseLevel,
          dueDate: new Date(dueDate).toISOString(),
          maxMarks: totalCalculatedMarks,
          questions,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          text: `Google Form Assignment "${title}" published successfully! (${questions.length} Questions, ${totalCalculatedMarks} Total Marks)`,
          type: "success",
        });
        setTimeout(() => {
          setIsModalOpen(false);
          fetchProfileAndAssignments();
        }, 1500);
      } else {
        setMessage({ text: data.error || "Failed to publish assignment.", type: "error" });
      }
    } catch (err) {
      console.error("Failed to publish assignment:", err);
      setMessage({ text: "An error occurred while publishing.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete assignment
  const handleDeleteAssignment = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete assignment "${title}"? This will delete all student submissions.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/assignments?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchProfileAndAssignments();
      } else {
        alert("Failed to delete assignment");
      }
    } catch (e) {
      console.error(e);
      alert("Network error deleting assignment");
    }
  };

  // Parse submission content if it is JSON
  const parseSubmissionContent = (contentStr: string) => {
    try {
      if (contentStr.trim().startsWith("{")) {
        return JSON.parse(contentStr);
      }
    } catch {
      // Return raw
    }
    return null;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#070D18] flex items-center justify-center text-slate-400">
        Loading Assignment Center...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070D18] pb-16 text-slate-100">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold border border-orange-500/30">
                課題配信・Assignment Hub
              </span>
              <span className="text-xs text-slate-400">Interactive Quiz & Practicum Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Course Assignment Publisher & Evaluator
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Publish interactive MCQ assignments with custom marks per question, and evaluate student submissions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setTitle("");
                setInstructions("");
                setMessage(null);
                setQuestions([
                  {
                    id: "q_1",
                    questionText: "「食べる」の過去形は何ですか？",
                    questionType: "MCQ",
                    options: ["食べました", "食べます", "食べた", "食べない"],
                    correctOption: 0,
                    marks: 5,
                  },
                  {
                    id: "q_2",
                    questionText: "私は毎日日本語___勉強します。(Choose particle: を, に, で, へ)",
                    questionType: "MCQ",
                    options: ["を", "に", "で", "へ"],
                    correctOption: 0,
                    marks: 5,
                  },
                ]);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs shadow-lg shadow-orange-950/40 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Publish Assignment
            </button>
          </div>
        </div>


        {/* Tier Filter Tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <span className="text-xs font-semibold text-slate-400 mr-1">Filter by Tier:</span>
          {["ALL", "N1", "N2", "N3", "N4", "N5"].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterLevel === lvl
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-950/50"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {lvl === "ALL" ? "All Levels" : lvl}
            </button>
          ))}
        </div>

        {/* Assignments List */}
        <div className="space-y-6">
          {assignments.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No assignments found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No assignments have been published for this filter yet. Click &quot;Publish Assignment&quot; to build your first interactive practicum.
              </p>
            </div>
          ) : (
            assignments.map((assign) => {
              const formData = assign.formData;
              const hasFormQuestions = assign.isGoogleForm && formData?.questions?.length;

              return (
                <div
                  key={assign.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 transition-all hover:border-slate-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-950/80 text-orange-400 border border-orange-800/80 font-mono">
                        {assign.courseLevel}
                      </span>
                      <h3 className="text-lg font-bold text-white">{assign.title}</h3>
                      {assign.isGoogleForm && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-950/80 text-blue-300 font-semibold border border-blue-800/80 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-blue-400" />
                          Interactive MCQ
                        </span>
                      )}
                    </div>


                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
                        Due: {new Date(assign.dueDate).toLocaleDateString()} | Total:{" "}
                        <strong className="text-orange-400">{assign.maxMarks} Marks</strong>
                      </span>
                      <button
                        onClick={() => handleDeleteAssignment(assign.id, assign.title)}
                        title="Delete Assignment"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Form Instructions / Description */}
                  <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs text-slate-300">
                    <span className="font-semibold text-slate-400 mr-2">Instructions:</span>
                    {assign.isGoogleForm && formData?.instructions
                      ? formData.instructions
                      : assign.description}
                  </div>

                  {/* Google Form Questions Preview (if Google Form) */}
                  {hasFormQuestions && (
                    <div className="border border-slate-800/80 bg-slate-950/50 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-orange-400" />
                          Form Questions ({formData.questions.length} Questions with Custom Marks)
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Auto-Graded MCQs
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {formData.questions.map((q, idx) => (
                          <div
                            key={q.id || idx}
                            className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-200">
                                Q{idx + 1}. {q.questionText}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-orange-950 text-orange-300 font-mono font-bold text-[10px] border border-orange-800">
                                {q.marks} Marks
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 pl-2 border-l border-slate-800 space-y-0.5">
                              {q.options.map((opt, optIdx) => (
                                <div
                                  key={optIdx}
                                  className={
                                    optIdx === q.correctOption
                                      ? "text-emerald-400 font-semibold flex items-center gap-1"
                                      : "text-slate-400"
                                  }
                                >
                                  <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                                  {optIdx === q.correctOption && (
                                    <span className="text-[9px] bg-emerald-950 px-1 py-0.2 rounded border border-emerald-800">
                                      Correct
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Submissions Section */}
                  <div className="pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-orange-400" />
                        Student Submissions ({assign._count.submissions})
                      </h4>
                    </div>

                    {assign.submissions.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">
                        No candidate responses handed in yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {assign.submissions.map((sub) => {
                          const parsed = parseSubmissionContent(sub.content);
                          const isJsonSubmission = !!parsed;

                          return (
                            <div
                              key={sub.id}
                              className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs space-y-2"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{sub.student.name}</span>
                                  <span className="text-slate-400 text-[11px]">({sub.student.email})</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                                    {sub.student.courseLevel} - Sec {sub.student.section}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-slate-400 text-[11px]">
                                    {new Date(sub.submittedAt).toLocaleString()}
                                  </span>

                                  <span
                                    className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs ${
                                      sub.grade !== null
                                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                        : "bg-amber-950 text-amber-300 border border-amber-800"
                                    }`}
                                  >
                                    {sub.grade !== null
                                      ? `Score: ${sub.grade} / ${assign.maxMarks}`
                                      : "Pending Grade"}
                                  </span>

                                  {isJsonSubmission && (
                                    <button
                                      onClick={() => setSelectedSubDetail(sub)}
                                      className="px-2.5 py-1 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 font-semibold text-[11px] border border-orange-500/30 transition-colors"
                                    >
                                      View Answers
                                    </button>
                                  )}
                                </div>
                              </div>

                              {!isJsonSubmission && (
                                <p className="text-slate-300 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 font-mono">
                                  &ldquo;{sub.content}&rdquo;
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* View Answers Modal */}
        {selectedSubDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-orange-500" />
                    Student Google Form Responses
                  </h3>
                  <p className="text-xs text-slate-400">
                    Candidate: <strong className="text-white">{selectedSubDetail.student.name}</strong> ({selectedSubDetail.student.email})
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubDetail(null)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {(() => {
                const parsed = parseSubmissionContent(selectedSubDetail.content);
                if (!parsed || !parsed.questionResults) {
                  return (
                    <div className="p-4 bg-slate-950 rounded-xl text-xs font-mono text-slate-300 whitespace-pre-wrap">
                      {selectedSubDetail.content}
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-950 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Total Score Earned:</span>
                      <span className="font-mono text-emerald-400 font-bold text-sm">
                        {parsed.score} / {parsed.maxMarks} Marks
                      </span>
                    </div>

                    <div className="space-y-2">
                      {Object.entries(parsed.questionResults).map(([qId, res]: [string, any], idx) => (
                        <div
                          key={qId}
                          className={`p-3 rounded-xl border text-xs ${
                            res.marksEarned > 0
                              ? "bg-emerald-950/20 border-emerald-800/60"
                              : "bg-rose-950/20 border-rose-800/60"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-white">
                              Q{idx + 1}. {res.questionText}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                                res.marksEarned > 0
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                  : "bg-rose-950 text-rose-300 border border-rose-800"
                              }`}
                            >
                              {res.marksEarned} / {res.maxMarks} Marks
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 mt-2">
                            <div className="bg-slate-950/60 p-2 rounded">
                              <span className="text-slate-400 block text-[10px]">Student Selected:</span>
                              <strong className={res.marksEarned > 0 ? "text-emerald-400" : "text-rose-400"}>
                                Option {typeof res.selected === "number" ? String.fromCharCode(65 + res.selected) : res.selected}
                              </strong>
                            </div>
                            <div className="bg-slate-950/60 p-2 rounded">
                              <span className="text-slate-400 block text-[10px]">Correct Answer:</span>
                              <strong className="text-emerald-400">
                                Option {typeof res.correct === "number" ? String.fromCharCode(65 + res.correct) : res.correct}
                              </strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setSelectedSubDetail(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Google Form Builder Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto space-y-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
                    <ListPlus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Publish Assignment
                    </h3>
                    <p className="text-xs text-slate-400">
                      Configure multiple choice questions, assign custom marks per question, and publish to students.
                    </p>
                  </div>

                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {message && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-semibold ${
                    message.type === "success"
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                  }`}
                >
                  {message.text}
                </div>
              )}

              {/* Quick Template Fillers */}
              <div className="flex items-center gap-2 text-xs flex-wrap bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  Quick Presets:
                </span>
                {(["N5", "N4", "N3", "N2", "N1"] as CourseLevel[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleLoadTemplate(lvl)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-orange-600/20 hover:text-orange-400 text-slate-300 font-mono text-[11px] border border-slate-800 transition-colors"
                  >
                    Load {lvl} Template
                  </button>
                ))}
              </div>

              <form onSubmit={handlePublishAssignment} className="space-y-6">
                {/* Meta details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Assignment Title
                    </label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. N3 Kanji Reading & Grammar Mastery Quiz"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-orange-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Target JLPT Level
                    </label>
                    <select
                      value={courseLevel}
                      onChange={(e) => setCourseLevel(e.target.value as CourseLevel)}
                      aria-label="Target JLPT Level"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-orange-500 outline-none"
                    >
                      <option value="N1">N1 (Advanced)</option>
                      <option value="N2">N2 (Upper Intermediate)</option>
                      <option value="N3">N3 (Intermediate)</option>
                      <option value="N4">N4 (Upper Beginner)</option>
                      <option value="N5">N5 (Basic/Foundational)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Submission Deadline
                    </label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-orange-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      General Instructions / Guidelines
                    </label>
                    <input
                      type="text"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="e.g. Select the correct option for each question. No external dictionaries permitted."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-orange-500 outline-none"
                    />
                  </div>
                </div>

                {/* Questions Builder Header */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-orange-400" />
                      Assignment Questions ({questions.length})
                    </h4>

                    <p className="text-xs text-slate-400">
                      Set individual marks and the correct choice for each multiple choice question.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold bg-orange-950 text-orange-300 px-3 py-1.5 rounded-xl border border-orange-800">
                      Total Calculated Marks: {totalCalculatedMarks}
                    </span>
                    <button
                      type="button"
                      onClick={handleAddQuestion}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/20 text-orange-400 hover:bg-orange-600/30 text-xs font-bold border border-orange-500/40"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Question
                    </button>
                  </div>
                </div>

                {/* Questions List */}
                <div className="space-y-4">
                  {questions.map((q, qIndex) => (
                    <div
                      key={q.id || qIndex}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 relative"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center font-bold text-xs">
                            {qIndex + 1}
                          </span>
                          <span className="text-xs font-bold text-white">
                            Question {qIndex + 1}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Set mark for each question */}
                          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-800">
                            <label className="text-[11px] font-semibold text-slate-400">
                              Marks:
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={q.marks}
                              onChange={(e) =>
                                handleUpdateQuestion(qIndex, {
                                  marks: parseInt(e.target.value, 10) || 1,
                                })
                              }
                              className="w-12 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-orange-400 font-mono font-bold text-center outline-none focus:border-orange-500"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIndex)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-900 transition-colors"
                            title="Remove Question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div>
                        <input
                          type="text"
                          required
                          value={q.questionText}
                          onChange={(e) =>
                            handleUpdateQuestion(qIndex, { questionText: e.target.value })
                          }
                          placeholder={`Enter Question ${qIndex + 1} prompt or Kanji sentence...`}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-orange-500 outline-none"
                        />
                      </div>

                      {/* Options List */}
                      <div className="space-y-2 pl-2">
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          Options & Correct Answer (Select radio to designate correct key):
                        </label>

                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct_${qIndex}`}
                              checked={q.correctOption === optIndex}
                              onChange={() =>
                                handleUpdateQuestion(qIndex, { correctOption: optIndex })
                              }
                              title="Set as correct answer"
                              className="w-4 h-4 text-orange-500 focus:ring-orange-500 bg-slate-900 border-slate-700 cursor-pointer"
                            />
                            <span className="text-xs font-mono font-bold text-slate-400 w-5">
                              {String.fromCharCode(65 + optIndex)}.
                            </span>
                            <input
                              type="text"
                              required
                              value={opt}
                              onChange={(e) =>
                                handleUpdateOption(qIndex, optIndex, e.target.value)
                              }
                              placeholder={`Option ${optIndex + 1}`}
                              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:border-orange-500 outline-none"
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(qIndex, optIndex)}
                                className="text-slate-500 hover:text-rose-400 text-xs px-1.5"
                                title="Remove option"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => handleAddOption(qIndex)}
                          className="mt-1 text-[11px] text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1"
                        >
                          + Add Option
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Questions: <strong className="text-white">{questions.length}</strong> | Total Marks:{" "}
                    <strong className="text-orange-400">{totalCalculatedMarks}</strong>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-orange-950/40 cursor-pointer"
                    >
                      {submitting ? "Publishing..." : "Publish Assignment"}
                    </button>

                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
