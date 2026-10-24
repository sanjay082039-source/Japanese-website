import React from "react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import SakuraPetals from "@/components/ui/SakuraPetals";
import TiltCard from "@/components/ui/TiltCard";
import FlashcardShowcase from "@/components/ui/FlashcardShowcase";
import InteractiveQuizWidget from "@/components/ui/InteractiveQuizWidget";
import JapaneseAudioPlayer from "@/components/ui/JapaneseAudioPlayer";
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Languages,
  Layers,
  Compass,
  Clock,
  Users,
  ShieldCheck,
  ChevronRight,
  FileCheck2,
  Volume2,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();

  const jlptLevels = [
    {
      level: "N5",
      title: "Foundations & Script",
      subtitle: "入門・基礎",
      kanjiEmblem: "入門",
      desc: "Hiragana, Katakana, basic 100 Kanji, everyday survival phrases, and foundational Japanese sentence patterns.",
      badge: "Beginner",
      badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
      accentBorder: "group-hover:border-blue-400",
      accentBg: "bg-blue-50 text-blue-700",
      kanjiCount: "100+ Kanji",
      vocabCount: "800+ Words",
    },
    {
      level: "N4",
      title: "Elementary Expression",
      subtitle: "初級会話",
      kanjiEmblem: "初級",
      desc: "Conversational grammar, verb te-form conjugations, daily listening comprehension, and essential daily living Kanji.",
      badge: "Elementary",
      badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
      accentBorder: "group-hover:border-sky-400",
      accentBg: "bg-sky-50 text-sky-700",
      kanjiCount: "300+ Kanji",
      vocabCount: "1,500+ Words",
    },
    {
      level: "N3",
      title: "Bridge to Fluency",
      subtitle: "中級読解",
      kanjiEmblem: "中級",
      desc: "Natural conversational flow, intermediate essays, formal grammar transitions, and contextual workplace Japanese.",
      badge: "Intermediate",
      badgeColor: "bg-amber-50 text-amber-800 border-amber-200",
      accentBorder: "group-hover:border-amber-400",
      accentBg: "bg-amber-50 text-amber-800",
      kanjiCount: "650+ Kanji",
      vocabCount: "3,750+ Words",
    },
    {
      level: "N2",
      title: "Advanced Articulation",
      subtitle: "上級応用",
      kanjiEmblem: "上級",
      desc: "Complex newspaper editorials, business honorifics (Keigo), specialized professional vocabulary, and rapid listening.",
      badge: "Pre-Advanced",
      badgeColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
      accentBorder: "group-hover:border-indigo-400",
      accentBg: "bg-indigo-50 text-indigo-800",
      kanjiCount: "1,000+ Kanji",
      vocabCount: "6,000+ Words",
    },
    {
      level: "N1",
      title: "Mastery & Nuance",
      subtitle: "最高峰・精通",
      kanjiEmblem: "最高峰",
      desc: "Literary Japanese, advanced philosophical discourse, nuanced idiomatic subtleties, and native academic fluency.",
      badge: "Mastery",
      badgeColor: "bg-gradient-to-r from-blue-700 to-[#d9381e] text-white border-transparent",
      accentBorder: "group-hover:border-[#d9381e]",
      accentBg: "bg-rose-50 text-rose-700",
      kanjiCount: "2,000+ Kanji",
      vocabCount: "10,000+ Words",
    },
  ];

  const pillars = [
    {
      icon: BookOpen,
      title: "Kanji & Vocabulary",
      japanese: "漢字・語彙",
      desc: "Mastery through structural radicals, mnemonics, stroke order discipline, and contextual readings (Onyomi & Kunyomi).",
    },
    {
      icon: Layers,
      title: "Grammar & Structure",
      japanese: "文法・構文",
      desc: "Deconstruct Japanese sentence mechanics from core particles to polite, humble, and honorific registers.",
    },
    {
      icon: Compass,
      title: "Reading Comprehension",
      japanese: "読解力",
      desc: "Progressive literature tracks from guided dialogues to authentic cultural essays, news editorials, and technical texts.",
    },
    {
      icon: Languages,
      title: "Listening & Practical Flow",
      japanese: "聴解・会話",
      desc: "Immersive audio labs, pitch accent coaching, and natural speech tempo training for native conversation.",
    },
  ];

  return (
    <div className="min-h-screen bg-japanese-canvas text-slate-800 flex flex-col justify-between relative overflow-hidden selection:bg-[#7A8B6B] selection:text-white">
      {/* =================================================================== */}
      {/* 1. AMBIENT 3D DEPTH LAYERS & SAKURA DRIFT                           */}
      {/* =================================================================== */}
      <SakuraPetals count={26} />

      {/* Japandi Organic Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[650px] h-[650px] rounded-full bg-[#7A8B6B]/10 blur-[150px]" />
        <div className="absolute top-[25%] right-[10%] w-[550px] h-[550px] rounded-full bg-[#C5A059]/10 blur-[160px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[750px] h-[550px] rounded-full bg-[#7A8B6B]/08 blur-[180px]" />
        <div className="absolute inset-0 bg-circuit-mesh opacity-30" />
        <div className="absolute inset-0 bg-asanoha opacity-30" />
      </div>

      {/* =================================================================== */}
      {/* 2. STICKY FLOATING TORII-STYLE NAVIGATION BAR                       */}
      {/* =================================================================== */}
      <header className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="rounded-2xl glass-panel shadow-sm border border-[#E2DDD5] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-[#C5A059]/40 shadow-sm shrink-0 bg-white group-hover:scale-105 transition-transform duration-300">
              <img
                src="/logo.png"
                alt="RIT Japanese Portal Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">
                  RIT <span className="text-[#C5A059]">JAPANESE COURSE</span>
                </span>
                <span className="hidden sm:inline text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-50 text-[#7A8B6B] font-japanese border border-[#7A8B6B]/30 font-semibold">
                  日本語コース
                </span>
              </div>
              <p className="text-[10px] text-[#7A8B6B] font-bold tracking-wider uppercase">
                BELIEVE IN THE POSSIBILITIES
              </p>
            </div>
          </Link>

          {/* Quick Anchor Jumps */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-600">
            <a
              href="#curriculum"
              className="px-3 py-1.5 rounded-xl hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Curriculum (JLPT)
            </a>
            <a
              href="#flashcards"
              className="px-3 py-1.5 rounded-xl hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              3D Flashcards
            </a>
            <a
              href="#quiz"
              className="px-3 py-1.5 rounded-xl hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Interactive Quiz
            </a>
            <a
              href="#pillars"
              className="px-3 py-1.5 rounded-xl hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Pedagogy
            </a>
          </nav>

          {/* Portal Action Trigger */}
          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href={session.role === "ADMIN" ? "/admin/dashboard" : "/student/dashboard"}
                className="btn-spring inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#2E3033] via-[#7A8B6B] to-[#C5A059] hover:opacity-95 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                <span>Enter {session.role === "ADMIN" ? "Admin Console" : "Student Portal"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="btn-spring inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#E2DDD5] hover:border-[#C5A059] text-slate-800 font-semibold text-xs shadow-2xs cursor-pointer hover:bg-slate-50"
              >
                <span>Portal Sign In</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#C5A059]" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 3. HERO SECTION WITH 3D DEPTH & AUTHENTIC TYPOGRAPHY                */}
      {/* =================================================================== */}
      <main className="flex-1 relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex flex-col items-center">
        {/* =================================================================== */}
        {/* 3. JAPANDI ARCHITECTURAL HERO STUDIO GRID                           */}
        {/* =================================================================== */}
        <section className="w-full rounded-3xl border border-[#E2DDD5] bg-[#FAF8F5]/95 shadow-sm relative overflow-hidden p-6 sm:p-10 lg:p-12 mb-16">
          {/* Architectural Registration Marks (+) at Corners */}
          <span className="absolute top-3 left-3 text-[#C5A059] font-mono text-xs select-none pointer-events-none opacity-60">+</span>
          <span className="absolute top-3 right-3 text-[#C5A059] font-mono text-xs select-none pointer-events-none opacity-60">+</span>
          <span className="absolute bottom-3 left-3 text-[#C5A059] font-mono text-xs select-none pointer-events-none opacity-60">+</span>
          <span className="absolute bottom-3 right-3 text-[#C5A059] font-mono text-xs select-none pointer-events-none opacity-60">+</span>

          {/* Top Architectural Studio Stamp Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-[#E2DDD5] text-xs font-mono text-slate-500">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-md bg-[#7A8B6B]/15 text-[#7A8B6B] font-bold border border-[#7A8B6B]/30 font-japanese">
                和創園 • WA-SOEN
              </span>
              <span className="text-slate-400">/</span>
              <span className="tracking-wider uppercase font-semibold text-slate-700">
                Kyoto Architectural Studio & Language Sanctuary
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-500">
              <span>LAT: 35.0116° N</span>
              <span>•</span>
              <span>LONG: 135.7681° E</span>
              <span>•</span>
              <span className="text-[#C5A059] font-bold">EST. 2026</span>
            </div>
          </div>

          {/* Asymmetric 12-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left 6 Columns: Botanical Emblem, Poetry, Philosophy & Actions */}
            <div className="lg:col-span-6 flex flex-col justify-center">
              {/* Botanical Pine Graphic & Subtitle */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-[#7A8B6B]/30 flex items-center justify-center text-[#7A8B6B] shadow-2xs">
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2L4 12h5l-4 7h6v3h2v-3h6l-4-7h5L12 2z" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs font-mono font-bold tracking-widest uppercase text-[#7A8B6B] block">
                    MINIMALIST JAPANDI PEDAGOGY
                  </span>
                  <span className="text-[11px] text-slate-500 font-serif">
                    Simplicity • Organic Linen • Spatial Focus
                  </span>
                </div>
              </div>

              {/* Main Architectural Japanese Calligraphy & English Title */}
              <h1 className="text-3xl sm:text-5xl xl:text-6xl font-black text-[#2E3033] tracking-tight leading-[1.12]">
                <span className="font-japanese block text-[#2E3033]">和を創り、言葉を紡ぐ。</span>
                <span className="block mt-2 text-xl sm:text-2xl xl:text-3xl font-extrabold text-[#7A8B6B]">
                  Architecture of Thought & Language
                </span>
              </h1>

              {/* Rusted Gold Vertical Accent Bar with Philosophy */}
              <div className="border-l-2 border-[#C5A059] pl-4 my-6 text-xs sm:text-sm text-slate-700 leading-relaxed font-serif">
                “Where classical Japanese spatial balance, natural Hinoki timber textures, and digital AI intelligence unite to create effortless, lifelong mastery.”
              </div>

              {/* Institutional Motto Ribbon */}
              <div className="inline-flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-[#E2DDD5] shadow-2xs mb-6 max-w-fit">
                <span className="text-[#C5A059] text-lg font-serif font-black leading-none">“</span>
                <div className="flex items-center gap-3">
                  <p className="text-xs sm:text-sm font-black tracking-widest uppercase text-[#2E3033]">
                    BELIEVE IN THE POSSIBILITIES
                  </p>
                  <JapaneseAudioPlayer text="日本語の可能性を信じて" size="sm" />
                </div>
                <span className="text-[#C5A059] text-lg font-serif font-black leading-none">”</span>
              </div>

              {/* Architectural Material & Engine Specs */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white/80 border border-[#E2DDD5] text-center mb-8">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">Palette</span>
                  <span className="text-xs font-bold text-slate-800 font-mono">Kinari #EFEBE4</span>
                </div>
                <div className="border-x border-[#E2DDD5]">
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">Curriculum</span>
                  <span className="text-xs font-bold text-[#7A8B6B] font-mono">JLPT N5 → N1</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">AI Engine</span>
                  <span className="text-xs font-bold text-[#C5A059] font-mono">Qwen2.5 QLoRA</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/login"
                  className="btn-spring px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#2E3033] via-[#7A8B6B] to-[#C5A059] hover:opacity-95 text-white font-extrabold text-xs sm:text-sm shadow-md flex items-center gap-2.5 cursor-pointer"
                >
                  <span>Enter Learning Sanctuary</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#flashcards"
                  className="btn-spring px-6 py-3.5 rounded-2xl bg-white border border-[#E2DDD5] hover:border-[#7A8B6B] text-slate-800 hover:text-slate-900 font-bold text-xs sm:text-sm shadow-2xs flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-[#C5A059]" />
                  <span>Explore 3D Flashcards</span>
                </a>
              </div>
            </div>

            {/* Right 6 Columns: High-Res Kyoto Engawa Focal Photo + 3 Gallery Tiles */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              {/* Primary Architectural Photo Focal (Engawa Veranda overlooking garden) */}
              <div className="relative rounded-2xl overflow-hidden border border-[#E2DDD5] shadow-md group bg-white">
                <div className="aspect-[16/10] w-full overflow-hidden">
                  <img
                    src="/images/engawa_garden.jpg"
                    alt="House in Kyoto - Engawa Garden Veranda"
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700 ease-out"
                  />
                </div>
                {/* Photo Caption Overlay Bar */}
                <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-[#2E3033]/90 via-[#2E3033]/60 to-transparent flex items-center justify-between text-white backdrop-blur-[2px]">
                  <div>
                    <span className="text-[10px] font-mono tracking-widest uppercase text-[#C5A059] block font-semibold">
                      ARCHITECTURAL FOCAL • 庭と縁側
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                      House in Kyoto • Engawa Garden & Veranda
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-1 rounded bg-black/40 border border-white/20 text-slate-200">
                    Natural Light
                  </span>
                </div>
              </div>

              {/* 3-Card Architectural Preview Gallery Strip */}
              <div className="grid grid-cols-3 gap-3">
                {/* Tile 1: Kyoto Wood Interior */}
                <div className="rounded-xl overflow-hidden border border-[#E2DDD5] bg-white p-2 flex flex-col justify-between group hover:border-[#7A8B6B] transition-colors shadow-2xs">
                  <div className="aspect-video w-full rounded-lg overflow-hidden mb-2">
                    <img
                      src="/images/kyoto_wood_interior.jpg"
                      alt="Kyoto Wood Interior Corridor"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-[#7A8B6B] uppercase font-bold block">
                      Interior
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 leading-tight block truncate">
                      Hinoki Cedar
                    </span>
                  </div>
                </div>

                {/* Tile 2: 3D Flashcards */}
                <a
                  href="#flashcards"
                  className="rounded-xl overflow-hidden border border-[#E2DDD5] bg-white p-2.5 flex flex-col justify-between group hover:border-[#C5A059] transition-colors shadow-2xs text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#C5A059] mb-2">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-[#C5A059] uppercase font-bold block">
                      Sensory
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 leading-tight block">
                      3D Flip Cards
                    </span>
                  </div>
                </a>

                {/* Tile 3: AI Voice Composer */}
                <Link
                  href="/login"
                  className="rounded-xl overflow-hidden border border-[#E2DDD5] bg-white p-2.5 flex flex-col justify-between group hover:border-[#2E3033] transition-colors shadow-2xs text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center text-[#2E3033] mb-2">
                    <Volume2 className="w-4 h-4 text-[#7A8B6B]" />
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-[#2E3033] uppercase font-bold block">
                      Audio AI
                    </span>
                    <span className="text-[11px] font-bold text-slate-800 leading-tight block">
                      Sensei Voice
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Column Architectural Philosophy & Digital Engine Banner */}
        <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <div className="p-6 rounded-3xl bg-white border border-[#E2DDD5] shadow-xs hover:border-[#7A8B6B]/40 transition-colors">
            <span className="text-xs font-mono font-bold text-[#7A8B6B] block mb-2">
              01 / SPATIAL ORDER • 空間と秩序
            </span>
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Daily Timetable & Academic Structure
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hourly AM/PM schedules, cohort assignment tracking, verified class roll-call registers, and rigorous proctored testing rooms.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#E2DDD5] shadow-xs hover:border-[#C5A059]/40 transition-colors">
            <span className="text-xs font-mono font-bold text-[#C5A059] block mb-2">
              02 / SENSORY RECALL • 感覚と記憶
            </span>
            <h3 className="text-base font-bold text-slate-900 mb-2">
              3D Tactile Flashcards & Audio Coach
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              3D perspective tilt cards, physical flip interactions, stroke orders, Onyomi/Kunyomi readings, and native speech audio feedback.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#E2DDD5] shadow-xs hover:border-[#2E3033]/40 transition-colors">
            <span className="text-xs font-mono font-bold text-[#2E3033] block mb-2">
              03 / DIGITAL INTELLIGENCE • 言語知性
            </span>
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Qwen2.5 QLoRA Sensei & Analytics 7
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              React Bits Pro AI Chat 8 voice composer, live waveform transcription, and Catmull-Rom sparkline telemetry tracking candidate proficiency.
            </p>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 4. INTERACTIVE 3D TILT CARDS: JLPT CURRICULUM TIERS                 */}
        {/* =================================================================== */}
        <section id="curriculum" className="w-full mt-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7A8B6B]/10 border border-[#7A8B6B]/30 text-[#7A8B6B] text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Multi-Tier Progressive Architecture</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Japanese Language Proficiency Levels
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Hover over any course card to experience mouse-follow 3D perspective tilt and dynamic specular light reflection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 max-w-6xl mx-auto">
            {jlptLevels.map((lvl, index) => {
              const colClasses =
                index === 3
                  ? "lg:col-span-2 lg:col-start-2 md:col-span-1"
                  : index === 4
                  ? "lg:col-span-2 md:col-span-2 md:max-w-md md:mx-auto md:w-full lg:max-w-none"
                  : "lg:col-span-2 md:col-span-1";

              return (
                <TiltCard
                  key={lvl.level}
                  maxTilt={10}
                  className={`h-full rounded-3xl glass-panel p-6 border border-[#E2DDD5] hover:border-[#7A8B6B]/50 shadow-sm transition-all ${colClasses}`}
                >
                  <div className="flex flex-col justify-between h-full">
                    {/* Card Top: Level & Kanji Calligraphy */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-2xl font-black text-slate-900">
                            {lvl.level}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${lvl.badgeColor}`}
                          >
                            {lvl.badge}
                          </span>
                        </div>
                        <span className="font-japanese text-xl font-bold text-[#7A8B6B]">
                          {lvl.subtitle}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 mb-2">{lvl.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{lvl.desc}</p>
                    </div>

                    {/* Card Bottom: Metrics & Audio */}
                    <div className="mt-6 pt-4 border-t border-[#E2DDD5] flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] font-mono text-slate-500">
                        <span>{lvl.kanjiCount}</span>
                        <span>•</span>
                        <span>{lvl.vocabCount}</span>
                      </div>

                      <JapaneseAudioPlayer text={lvl.subtitle} size="sm" />
                    </div>
                  </div>
                </TiltCard>
              );
            })}
          </div>
        </section>

        {/* =================================================================== */}
        {/* 5. TRUE 3D FLIP FLASHCARDS SENSORY SHOWCASE                         */}
        {/* =================================================================== */}
        <section id="flashcards" className="w-full">
          <FlashcardShowcase />
        </section>

        {/* =================================================================== */}
        {/* 6. CORE ACADEMIC PEDAGOGY PILLARS (WITH 3D DEPTH)                   */}
        {/* =================================================================== */}
        <section id="pillars" className="w-full mt-16 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7A8B6B]/10 border border-[#7A8B6B]/30 text-[#7A8B6B] text-xs font-semibold mb-3">
              <Layers className="w-3.5 h-3.5 text-[#7A8B6B]" />
              <span>Rigorous Language Acquisition</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Four Pillars of Mastery
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              A balanced methodology combining memory science, cultural context, and interactive audio.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <TiltCard
                  key={idx}
                  maxTilt={8}
                  className="rounded-3xl glass-panel p-6 border border-[#E2DDD5] hover:border-[#7A8B6B]/40 shadow-sm text-left"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#7A8B6B] mb-4 shadow-2xs">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="font-bold text-slate-900 text-sm">{pillar.title}</h3>
                    <span className="font-japanese text-xs font-semibold text-[#C5A059]">
                      {pillar.japanese}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mt-2">{pillar.desc}</p>
                </TiltCard>
              );
            })}
          </div>
        </section>

        {/* =================================================================== */}
        {/* 7. INTERACTIVE JAPANESE MICRO-QUIZ WIDGET                           */}
        {/* =================================================================== */}
        <section id="quiz" className="w-full mt-24">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7A8B6B]/10 border border-[#7A8B6B]/30 text-[#7A8B6B] text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Live Sensory Check</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Test Your Japanese Knowledge
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              Instant feedback micro-interactions: emerald glow for correct selections and crimson pulse for incorrect.
            </p>
          </div>

          <InteractiveQuizWidget />
        </section>

        {/* =================================================================== */}
        {/* 8. ROLE-BASED PORTALS OVERVIEW                                      */}
        {/* =================================================================== */}
        <section className="w-full mt-24 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Student Experience */}
            <div className="rounded-3xl glass-panel p-8 border border-[#E2DDD5] shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#7A8B6B]/10 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900">Student Learning Portal</h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                    STUDENT ACCESS
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  Personalized candidate desk with hourly schedule tracking, proctored examinations, and performance analytics:
                </p>
                <ul className="space-y-3.5 text-xs text-slate-700">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#7A8B6B] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">Daily Hourly Timetable:</strong> Interactive class schedule slots with teacher assignments and subject tags.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#7A8B6B] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">Proctored Examination Suite:</strong> Full-screen exam containment with real-time violation monitoring.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#7A8B6B] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">Published Assignments:</strong> Timed submission workflows and grading records.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-[#E2DDD5]">
                <Link
                  href="/login"
                  className="btn-spring text-xs font-bold text-[#7A8B6B] hover:text-emerald-800 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Sign In as Student</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Admin / Faculty Experience */}
            <div className="rounded-3xl glass-panel p-8 border border-[#E2DDD5] shadow-sm relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#C5A059]/10 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900">Faculty & Admin Portal</h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                    ADMIN ACCESS
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  Executive faculty management, cohort analytics, daily attendance register, and candidate shortlisting:
                </p>
                <ul className="space-y-3.5 text-xs text-slate-700">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">Daily Attendance Register:</strong> Fast roll-call marking by date, level, and 12-hour AM/PM slot.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">Student Directory & Roles:</strong> Update student JLPT levels (N1–N5), sections, and export shortlist.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-900">Publish Assignments & Exams:</strong> Host MCQ and written assessments with anti-copy containment.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-[#E2DDD5]">
                <Link
                  href="/login"
                  className="btn-spring text-xs font-bold text-[#C5A059] hover:text-amber-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Sign In as Administrator</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 9. CALL TO ACTION                                                   */}
        {/* =================================================================== */}
        <section className="w-full mt-24 max-w-5xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-r from-[#FAF8F5] via-white to-[#F5F2EC] border border-[#E2DDD5] p-8 sm:p-12 text-center relative overflow-hidden shadow-sm">
            <div className="relative z-10 max-w-2xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-[#C5A059] font-bold font-mono">
                RIT JAPANESE COURSE • 日本語学習
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
                Begin Your Journey to Japanese Fluency
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-3 leading-relaxed">
                Connect with your faculty, check your daily timetable, submit coursework, and achieve certified mastery in Japanese.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="btn-spring px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#2E3033] via-[#7A8B6B] to-[#C5A059] hover:opacity-95 text-white font-extrabold text-sm shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span>Access Platform</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =================================================================== */}
      {/* 10. AUTHENTIC JAPANESE FOOTER                                       */}
      {/* =================================================================== */}
      <footer className="border-t border-[#E2DDD5] bg-[#FAF8F5] py-8 text-center text-xs text-slate-600 relative z-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-japanese text-xs text-slate-700">千里の行も足下に始まる</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-600">A journey of a thousand miles begins with a single step.</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            © 2026 RIT Japanese Course • Department of Foreign Languages & Japanese Studies
          </p>
        </div>
      </footer>
    </div>
  );
}
