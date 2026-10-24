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
        <div className="flashcard-face p-6 flex flex-col justify-between rounded-3xl border border-[#E2DDD5] group-hover:border-[#C5A059] transition-all shadow-sm relative overflow-hidden bg-white/95">
          {/* Subtle Japanese Watermark Grid */}
          <div className="absolute inset-0 bg-asanoha opacity-15 pointer-events-none" />

          {/* Top Bar: Level Badge & Quick Audio */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#7A8B6B]/15 text-[#7A8B6B] border border-[#7A8B6B]/30 font-mono">
              JLPT {card.level}
            </span>
            <div onClick={(e) => e.stopPropagation()}>
              <JapaneseAudioPlayer text={card.character} size="sm" />
            </div>
          </div>

          {/* Center Calligraphy Kanji */}
          <div className="relative z-10 flex flex-col items-center justify-center my-auto">
            <span className="font-japanese text-7xl sm:text-8xl font-black text-[#2E3033] drop-shadow-sm group-hover:scale-105 transition-transform duration-300">
              {card.character}
            </span>
            <span className="text-xs font-semibold text-[#C5A059] mt-2 font-mono tracking-widest uppercase">
              {card.romaji}
            </span>
          </div>

          {/* Bottom Prompt */}
          <div className="relative z-10 flex items-center justify-between pt-4 border-t border-[#E2DDD5]">
            <span className="text-xs text-slate-700 truncate font-medium">{card.meaning}</span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 group-hover:text-[#7A8B6B] transition-colors">
              <RotateCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
              <span>Flip Card</span>
            </span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* BACK FACE (Readings, Radicals, Example Sentence & Audio)          */}
        {/* ================================================================= */}
        <div className="flashcard-face flashcard-back p-6 flex flex-col justify-between rounded-3xl border border-[#C5A059]/40 shadow-sm relative overflow-hidden bg-[#FAF8F5]">
          <div className="absolute inset-0 bg-circuit-mesh opacity-15 pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between pb-3 border-b border-[#E2DDD5]">
            <div className="flex items-center gap-2">
              <span className="font-japanese text-2xl font-bold text-slate-900">{card.character}</span>
              <span className="text-xs font-mono text-[#C5A059] font-semibold">{card.romaji}</span>
            </div>
            {card.strokes && (
              <span className="text-[10px] text-slate-600 font-mono px-2 py-0.5 rounded-full bg-white border border-[#E2DDD5]">
                {card.strokes} Strokes
              </span>
            )}
          </div>

          {/* Body Content */}
          <div className="relative z-10 flex flex-col gap-3 my-auto">
            {/* English Meaning */}
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                Meaning
              </span>
              <span className="text-base font-bold text-slate-900 tracking-tight">{card.meaning}</span>
            </div>

            {/* Onyomi & Kunyomi */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {card.onyomi && (
                <div className="p-2 rounded-xl bg-white border border-[#E2DDD5]">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Onyomi (音)</span>
                  <span className="font-japanese font-bold text-[#7A8B6B]">{card.onyomi}</span>
                </div>
              )}
              {card.kunyomi && (
                <div className="p-2 rounded-xl bg-white border border-[#E2DDD5]">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Kunyomi (訓)</span>
                  <span className="font-japanese font-bold text-[#C5A059]">{card.kunyomi}</span>
                </div>
              )}
            </div>

            {/* Example Sentence */}
            {card.exampleSentence && (
              <div className="p-2.5 rounded-xl bg-white border border-[#E2DDD5]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-[#7A8B6B] uppercase tracking-wider">Example Usage</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <JapaneseAudioPlayer text={card.exampleSentence} size="sm" />
                  </div>
                </div>
                <p className="font-japanese text-xs font-medium text-slate-800 leading-snug">
                  {card.exampleSentence}
                </p>
                {card.exampleMeaning && (
                  <p className="text-[11px] text-slate-600 mt-1 italic leading-tight">
                    {card.exampleMeaning}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="relative z-10 flex items-center justify-between pt-3 border-t border-[#E2DDD5]">
            <span className="text-[10px] text-slate-500">Tap anywhere to flip back</span>
            <RotateCw className="w-3.5 h-3.5 text-[#C5A059]" />
          </div>
        </div>
      </div>
    </div>
  );
}
