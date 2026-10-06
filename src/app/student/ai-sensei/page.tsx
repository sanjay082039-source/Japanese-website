"use client";

import React, { useState, useEffect, useRef } from "react";
import Navbar from "@/components/navigation/Navbar";
import { UserSession } from "@/lib/types";
import {
  Bot,
  Send,
  Volume2,
  Sparkles,
  BookOpen,
  Mic,
  Lightbulb,
  CheckCircle2,
  Headphones,
  RotateCcw,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export default function AiSenseiPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-sensei",
      role: "assistant",
      content: `### 1. 💬 Conversation (Voice Output Focus)
こんにちは！**Sensei AI**へようこそ。大学の講義や日常会話、JLPT対策を楽しく一緒に練習しましょう！
*Konnichiwa! Sensei AI e youkoso. Daigaku no kougi ya nichijou kaiwa, JLPT taisaku o tanoshiku issho ni renshuu shimashou!*
(Hello! Welcome to Sensei AI. Let's enjoy practicing university lectures, daily conversations, and JLPT preparation together!)

### 2. 📖 Word Bank & Explanations (Vocabulary Builder)
- **Term:** **講義** (*kougi*)
- **Meaning:** University lecture / academic class (Noun).
- **Usage Context:** Essential for college students: 「今日の午後は日本語の講義があります」(I have a Japanese lecture this afternoon).

### 3. 🎙️ Accent & Pronunciation Coach
- **Pitch Accent / Rhythm:** **講義** (*kougi*) is **Atamadaka (head-high)**: [KO-u-gi]. High pitch on the initial mora "ko", then drops smoothly down on "ugi".
- **Mouth / Tongue Position:** Keep the long "ō" vowel steady for two full morae (ko-o) without closing into an English "w" glide.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Japanese Voice synthesis loader
  const [japaneseVoice, setJapaneseVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadUser();

    // Voice loader with onvoiceschanged listener
    const updateVoices = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        const jVoice =
          voices.find((v) => v.lang.startsWith("ja")) ||
          voices.find(
            (v) =>
              v.name.toLowerCase().includes("japanese") ||
              v.name.toLowerCase().includes("japan")
          );
        if (jVoice) setJapaneseVoice(jVoice);
      }
    };

    updateVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Extract clean Japanese conversation lines for TTS
  const extractJapaneseText = (fullText: string): string => {
    // If structured in Block 1
    const block1Match = fullText.match(
      /### 1\. 💬 Conversation[^\n]*\n([\s\S]*?)(?=### 2|$)/i
    );
    const targetSection = block1Match ? block1Match[1] : fullText;

    const lines = targetSection
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        // Exclude lines starting with * (romaji), ( (translations), or headers
        if (!l) return false;
        if (l.startsWith("*") || l.startsWith("(") || l.startsWith("#")) return false;
        // Check if line contains Japanese characters
        return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(l);
      });

    const result = lines.join(" ").replace(/[*_#`\[\]]/g, "");
    return result || targetSection.replace(/[*_#`\[\]()]/g, "").slice(0, 150);
  };

  // Extract the target term from Accent Coach for isolated pronunciation practice
  const extractAccentTarget = (fullText: string): string => {
    const block3Match = fullText.match(
      /### 3\. 🎙️ Accent[^\n]*\n([\s\S]*?)$/i
    );
    if (!block3Match) return "";
    const termMatch = block3Match[1].match(/\*\*([^\*]+)\*\*/);
    return termMatch ? termMatch[1] : "";
  };

  const handleSpeak = (text: string, msgId: string, speed: number = 0.85) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    if (speakingMsgId === msgId) {
      setSpeakingMsgId(null);
      return;
    }

    const cleanJa = extractJapaneseText(text);
    if (!cleanJa) return;

    const utterance = new SpeechSynthesisUtterance(cleanJa);
    utterance.lang = "ja-JP";
    utterance.rate = speed;
    if (japaneseVoice) utterance.voice = japaneseVoice;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSpeakWord = (word: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !word) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "ja-JP";
    utterance.rate = 0.75; // Slower cadence for accent coaching
    if (japaneseVoice) utterance.voice = japaneseVoice;
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/sensei", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg.content,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error("Sensei AI is currently unavailable.");
      }

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          data.reply ||
          "### 1. 💬 Conversation (Voice Output Focus)\nごめんなさい、理解できませんでした。\n*Gomen nasai, rikai dekimasen deshita.*\n(Pardon, I didn't quite catch that.)",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            "先生は現在他の学生と対応中です。もう一度お試しください。\n(Error connecting to Sensei AI. Please check your network connection.)",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "@explain 謙虚 (Humble)",
    "@explain 頑張る (Do one's best)",
    "大学生活について話しましょう！(Let's chat about university life)",
    "今日のJLPT重要単語と発音を教えて (Teach me today's JLPT words & pronunciation)",
    "私の日本語文法をチェックしてください (Check my Japanese grammar & phrasing)",
  ];

  // Helper to render structured assistant response
  const renderSenseiMessage = (msg: Message) => {
    const raw = msg.content;

    // Check for Quick Tip line
    const quickTipMatch = raw.match(/💡\s*Quick Tip:\s*([^\n]+)/i);
    const quickTip = quickTipMatch ? quickTipMatch[1] : null;

    // Split blocks if present
    const hasBlocks = raw.includes("### 1. 💬") || raw.includes("### 2. 📖") || raw.includes("### 3. 🎙️");

    if (!hasBlocks) {
      return (
        <div className="space-y-2">
          {quickTip && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-amber-300">Quick Tip:</strong> {quickTip}
              </div>
            </div>
          )}
          <div className="whitespace-pre-wrap leading-relaxed">{raw}</div>
        </div>
      );
    }

    const conversationMatch = raw.match(
      /### 1\. 💬 Conversation[^\n]*\n([\s\S]*?)(?=### 2\. 📖|$)/i
    );
    const wordBankMatch = raw.match(
      /### 2\. 📖 Word Bank[^\n]*\n([\s\S]*?)(?=### 3\. 🎙️|$)/i
    );
    const accentCoachMatch = raw.match(/### 3\. 🎙️ Accent[^\n]*\n([\s\S]*?)$/i);

    const convText = conversationMatch ? conversationMatch[1].trim() : "";
    const wordsText = wordBankMatch ? wordBankMatch[1].trim() : "";
    const accentText = accentCoachMatch ? accentCoachMatch[1].trim() : "";
    const accentTargetWord = extractAccentTarget(raw);

    return (
      <div className="space-y-3">
        {/* Quick Correction Tip if present */}
        {quickTip && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="font-semibold text-amber-300">Quick Tip:</strong> {quickTip}
            </div>
          </div>
        )}

        {/* Block 1: Conversation */}
        {convText && (
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-[#93c5fd]/25">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
              <span className="text-[11px] font-bold text-[#93c5fd] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#93c5fd] animate-pulse"></span>
                💬 Conversation (Voice Output Focus)
              </span>
              <button
                onClick={() => handleSpeak(raw, msg.id, 0.85)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  speakingMsgId === msg.id
                    ? "bg-[#f06449] text-white animate-pulse"
                    : "bg-[#296ec2]/30 hover:bg-[#296ec2]/50 text-[#93c5fd] border border-[#93c5fd]/30"
                }`}
                title="Play voice output at natural cadence"
              >
                <Volume2 className="w-3.5 h-3.5" />
                {speakingMsgId === msg.id ? "Playing Voice..." : "Play Voice"}
              </button>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100 font-sans">
              {convText}
            </div>
          </div>
        )}

        {/* Block 2: Word Bank */}
        {wordsText && (
          <div className="p-3 rounded-2xl bg-[#081220]/80 border border-emerald-500/25">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 pb-2 mb-2 border-b border-white/10">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              📖 Word Bank & Explanations (Vocabulary Builder)
            </div>
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
              {wordsText}
            </div>
          </div>
        )}

        {/* Block 3: Accent Coach */}
        {accentText && (
          <div className="p-3 rounded-2xl bg-[#081220]/80 border border-[#f06449]/30">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
              <span className="text-[11px] font-bold text-[#ff7c62] flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#ff7c62]" />
                🎙️ Accent & Pronunciation Coach
              </span>
              {accentTargetWord && (
                <button
                  onClick={() => handleSpeakWord(accentTargetWord)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] bg-[#f06449]/20 hover:bg-[#f06449]/30 text-[#ff7c62] border border-[#f06449]/40 transition-colors cursor-pointer"
                  title="Listen to isolated pitch-accent target"
                >
                  <Headphones className="w-3 h-3" />
                  Practice "{accentTargetWord}"
                </button>
              )}
            </div>
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
              {accentText}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#081220] text-slate-100 flex flex-col">
      {user && <Navbar user={user} />}

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10 mb-6 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#f06449]/20 text-[#ff7c62] font-semibold border border-[#f06449]/30 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#ff7c62]" />
                Collegiate Japanese Partner & Pronunciation Coach
              </span>
              {user && (
                <span className="text-xs text-slate-400 font-mono">
                  JLPT {user.courseLevel} Track
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2.5">
              <Bot className="w-7 h-7 text-[#93c5fd]" />
              Sensei AI (日本語パートナー & 発音コーチ)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Natural conversation partner, active vocabulary builder, and pitch-accent pronunciation coach. Use{" "}
              <code className="text-[#ff7c62] bg-[#f06449]/10 px-1 py-0.5 rounded font-mono">
                @explain &lt;word&gt;
              </code>{" "}
              for contextual breakdowns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {japaneseVoice ? `Native Voice (${japaneseVoice.name.slice(0, 16)})` : "WebSpeech Active"}
            </span>
          </div>
        </div>

        {/* Chat Stream Window */}
        <div className="flex-1 min-h-[500px] bg-slate-900/60 border border-white/10 rounded-3xl p-4 sm:p-6 flex flex-col justify-between overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {messages.map((m) => {
              const isSensei = m.role === "assistant";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isSensei ? "justify-start" : "justify-end"}`}
                >
                  {isSensei && (
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#296ec2] to-[#0f294d] border border-[#93c5fd]/30 flex items-center justify-center shrink-0 shadow-md">
                      <Bot className="w-5 h-5 text-[#93c5fd]" />
                    </div>
                  )}

                  <div
                    className={`max-w-[92%] sm:max-w-[82%] rounded-2xl p-4 text-xs leading-relaxed ${
                      isSensei
                        ? "bg-[#0b1a2d]/90 border border-[#296ec2]/30 text-slate-200"
                        : "bg-[#f06449] text-white font-medium shadow-lg shadow-[#f06449]/20"
                    }`}
                  >
                    {isSensei ? (
                      renderSenseiMessage(m)
                    ) : (
                      <div className="whitespace-pre-wrap font-sans text-sm">{m.content}</div>
                    )}

                    <div className="flex items-center justify-between gap-4 mt-3 pt-2 border-t border-white/10 text-[10px] text-slate-400">
                      <span>{m.timestamp}</span>
                      {isSensei && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleSpeak(m.content, m.id, 0.85)}
                            className="hover:text-white flex items-center gap-1 text-[#93c5fd] transition-colors cursor-pointer"
                            title="Listen to conversational speech"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            {speakingMsgId === m.id ? "Stop Voice" : "Listen (0.85x)"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isSensei && (
                    <div className="w-9 h-9 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-slate-300">
                        {user?.name ? user.name[0] : "Me"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#296ec2] to-[#0f294d] border border-[#93c5fd]/30 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-[#93c5fd] animate-pulse" />
                </div>
                <div className="p-3.5 rounded-2xl bg-[#0b1a2d]/90 border border-[#296ec2]/30 text-slate-400 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ff7c62] animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-[#93c5fd] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
                  Sensei AI is formulating response & pitch-accent guidance...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-[#ff7c62]" /> Quick Prompts:
              </span>
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputValue(p)}
                  className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-[11px] text-slate-300 whitespace-nowrap transition-colors cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask in Japanese, practice conversation, or type @explain <word>..."
                className="flex-1 bg-slate-950/80 border border-white/15 focus:border-[#f06449] rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="px-5 py-3 rounded-2xl bg-[#f06449] hover:bg-[#d9533a] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-[#f06449]/20 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
