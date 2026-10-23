"use client";

import React, { useState } from "react";
import Flashcard3D, { FlashcardItem } from "./Flashcard3D";
import { Sparkles, Layers, BookOpen } from "lucide-react";

const SAMPLE_FLASHCARDS: FlashcardItem[] = [
  // N5
  {
    id: "n5-1",
    character: "日",
    romaji: "hi / nichi",
    meaning: "Sun / Day / Japan",
    level: "N5",
    onyomi: "ニチ, ジツ",
    kunyomi: "ひ, -び, -か",
    strokes: 4,
    exampleSentence: "今日はいい天気ですね。",
    exampleMeaning: "The weather is lovely today, isn't it?",
    category: "Nature & Time",
  },
  {
    id: "n5-2",
    character: "学",
    romaji: "gaku / mana",
    meaning: "Study / Learning / Science",
    level: "N5",
    onyomi: "ガク",
    kunyomi: "まな・ぶ",
    strokes: 8,
    exampleSentence: "大学で日本語を勉強します。",
    exampleMeaning: "I study Japanese at the university.",
    category: "Academic",
  },
  // N4
  {
    id: "n4-1",
    character: "旅",
    romaji: "tabi / ryo",
    meaning: "Trip / Travel / Journey",
    level: "N4",
    onyomi: "リョ",
    kunyomi: "たび",
    strokes: 10,
    exampleSentence: "京都への一人旅を計画しています。",
    exampleMeaning: "I am planning a solo trip to Kyoto.",
    category: "Culture",
  },
  {
    id: "n4-2",
    character: "心",
    romaji: "kokoro / shin",
    meaning: "Heart / Mind / Spirit",
    level: "N4",
    onyomi: "シン",
    kunyomi: "こころ",
    strokes: 4,
    exampleSentence: "感謝の心を忘れません。",
    exampleMeaning: "I will never forget a heart of gratitude.",
    category: "Emotion",
  },
  // N3
  {
    id: "n3-1",
    character: "夢",
    romaji: "yume / mu",
    meaning: "Dream / Vision / Aspiration",
    level: "N3",
    onyomi: "ム, ボウ",
    kunyomi: "ゆめ",
    strokes: 13,
    exampleSentence: "夢に向かって毎日前進します。",
    exampleMeaning: "Stepping forward every day towards my dreams.",
    category: "Philosophy",
  },
  {
    id: "n3-2",
    character: "道",
    romaji: "michi / dou",
    meaning: "Way / Path / Discipline",
    level: "N3",
    onyomi: "ドウ, トウ",
    kunyomi: "みち",
    strokes: 12,
    exampleSentence: "千里の道も一歩から始まります。",
    exampleMeaning: "A journey of a thousand miles begins with a single step.",
    category: "Martial & Philosophy",
  },
  // N2
  {
    id: "n2-1",
    character: "響",
    romaji: "hibiki / kyou",
    meaning: "Echo / Resonance / Sound",
    level: "N2",
    onyomi: "キョウ",
    kunyomi: "ひび・く",
    strokes: 20,
    exampleSentence: "彼の言葉が深く心に響いた。",
    exampleMeaning: "His words resonated deeply within my heart.",
    category: "Nuance",
  },
  // N1
  {
    id: "n1-1",
    character: "絆",
    romaji: "kizuna / han",
    meaning: "Bonds / Emotional Ties / Connection",
    level: "N1",
    onyomi: "ハン, バン",
    kunyomi: "きずな",
    strokes: 11,
    exampleSentence: "人と人との絆が最も貴い財産です。",
    exampleMeaning: "The emotional bonds between people are life's most precious treasure.",
    category: "Literary & Cultural",
  },
];

export default function FlashcardShowcase() {
  const [selectedLevel, setSelectedLevel] = useState<string>("ALL");

  const filteredCards =
    selectedLevel === "ALL"
      ? SAMPLE_FLASHCARDS
      : SAMPLE_FLASHCARDS.filter((c) => c.level === selectedLevel);

  const levels = ["ALL", "N5", "N4", "N3", "N2", "N1"];

  return (
    <div className="w-full max-w-6xl mx-auto my-12">
      {/* Title & Level Selector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f06449]/15 border border-[#f06449]/35 text-[#ff7c62] text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#ff7c62]" />
            <span>Interactive 3D Sensory Study Deck</span>
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Kanji & Kana 3D Flip Flashcards
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Click or tap any card to trigger a seamless 180° 3D flip. Inspect stroke counts, Onyomi & Kunyomi readings, and tap the speaker icon to listen to native pronunciation.
          </p>
        </div>

        {/* Level Filters with Springy Pill */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl glass-panel bg-[#0b1a2d]/80 border border-white/10 self-start md:self-auto overflow-x-auto">
          {levels.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSelectedLevel(lvl)}
              className={`btn-spring px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedLevel === lvl
                  ? "bg-gradient-to-r from-[#296ec2] to-[#f06449] text-white shadow-lg shadow-blue-950/60"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {lvl === "ALL" ? "All Levels" : `JLPT ${lvl}`}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of 3D Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredCards.map((card) => (
          <Flashcard3D key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
