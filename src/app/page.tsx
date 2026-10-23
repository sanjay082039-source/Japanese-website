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
      badgeColor: "bg-[#0f294d]/80 text-[#93c5fd] border-[#296ec2]/40",
      accentBorder: "group-hover:border-[#5c9ee6]/60",
      accentBg: "bg-[#296ec2]/10 text-[#93c5fd]",
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
      badgeColor: "bg-[#163e75]/80 text-[#5c9ee6] border-[#296ec2]/50",
      accentBorder: "group-hover:border-[#296ec2]/60",
      accentBg: "bg-[#1b4987]/20 text-[#5c9ee6]",
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
      badgeColor: "bg-[#2a1714]/80 text-[#ff7c62] border-[#f06449]/40",
      accentBorder: "group-hover:border-[#f06449]/60",
      accentBg: "bg-[#f06449]/15 text-[#ff7c62]",
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
      badgeColor: "bg-[#1b4987]/80 text-[#93c5fd] border-[#5c9ee6]/50",
      accentBorder: "group-hover:border-[#5c9ee6]/60",
      accentBg: "bg-[#296ec2]/20 text-[#93c5fd]",
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
      badgeColor: "bg-gradient-to-r from-[#1b4987] to-[#f06449] text-white border-white/20",
      accentBorder: "group-hover:border-[#ff7c62]/70",
      accentBg: "bg-[#f06449]/20 text-white",
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
    <div className="min-h-screen bg-[#081220] text-slate-100 flex flex-col justify-between relative overflow-hidden selection:bg-[#f06449]/80 selection:text-white">
      {/* =================================================================== */}
      {/* 1. AMBIENT 3D DEPTH LAYERS & SAKURA DRIFT                           */}
      {/* =================================================================== */}
      <SakuraPetals count={26} />

      {/* Tokyo Midnight Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[650px] h-[650px] rounded-full bg-[#296ec2]/15 blur-[150px]" />
        <div className="absolute top-[25%] right-[10%] w-[550px] h-[550px] rounded-full bg-[#f06449]/12 blur-[160px]" />
        <div className="absolute bottom-[10%] left-[10%] w-[750px] h-[550px] rounded-full bg-[#163e75]/25 blur-[180px]" />
        <div className="absolute inset-0 bg-circuit-mesh opacity-50" />
        <div className="absolute inset-0 bg-asanoha opacity-40" />
      </div>

      {/* =================================================================== */}
      {/* 2. STICKY FLOATING TORII-STYLE NAVIGATION BAR                       */}
      {/* =================================================================== */}
      <header className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="rounded-2xl glass-panel-coral shadow-2xl border border-white/10 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand Identity */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-[#f06449]/40 shadow-lg shadow-[#081220]/60 shrink-0 bg-[#081220] group-hover:scale-105 transition-transform duration-300">
              <img
                src="/logo.png"
                alt="RIT Japanese Portal Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  RIT <span className="text-[#ff7c62]">JAPANESE COURSE</span>
                </span>
                <span className="hidden sm:inline text-[9px] px-1.5 py-0.2 rounded-full bg-[#296ec2]/20 text-[#93c5fd] font-japanese border border-[#296ec2]/35">
                  日本語コース
                </span>
              </div>
              <p className="text-[10px] text-[#ff7c62] font-bold tracking-wider uppercase">
                BELIEVE IN THE POSSIBILITIES
              </p>
            </div>
          </Link>

          {/* Quick Anchor Jumps */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold text-slate-300">
            <a
              href="#curriculum"
              className="px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-colors"
            >
              Curriculum (JLPT)
            </a>
            <a
              href="#flashcards"
              className="px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-colors"
            >
              3D Flashcards
            </a>
            <a
              href="#quiz"
              className="px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-colors"
            >
              Interactive Quiz
            </a>
            <a
              href="#pillars"
              className="px-3 py-1.5 rounded-xl hover:text-white hover:bg-white/5 transition-colors"
            >
              Pedagogy
            </a>
          </nav>

          {/* Portal Action Trigger */}
          <div className="flex items-center gap-3">
            {session ? (
              <Link
                href={session.role === "ADMIN" ? "/admin/dashboard" : "/student/dashboard"}
                className="btn-spring inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#296ec2] via-[#1b4987] to-[#f06449] hover:from-[#357fd9] hover:to-[#ff7c62] text-white font-bold text-xs shadow-lg shadow-[#081220]/70 cursor-pointer"
              >
                <span>Enter {session.role === "ADMIN" ? "Admin Console" : "Student Portal"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="btn-spring inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-white/10 hover:border-[#f06449]/50 text-white font-semibold text-xs shadow-md cursor-pointer hover:bg-slate-800"
              >
                <span>Portal Sign In</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#ff7c62]" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 3. HERO SECTION WITH 3D DEPTH & AUTHENTIC TYPOGRAPHY                */}
      {/* =================================================================== */}
      <main className="flex-1 relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 flex flex-col items-center">
        <section className="text-center max-w-4xl mx-auto flex flex-col items-center">
          {/* Logo Emblem Showcase with Japanese Torii Glow */}
          <div className="relative mb-6 group">
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#1b4987] via-[#296ec2] to-[#f06449] blur-2xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-[#5c9ee6]/40 shadow-2xl p-1 bg-[#081220]/90 group-hover:scale-105 transition-transform duration-300">
              <img
                src="/logo.png"
                alt="RIT Japanese Portal Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
          </div>

          {/* Subtitle Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#296ec2]/15 border border-[#5c9ee6]/30 text-[#93c5fd] text-xs font-semibold mb-6 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-[#ff7c62]" />
            <span>Bridging Classical Tradition & Modern Digital Pedagogy • JLPT N5 through N1</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.15]">
            Master Japanese with <br />
            <span className="bg-gradient-to-r from-[#93c5fd] via-[#5c9ee6] to-[#ff7c62] bg-clip-text text-transparent">
              Structure, Depth & Fluency
            </span>
          </h1>

          {/* Recently Added Quote Banner */}
          <div className="mt-5 inline-flex items-center justify-center gap-3 px-6 py-2.5 rounded-2xl bg-[#0b1a2d]/90 border border-[#296ec2]/40 backdrop-blur-md shadow-lg shadow-[#081220]/50">
            <span className="text-[#ff7c62] text-lg sm:text-xl font-serif font-black">“</span>
            <p className="text-sm sm:text-lg font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#93c5fd] via-[#ff7c62] to-[#f06449]">
              BELIEVE IN THE POSSIBILITIES
            </p>
            <span className="text-[#ff7c62] text-lg sm:text-xl font-serif font-black">”</span>
          </div>

          {/* Japanese Pronunciation Subtitle with Audio Player */}
          <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
            <p className="font-japanese text-sm sm:text-base text-[#93c5fd] font-medium tracking-wide">
              日本語の可能性を解き放つ — Unlock the Power of Nihongo
            </p>
            <JapaneseAudioPlayer text="日本語の可能性を解き放つ" size="sm" />
          </div>

          <p className="mt-5 text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
            Welcome to the <strong>RIT Japanese Course</strong>. An institutional digital academy crafted for rigorous language acquisition — combining daily hourly scheduling, interactive 3D sensory flashcards, native audio coaching, and certified JLPT evaluations.
          </p>

          {/* Primary CTA Buttons with Spring Physics */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="btn-spring px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#296ec2] via-[#1b4987] to-[#f06449] hover:from-[#357fd9] hover:to-[#ff7c62] text-white font-extrabold text-sm shadow-xl shadow-[#081220]/80 flex items-center gap-2.5 cursor-pointer"
            >
              <span>Launch Learning Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#flashcards"
              className="btn-spring px-7 py-3.5 rounded-2xl bg-[#0b1a2d]/90 border border-white/10 hover:border-[#5c9ee6]/60 text-slate-200 hover:text-white font-bold text-sm shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#ff7c62]" />
              <span>Explore 3D Flashcards</span>
            </a>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-14 w-full max-w-4xl">
            <div className="p-4 rounded-2xl glass-panel text-center">
              <span className="text-2xl font-black text-white font-mono block">5 Tiers</span>
              <span className="text-xs text-slate-400">Complete JLPT N5 to N1</span>
            </div>
            <div className="p-4 rounded-2xl glass-panel text-center">
              <span className="text-2xl font-black text-[#ff7c62] font-mono block">2,000+</span>
              <span className="text-xs text-slate-400">Kanji Radicals & Readings</span>
            </div>
            <div className="p-4 rounded-2xl glass-panel text-center">
              <span className="text-2xl font-black text-[#5c9ee6] font-mono block">100%</span>
              <span className="text-xs text-slate-400">Proctored Evaluations</span>
            </div>
            <div className="p-4 rounded-2xl glass-panel text-center">
              <span className="text-2xl font-black text-emerald-400 font-mono block">Daily</span>
              <span className="text-xs text-slate-400">Class Attendance Register</span>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* 4. INTERACTIVE 3D TILT CARDS: JLPT CURRICULUM TIERS                 */}
        {/* =================================================================== */}
        <section id="curriculum" className="w-full mt-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#296ec2]/15 border border-[#296ec2]/35 text-[#93c5fd] text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#ff7c62]" />
              <span>Multi-Tier Progressive Architecture</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Japanese Language Proficiency Levels
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
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
                  className={`h-full rounded-3xl glass-panel p-6 border border-white/10 hover:border-[#5c9ee6]/50 shadow-xl transition-all ${colClasses}`}
                >
                  <div className="flex flex-col justify-between h-full">
                    {/* Card Top: Level & Kanji Calligraphy */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-2xl font-black text-white">
                            {lvl.level}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${lvl.badgeColor}`}
                          >
                            {lvl.badge}
                          </span>
                        </div>
                        <span className="font-japanese text-xl font-bold text-[#5c9ee6]">
                          {lvl.subtitle}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white mb-2">{lvl.title}</h3>
                      <p className="text-xs text-slate-300 leading-relaxed">{lvl.desc}</p>
                    </div>

                    {/* Card Bottom: Metrics & Audio */}
                    <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#296ec2]/15 border border-[#296ec2]/30 text-[#93c5fd] text-xs font-semibold mb-3">
              <Layers className="w-3.5 h-3.5 text-[#5c9ee6]" />
              <span>Rigorous Language Acquisition</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Four Pillars of Mastery
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
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
                  className="rounded-3xl glass-panel p-6 border border-white/10 hover:border-[#5c9ee6]/40 shadow-lg text-left"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#296ec2]/10 border border-[#296ec2]/30 flex items-center justify-center text-[#5c9ee6] mb-4 shadow-sm">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="font-bold text-white text-sm">{pillar.title}</h3>
                    <span className="font-japanese text-xs font-semibold text-[#ff7c62]">
                      {pillar.japanese}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-2">{pillar.desc}</p>
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#296ec2]/15 border border-[#296ec2]/30 text-[#93c5fd] text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#ff7c62]" />
              <span>Live Sensory Check</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Test Your Japanese Knowledge
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
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
            <div className="rounded-3xl glass-panel p-8 border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#296ec2]/12 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Student Learning Portal</h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-[#0f294d] text-[#93c5fd] border border-[#1b4987] font-mono">
                    STUDENT ACCESS
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Personalized candidate desk with hourly schedule tracking, proctored examinations, and performance analytics:
                </p>
                <ul className="space-y-3.5 text-xs text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#5c9ee6] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Daily Hourly Timetable:</strong> Interactive class schedule slots with teacher assignments and subject tags.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#5c9ee6] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Proctored Examination Suite:</strong> Full-screen exam containment with real-time violation monitoring.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#5c9ee6] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Published Assignments:</strong> Timed submission workflows and grading records.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <Link
                  href="/login"
                  className="btn-spring text-xs font-bold text-[#5c9ee6] hover:text-[#93c5fd] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Sign In as Student</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Admin / Faculty Experience */}
            <div className="rounded-3xl glass-panel p-8 border border-white/10 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#f06449]/12 rounded-full blur-2xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Faculty & Admin Portal</h3>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-[#2a1714] text-[#ff7c62] border border-[#f06449]/40 font-mono">
                    ADMIN ACCESS
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Executive faculty management, cohort analytics, daily attendance register, and candidate shortlisting:
                </p>
                <ul className="space-y-3.5 text-xs text-slate-300">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#ff7c62] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Daily Attendance Register:</strong> Fast roll-call marking by date, level, and 12-hour AM/PM slot.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#ff7c62] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Student Directory & Roles:</strong> Update student JLPT levels (N1–N5), sections, and export shortlist.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#ff7c62] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-white">Publish Assignments & Exams:</strong> Host MCQ and written assessments with anti-copy containment.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <Link
                  href="/login"
                  className="btn-spring text-xs font-bold text-[#ff7c62] hover:text-[#ffa694] flex items-center gap-1.5 transition-colors cursor-pointer"
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
          <div className="rounded-3xl bg-gradient-to-r from-[#0f294d]/90 via-[#081220] to-[#2a1714]/90 border border-[#296ec2]/30 p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
            <div className="relative z-10 max-w-2xl mx-auto">
              <span className="text-xs uppercase tracking-widest text-[#ff7c62] font-bold font-mono">
                RIT JAPANESE COURSE • 日本語学習
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mt-3">
                Begin Your Journey to Japanese Fluency
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed">
                Connect with your faculty, check your daily timetable, submit coursework, and achieve certified mastery in Japanese.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="btn-spring px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#296ec2] via-[#1b4987] to-[#f06449] hover:from-[#357fd9] hover:to-[#ff7c62] text-white font-extrabold text-sm shadow-xl shadow-[#081220]/80 flex items-center gap-2 cursor-pointer"
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
      <footer className="border-t border-white/5 bg-[#081220] py-8 text-center text-xs text-slate-400 relative z-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-japanese text-xs text-slate-400">千里の行も足下に始まる</span>
            <span className="text-slate-600">•</span>
            <span className="text-xs text-slate-400">A journey of a thousand miles begins with a single step.</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            © 2026 RIT Japanese Course • Department of Foreign Languages & Japanese Studies
          </p>
        </div>
      </footer>
    </div>
  );
}
