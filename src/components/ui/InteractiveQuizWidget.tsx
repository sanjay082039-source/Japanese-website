"use client";

import React, { useState } from "react";
import JapaneseAudioPlayer from "./JapaneseAudioPlayer";
import { CheckCircle2, XCircle, Sparkles, HelpCircle, ArrowRight, RotateCcw } from "lucide-react";

interface QuizQuestion {
  id: number;
  promptKanji: string;
  romaji: string;
  question: string;
  options: { label: string; text: string; correct: boolean }[];
  explanation: string;
}

const SAMPLE_QUIZ: QuizQuestion[] = [
  {
    id: 1,
    promptKanji: "希望",
    romaji: "kibou",
    question: "What is the primary English meaning of the Kanji compound 「希望」?",
    options: [
      { label: "A", text: "Despair / Hopelessness", correct: false },
      { label: "B", text: "Hope / Aspiration", correct: true },
      { label: "C", text: "Patience / Endurance", correct: false },
      { label: "D", text: "Wisdom / Knowledge", correct: false },
    ],
    explanation: "「希」 means rare or hope, and 「望」 means desire or ambition. Together they form 'Hope / Wish'.",
  },
  {
    id: 2,
    promptKanji: "雨降って地固まる",
    romaji: "ame futte ji katamaru",
    question: "Select the correct interpretation of this traditional Japanese proverb:",
    options: [
      { label: "A", text: "Adversity builds resilience (Rain hardens the ground)", correct: true },
      { label: "B", text: "A heavy storm always destroys the harvest", correct: false },
      { label: "C", text: "Never begin a journey on a rainy day", correct: false },
      { label: "D", text: "Silence is more golden than speech", correct: false },
    ],
    explanation: "Literally 'after the rain, the ground hardens' — meaning good results come from hard times.",
  },
  {
    id: 3,
    promptKanji: "一期一会",
    romaji: "ichi-go ichi-e",
    question: "What core Japanese cultural philosophy is expressed by 「一期一会」?",
    options: [
      { label: "A", text: "Constant competition with peers", correct: false },
      { label: "B", text: "Treasuring unrepeatable once-in-a-lifetime encounters", correct: true },
      { label: "C", text: "Endless repetition of strict rituals", correct: false },
      { label: "D", text: "Planning meticulously for thirty years ahead", correct: false },
    ],
    explanation: "Derived from the tea ceremony philosophy: every single encounter is unique and will never happen again.",
  },
];

export default function InteractiveQuizWidget() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const currentQ = SAMPLE_QUIZ[currentIndex];

  const handleSelect = (idx: number, isCorrect: boolean) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    setIsAnswered(true);

    if (isCorrect) {
      setToastMessage("正解！ (Seikai!) Correct answer!");
    } else {
      setToastMessage("残念！ (Zannen!) Review the explanation below.");
    }

    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleNext = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    setCurrentIndex((prev) => (prev + 1) % SAMPLE_QUIZ.length);
  };

  const handleReset = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    setCurrentIndex(0);
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto rounded-3xl glass-panel p-6 sm:p-8 border border-white/10 shadow-2xl overflow-hidden bg-gradient-to-b from-[#0b1a2d]/90 to-[#081220]/95">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-circuit-mesh opacity-30 pointer-events-none" />

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-2xl bg-[#081220]/95 border border-[#f06449]/40 text-[#ff7c62] text-xs font-bold shadow-2xl shadow-blue-950/80 flex items-center gap-2 animate-[slideDown_300ms_cubic-bezier(0.16,1,0.3,1)]">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="relative z-10 flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#f06449]/15 text-[#ff7c62] border border-[#f06449]/35">
            Interactive Kanji Check
          </span>
          <span className="text-xs text-slate-300 font-mono">
            Question {currentIndex + 1} of {SAMPLE_QUIZ.length}
          </span>
        </div>

        <button
          type="button"
          onClick={handleReset}
          title="Reset Quiz"
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Question Prompt */}
      <div className="relative z-10 my-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="font-japanese text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-[#93c5fd]">
            {currentQ.promptKanji}
          </span>
          <JapaneseAudioPlayer text={currentQ.promptKanji} size="sm" />
        </div>
        <span className="text-xs font-mono text-[#ff7c62] font-medium block mt-1 tracking-widest uppercase">
          {currentQ.romaji}
        </span>
        <h4 className="text-sm sm:text-base font-bold text-slate-100 mt-4 max-w-lg mx-auto leading-snug">
          {currentQ.question}
        </h4>
      </div>

      {/* Interactive Options */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {currentQ.options.map((opt, idx) => {
          const isSelected = selectedOption === idx;
          let stateStyle = "bg-[#0b1a2d]/60 border-white/10 hover:border-[#5c9ee6]/50 hover:bg-[#0f243e]/80";

          if (isAnswered) {
            if (opt.correct) {
              stateStyle = "quiz-correct-glow text-emerald-200";
            } else if (isSelected && !opt.correct) {
              stateStyle = "quiz-incorrect-shake text-[#ff7c62]";
            } else {
              stateStyle = "opacity-40 bg-[#081220]/40 border-white/5";
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelect(idx, opt.correct)}
              className={`btn-spring p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all duration-300 relative ${stateStyle} ${
                !isAnswered ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <span className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 font-mono text-xs font-bold flex items-center justify-center shrink-0 text-slate-300">
                {opt.label}
              </span>
              <span className="text-xs font-semibold leading-snug flex-1">{opt.text}</span>

              {isAnswered && opt.correct && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              {isAnswered && isSelected && !opt.correct && (
                <XCircle className="w-4 h-4 text-[#f06449] shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Answer Explanation & Next Trigger */}
      {isAnswered && (
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 animate-[fadeIn_300ms_ease-in-out]">
          <p className="text-xs text-slate-300 leading-relaxed max-w-md">
            <strong className="text-[#ff7c62] font-semibold">Insight: </strong>
            {currentQ.explanation}
          </p>

          <button
            type="button"
            onClick={handleNext}
            className="btn-spring px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#296ec2] to-[#f06449] hover:from-[#1b4987] hover:to-[#ea583c] text-white font-bold text-xs shadow-lg shadow-blue-950/60 flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Next Question</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
