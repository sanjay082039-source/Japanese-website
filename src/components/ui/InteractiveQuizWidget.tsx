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
    <div className="relative w-full max-w-2xl mx-auto rounded-3xl p-6 sm:p-8 border border-[#E2DDD5] shadow-sm overflow-hidden bg-white/95">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-circuit-mesh opacity-10 pointer-events-none" />

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-2xl bg-white border border-[#7A8B6B] text-[#7A8B6B] text-xs font-bold shadow-lg flex items-center gap-2 animate-[slideDown_300ms_cubic-bezier(0.16,1,0.3,1)]">
          <Sparkles className="w-4 h-4 text-[#C5A059] animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="relative z-10 flex items-center justify-between pb-4 border-b border-[#E2DDD5]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#7A8B6B]/15 text-[#7A8B6B] border border-[#7A8B6B]/30 font-mono">
            Interactive Kanji Check • 確認テスト
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Question {currentIndex + 1} of {SAMPLE_QUIZ.length}
          </span>
        </div>

        <button
          type="button"
          onClick={handleReset}
          title="Reset Quiz"
          className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Question Prompt */}
      <div className="relative z-10 my-6 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="font-japanese text-3xl sm:text-4xl font-extrabold text-[#2E3033]">
            {currentQ.promptKanji}
          </span>
          <JapaneseAudioPlayer text={currentQ.promptKanji} size="sm" />
        </div>
        <span className="text-xs font-mono text-[#C5A059] font-medium block mt-1 tracking-widest uppercase">
          {currentQ.romaji}
        </span>
        <h4 className="text-sm sm:text-base font-bold text-slate-800 mt-4 max-w-lg mx-auto leading-snug">
          {currentQ.question}
        </h4>
      </div>

      {/* Interactive Options */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {currentQ.options.map((opt, idx) => {
          const isSelected = selectedOption === idx;
          let stateStyle = "bg-[#FAF8F5] border-[#E2DDD5] text-slate-800 hover:border-[#7A8B6B] hover:bg-white";

          if (isAnswered) {
            if (opt.correct) {
              stateStyle = "bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs";
            } else if (isSelected && !opt.correct) {
              stateStyle = "bg-rose-50 border-rose-300 text-rose-900 shadow-xs";
            } else {
              stateStyle = "opacity-45 bg-[#FAF8F5] border-[#E2DDD5]";
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
              <span className="w-6 h-6 rounded-lg bg-white border border-[#E2DDD5] font-mono text-xs font-bold flex items-center justify-center shrink-0 text-slate-700">
                {opt.label}
              </span>
              <span className="text-xs font-semibold leading-snug flex-1">{opt.text}</span>

              {isAnswered && opt.correct && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              {isAnswered && isSelected && !opt.correct && (
                <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Answer Explanation & Next Trigger */}
      {isAnswered && (
        <div className="relative z-10 mt-6 pt-5 border-t border-[#E2DDD5] flex flex-col sm:flex-row items-center justify-between gap-4 animate-[fadeIn_300ms_ease-in-out]">
          <p className="text-xs text-slate-600 leading-relaxed max-w-md">
            <strong className="text-[#C5A059] font-semibold">Insight: </strong>
            {currentQ.explanation}
          </p>

          <button
            type="button"
            onClick={handleNext}
            className="btn-spring px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2E3033] via-[#7A8B6B] to-[#C5A059] hover:opacity-95 text-white font-bold text-xs shadow-sm flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span>Next Question</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
