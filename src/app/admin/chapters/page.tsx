"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/navigation/Navbar";
import { UserSession } from "@/lib/types";
import {
  Video,
  Plus,
  BookOpen,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Upload,
} from "lucide-react";

export default function AdminChaptersPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseLevel, setCourseLevel] = useState("N5");
  const [chapterNumber, setChapterNumber] = useState(1);
  const [videoUrl, setVideoUrl] = useState("https://www.youtube.com/watch?v=sample");
  const [durationSeconds, setDurationSeconds] = useState(600);
  const [notesContent, setNotesContent] = useState("");

  // Attached Quiz Questions
  const [quizQuestions, setQuizQuestions] = useState<any[]>([
    {
      id: "q1",
      questionText: "What is the primary grammatical purpose of the particle 'に' introduced in this lecture?",
      options: ["Time marker", "Object marker", "Topic marker", "Subject marker"],
      correctOption: 0,
    },
  ]);

  const loadChapters = async () => {
    try {
      const res = await fetch(`/api/chapters?courseLevel=${courseLevel}`);
      if (res.ok) {
        const data = await res.json();
        setChapters(data.chapters);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    async function init() {
      const authRes = await fetch("/api/auth/me");
      if (authRes.ok) {
        const data = await authRes.json();
        setUser(data.user);
      }
    }
    init();
  }, []);

  useEffect(() => {
    loadChapters();
  }, [courseLevel]);

  const handleAddQuestion = () => {
    setQuizQuestions((prev) => [
      ...prev,
      {
        id: `q${prev.length + 1}`,
        questionText: "",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctOption: 0,
      },
    ]);
  };

  const handleCreateChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_CHAPTER",
          title,
          description,
          courseLevel,
          chapterNumber,
          videoUrl,
          durationSeconds,
          notesContent,
          quizQuestions,
        }),
      });

      if (res.ok) {
        setIsCreating(false);
        setTitle("");
        setDescription("");
        setNotesContent("");
        loadChapters();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#081220] text-slate-100 pb-16">
      {user && <Navbar user={user} />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#f06449]/20 text-[#ff7c62] font-semibold border border-[#f06449]/30 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" />
                Curriculum Publishing Console
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Chapter Notes & Gated Video Lecture Publisher
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Publish structured curriculum chapters with embedded video links, lecture notes, and attached comprehension quizzes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={courseLevel}
              onChange={(e) => setCourseLevel(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
            >
              {["N5", "N4", "N3", "N2", "N1"].map((lvl) => (
                <option key={lvl} value={lvl}>
                  JLPT {lvl}
                </option>
              ))}
            </select>

            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 rounded-xl bg-[#f06449] hover:bg-[#d9533a] text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-[#f06449]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Chapter Unit
            </button>
          </div>
        </div>

        {/* Create Modal / Accordion */}
        {isCreating && (
          <div className="mb-8 p-6 bg-slate-900/90 border border-white/15 rounded-3xl shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-[#f06449]" />
                Publish Chapter Unit for JLPT {courseLevel}
              </h2>
              <button
                onClick={() => setIsCreating(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateChapter} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Chapter Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Unit 1: Introduction to Hiragana & Daily Greetings"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#f06449]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Unit Sequence Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={chapterNumber}
                    onChange={(e) => setChapterNumber(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#f06449]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Video URL (YouTube / Vimeo / MP4)
                  </label>
                  <input
                    type="text"
                    required
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#f06449]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Estimated Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#f06449]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Lecture Study Notes & Syllabus Synopsis (Markdown Supported)
                </label>
                <textarea
                  rows={4}
                  value={notesContent}
                  onChange={(e) => setNotesContent(e.target.value)}
                  placeholder="Key grammar rules, vocabulary tables, and practice tips..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-[#f06449]"
                />
              </div>

              {/* Quiz Configuration */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-[#93c5fd]" /> Attached Gated Comprehension Questions
                  </span>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="text-xs text-[#93c5fd] hover:underline"
                  >
                    + Add Question
                  </button>
                </div>

                {quizQuestions.map((q, qIdx) => (
                  <div key={q.id} className="p-4 bg-slate-950 rounded-2xl border border-white/5 space-y-2">
                    <input
                      type="text"
                      placeholder={`Question ${qIdx + 1} Prompt...`}
                      value={q.questionText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuizQuestions((prev) =>
                          prev.map((item, i) => (i === qIdx ? { ...item, questionText: val } : item))
                        );
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {q.options.map((opt: string, oIdx: number) => (
                        <div key={oIdx} className="space-y-1">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const v = e.target.value;
                              setQuizQuestions((prev) =>
                                prev.map((item, i) =>
                                  i === qIdx
                                    ? {
                                        ...item,
                                        options: item.options.map((op: string, idx: number) =>
                                          idx === oIdx ? v : op
                                        ),
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200"
                          />
                          <label className="text-[10px] text-slate-400 flex items-center gap-1">
                            <input
                              type="radio"
                              name={`correct_${q.id}`}
                              checked={q.correctOption === oIdx}
                              onChange={() => {
                                setQuizQuestions((prev) =>
                                  prev.map((item, i) =>
                                    i === qIdx ? { ...item, correctOption: oIdx } : item
                                  )
                                );
                              }}
                            />
                            Correct
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow"
                >
                  Save & Publish Chapter
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Chapters Table */}
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="p-5 border-b border-white/10 font-bold text-sm text-white">
            Published Units for JLPT {courseLevel}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-16 text-center">Unit</th>
                  <th className="py-3 px-4">Title & Synopsis</th>
                  <th className="py-3 px-4">Video Link</th>
                  <th className="py-3 px-4 text-center">Duration</th>
                  <th className="py-3 px-4 text-center">Quiz Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {chapters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No chapters published for JLPT {courseLevel}. Click &ldquo;New Chapter Unit&rdquo; to add your first lecture.
                    </td>
                  </tr>
                ) : (
                  chapters.map((ch) => (
                    <tr key={ch.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-[#ff7c62]">
                        #{ch.chapterNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{ch.title}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{ch.notesContent}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#93c5fd] max-w-xs truncate">
                        {ch.videoUrl}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        {Math.round(ch.durationSeconds / 60)} mins
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                          {ch.quizQuestions?.length || 0} Questions
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
