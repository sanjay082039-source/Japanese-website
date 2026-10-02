"use client";

import React, { useState } from "react";
import JapaneseAudioPlayer from "./JapaneseAudioPlayer";
import { RotateCw, Sparkles, BookOpen } from "lucide-react";

export interface FlashcardItem {
  id: string;
  character: string;
  romaji: string;
  meaning: string;
  level: string;
  onyomi?: string;
  kunyomi?: string;
  strokes?: number;
  exampleSentence?: string;
  exampleMeaning?: string;
  category?: string;
}

export default function Flashcard3D({ card }: { card: FlashcardItem }) {
  const [isFlipped, setIsFlipped] = useState(false);

  const toggleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleFlip();
    }
  };

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={`Flashcard for ${card.character}. Press Enter to flip`}
      onClick={toggleFlip}
      onKeyDown={handleKeyDown}
      className="flashcard-scene h-[360px] w-full max-w-sm cursor-pointer outline-none group focus-visible:ring-2 focus-visible:ring-[#f06449] rounded-3xl"
    >
      <div
        className={`flashcard-object h-full w-full rounded-3xl relative transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isFlipped ? "is-flipped" : ""
        }`}
      >
        {/* ================================================================= */}
        {/* FRONT FACE (Kanji Character & Brush Calligraphy)                  */}
        {/* ================================================================= */}
        <div className="flashcard-face glass-panel p-6 flex flex-col justify-between rounded-3xl border border-white/10 group-hover:border-[#f06449]/50 transition-colors shadow-2xl relative overflow-hidden bg-gradient-to-b from-[#0b1a2d]/90 to-[#081220]/95">
          {/* Subtle Japanese Watermark Grid */}
          <div className="absolute inset-0 bg-asanoha opacity-40 pointer-events-none" />

          {/* Top Bar: Level Badge & Quick Audio */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f06449]/15 text-[#ff7c62] border border-[#f06449]/35">
              JLPT {card.level}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <JapaneseAudioPlayer text={card.character} size="sm" />
            </div>
          </div>

          {/* Center Calligraphy Kanji */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto">
            <span className="font-japanese text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-blue-100 to-[#93c5fd] drop-shadow-[0_10px_20px_rgba(41,110,194,0.35)] group-hover:scale-105 transition-transform duration-300">
              {card.character}
            </span>
            <span className="text-sm font-semibold text-[#f06449] mt-2 font-mono tracking-widest uppercase">
              {card.romaji}
            </span>
          </div>

          {/* Bottom Prompt */}
          <div className="relative z-10 flex items-center justify-between pt-4 border-t border-white/5">
            <span className="text-xs text-slate-300 truncate">{card.meaning}</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-[#f06449] transition-colors">
              <RotateCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
              <span>Flip Card</span>
            </span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BACK FACE (Readings, Radicals, Example Sentence & Audio)          */}
        {/* ================================================================= */}
        <div className="flashcard-face flashcard-back glass-panel-coral p-6 flex flex-col justify-between rounded-3xl border border-[#f06449]/35 shadow-2xl relative overflow-hidden bg-gradient-to-b from-[#0f243e]/95 to-[#081220]/98">
          <div className="absolute inset-0 bg-circuit-mesh opacity-30 pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="font-japanese text-2xl font-bold text-white">{card.character}</span>
              <span className="text-xs font-mono text-[#ff7c62] font-semibold">{card.romaji}</span>
            </div>
            {card.strokes && (
              <span className="text-[10px] text-slate-300 font-mono px-2 py-0.5 rounded bg-slate-900 border border-white/10">
                {card.strokes} Strokes
              </span>
            )}
          </div>

          {/* Body Content */}
          <div className="relative z-10 flex flex-col gap-3 my-auto">
            {/* English Meaning */}
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                Meaning
              </span>
              <span className="text-base font-bold text-white tracking-tight">{card.meaning}</span>
            </div>

            {/* Onyomi & Kunyomi */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {card.onyomi && (
                <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Onyomi (音)</span>
                  <span className="font-japanese font-bold text-[#ff7c62]">{card.onyomi}</span>
                </div>
              )}
              {card.kunyomi && (
                <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Kunyomi (訓)</span>
                  <span className="font-japanese font-bold text-[#60a5fa]">{card.kunyomi}</span>
                </div>
              )}
            </div>

            {/* Example Sentence */}
            {card.exampleSentence && (
              <div className="p-3 rounded-2xl bg-[#f06449]/10 border border-[#f06449]/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-[#ff7c62] uppercase tracking-wider">Example Usage</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <JapaneseAudioPlayer text={card.exampleSentence} size="sm" />
                  </div>
                </div>
                <p className="font-japanese text-xs font-medium text-slate-200 leading-snug">
                  {card.exampleSentence}
                </p>
                {card.exampleMeaning && (
                  <p className="text-[11px] text-slate-400 mt-1 italic leading-tight">
                    {card.exampleMeaning}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="relative z-10 flex items-center justify-between pt-3 border-t border-white/5">
            <span className="text-[10px] text-slate-500">Tap anywhere to flip back</span>
            <RotateCw className="w-3.5 h-3.5 text-[#ff7c62]" />
          </div>
        </div>
      </div>
    </div>
  );
}
