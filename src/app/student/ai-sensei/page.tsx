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
  MicOff,
  Lightbulb,
  CheckCircle2,
  Headphones,
  AlertCircle,
  VolumeX,
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
こんにちは！**Sensei AI**へようこそ。マイクボタンを押して、日本語で話しかけてみてくださいね！
*Konnichiwa! Sensei AI e youkoso. Maiku botan o oshite, nihongo de hanashikakete mite kudasai ne!*
(Hello! Welcome to Sensei AI. Press the microphone button and try speaking in Japanese!)

### 2. 📖 Word Bank & Explanations (Vocabulary Builder)
- **Term:** **話しかける** (*hanashikakeru*)
- **Meaning:** To speak to / address someone (Verb, Group 2).
- **Usage Context:** Widely used when starting a conversation: 「先生に話しかけました」(I struck up a conversation with the teacher).

### 3. 🎙️ Accent & Pronunciation Coach
- **Pitch Accent / Rhythm:** **話しかける** is **Nakadaka (drops on "ke")**: [ha-na-shi-ka-KE-ru].
- **Mouth / Tongue Position:** Keep each syllable crisp without trailing off. Japanese vowels are pure and concise.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Speech Synthesis & Recognition state
  const [japaneseVoice, setJapaneseVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<"ja-JP" | "en-US">("ja-JP");
  const [autoSpeakReply, setAutoSpeakReply] = useState(true);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

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

    // Check Speech Recognition support
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Clean Japanese speech text extraction for TTS
  const extractJapaneseText = (fullText: string): string => {
    const block1Match = fullText.match(
      /### 1\. 💬 Conversation[^\n]*\n([\s\S]*?)(?=### 2|$)/i
    );
    const targetSection = block1Match ? block1Match[1] : fullText;

    const lines = targetSection
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        if (!l) return false;
        if (l.startsWith("*") || l.startsWith("(") || l.startsWith("#")) return false;
        return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(l);
      });

    const result = lines.join(" ").replace(/[*_#`\[\]]/g, "");
    return result || targetSection.replace(/[*_#`\[\]()]/g, "").slice(0, 150);
  };

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
    utterance.rate = 0.75;
    if (japaneseVoice) utterance.voice = japaneseVoice;
    window.speechSynthesis.speak(utterance);
  };

  // Start Voice Input via Speech Recognition
  const toggleListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError("Speech Recognition is not supported by your browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      setSpeechError(null);
      const recognition = new SpeechRecognition();
      recognition.lang = speechLang;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputValue(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setSpeechError("Microphone access was denied. Please allow microphone permissions in your browser.");
        } else if (event.error !== "no-speech") {
          setSpeechError(`Speech error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error(err);
      setSpeechError("Could not start microphone. Please try again.");
      setIsListening(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const messageToSend = customText || inputValue.trim();
    if (!messageToSend || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageToSend,
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
      const newMsgId = (Date.now() + 1).toString();
      const replyContent =
        data.reply ||
        "### 1. 💬 Conversation (Voice Output Focus)\nごめんなサイ、理解できませんでした。\n*Gomen nasai, rikai dekimasen deshita.*\n(Pardon, I didn't quite catch that.)";

      const assistantMsg: Message = {
        id: newMsgId,
        role: "assistant",
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-speak response if enabled
      if (autoSpeakReply) {
        setTimeout(() => {
          handleSpeak(replyContent, newMsgId, 0.85);
        }, 200);
      }
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
    "私のアニメを好きです (Test: particle error correction)",
    "昨日は学校で行きました (Test: destination particle error)",
    "大学生活について話しましょう！(Let's chat about college life)",
    "@explain 謙虚 (Explain humility)",
    "私の発音と文法をチェックしてください！(Check my grammar)",
  ];

  // Render structured Sensei response with active mistake correction highlighting
  const renderSenseiMessage = (msg: Message) => {
    const raw = msg.content;

    // Check for Mistake Correction Block
    const hasCorrection = raw.includes("💡 文法・表現の訂正") || raw.includes("💡 表現・文法") || raw.includes("💡 Quick Tip");
    let correctionText = "";
    if (hasCorrection) {
      const match = raw.match(/💡[^\n]*\n([\s\S]*?)(?=### 1|\n\n###|$)/i);
      correctionText = match ? match[1].trim() : "";
    }

    // Check for Praise Block
    const hasPraise = raw.includes("✨") && raw.includes("自然な日本語");

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

    const hasBlocks = !!(convText || wordsText || accentText);

    if (!hasBlocks) {
      return <div className="whitespace-pre-wrap leading-relaxed">{raw}</div>;
    }

    return (
      <div className="space-y-3.5">
        {/* Real-time Mistake Correction Callout */}
        {hasCorrection && correctionText && (
          <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs shadow-lg shadow-amber-950/20">
            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-amber-500/20 text-amber-300 font-bold text-[11px]">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
              💡 文法・表現の訂正 (Sensei's Real-Time Correction & Grammar Tip)
            </div>
            <div className="whitespace-pre-wrap text-xs leading-relaxed space-y-1.5 font-sans">
              {correctionText}
            </div>
          </div>
        )}

        {/* Natural Phrasing Praise Badge */}
        {hasPraise && !hasCorrection && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ✨ 自然な日本語です！ (Natural Phrasing Confirmed)
          </div>
        )}

        {/* Block 1: Conversation Voice Focus */}
        {convText && (
          <div className="p-3.5 rounded-2xl bg-slate-950/75 border border-[#93c5fd]/30 shadow-inner">
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
                title="Play native conversational audio"
              >
                <Volume2 className="w-3.5 h-3.5" />
                {speakingMsgId === msg.id ? "Playing Voice..." : "Play Voice (0.85x)"}
              </button>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100 font-sans">
              {convText}
            </div>
          </div>
        )}

        {/* Block 2: Word Bank */}
        {wordsText && (
          <div className="p-3.5 rounded-2xl bg-[#081220]/80 border border-emerald-500/30">
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
          <div className="p-3.5 rounded-2xl bg-[#081220]/80 border border-[#f06449]/35">
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
              <span className="text-[11px] font-bold text-[#ff7c62] flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#ff7c62]" />
                🎙️ Accent & Pronunciation Coach
              </span>
              {accentTargetWord && (
                <button
                  onClick={() => handleSpeakWord(accentTargetWord)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] bg-[#f06449]/20 hover:bg-[#f06449]/30 text-[#ff7c62] border border-[#f06449]/40 transition-colors cursor-pointer"
                  title="Listen to isolated pitch-accent target"
                >
                  <Headphones className="w-3 h-3" />
                  Practice "{accentTargetWord}" (0.75x)
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

      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-6 lg:p-8 flex flex-col">
        {/* Header with Voice Mode Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10 mb-5 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#f06449]/20 text-[#ff7c62] font-semibold border border-[#f06449]/30 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#ff7c62]" />
                Interactive Voice Partner & Mistake Corrector
              </span>
              {user && (
                <span className="text-xs text-slate-400 font-mono">
                  JLPT {user.courseLevel} Track
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2.5">
              <Bot className="w-6 h-6 sm:w-7 sm:h-7 text-[#93c5fd]" />
              Sensei AI (音声会話パートナー & 添削コーチ)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Speak or type in Japanese. Sensei actively detects grammar/particle mistakes, provides polite corrections, and coaches pitch accent.
            </p>
          </div>

          {/* Voice Mode Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAutoSpeakReply(!autoSpeakReply)}
              className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                autoSpeakReply
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-slate-900 border-white/10 text-slate-400"
              }`}
              title="Toggle automatic speech of Sensei's reply"
            >
              {autoSpeakReply ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Auto-Speak: {autoSpeakReply ? "ON" : "OFF"}</span>
            </button>

            <button
              onClick={() => setSpeechLang(speechLang === "ja-JP" ? "en-US" : "ja-JP")}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-[#93c5fd]/40 text-xs text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Toggle microphone recognition language"
            >
              <span>Mic:</span>
              <span className="font-semibold text-[#93c5fd]">
                {speechLang === "ja-JP" ? "🇯🇵 日本語" : "🇺🇸 English"}
              </span>
            </button>
          </div>
        </div>

        {/* Microphone Error Alert */}
        {speechError && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{speechError}</span>
            </div>
            <button
              onClick={() => setSpeechError(null)}
              className="text-xs underline text-rose-300 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Chat Stream Window */}
        <div className="flex-1 min-h-[480px] bg-slate-900/60 border border-white/10 rounded-3xl p-3 sm:p-6 flex flex-col justify-between overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {messages.map((m) => {
              const isSensei = m.role === "assistant";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 sm:gap-3 ${isSensei ? "justify-start" : "justify-end"}`}
                >
                  {isSensei && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-[#296ec2] to-[#0f294d] border border-[#93c5fd]/30 flex items-center justify-center shrink-0 shadow-md">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-[#93c5fd]" />
                    </div>
                  )}

                  <div
                    className={`max-w-[94%] sm:max-w-[82%] rounded-2xl p-3.5 sm:p-4 text-xs leading-relaxed ${
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
                        <button
                          onClick={() => handleSpeak(m.content, m.id, 0.85)}
                          className="hover:text-white flex items-center gap-1 text-[#93c5fd] transition-colors cursor-pointer"
                          title="Listen to conversational speech"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          {speakingMsgId === m.id ? "Stop Voice" : "Listen (0.85x)"}
                        </button>
                      )}
                    </div>
                  </div>

                  {!isSensei && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
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
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-[#296ec2] to-[#0f294d] border border-[#93c5fd]/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-[#93c5fd] animate-pulse" />
                </div>
                <div className="p-3.5 rounded-2xl bg-[#0b1a2d]/90 border border-[#296ec2]/30 text-slate-400 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ff7c62] animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-[#93c5fd] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
                  Sensei AI is analyzing grammar & formulating response...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="pt-3 border-t border-white/10">
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

            {/* Live Voice Recording Status Banner */}
            {isListening && (
              <div className="mb-2 p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-between text-xs text-rose-200 animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="font-semibold text-white">
                    Listening in {speechLang === "ja-JP" ? "Japanese (日本語)" : "English"}...
                  </span>
                  <span className="text-rose-300 hidden sm:inline">Speak clearly into your microphone</span>
                </div>
                <button
                  onClick={toggleListening}
                  className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer"
                >
                  Stop Recording
                </button>
              </div>
            )}

            {/* Input Bar with Voice Input (Mic) */}
            <form onSubmit={handleSendMessage} className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={toggleListening}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                  isListening
                    ? "bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-600/30 animate-pulse"
                    : "bg-slate-950/80 hover:bg-slate-800 border-white/15 text-[#93c5fd]"
                }`}
                title={isListening ? "Stop listening" : `Start Voice Input (${speechLang})`}
              >
                {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-[#93c5fd]" />}
              </button>

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  isListening
                    ? "Speaking... (Your speech appears here)"
                    : "Speak or type in Japanese, or try an intentional mistake to test correction..."
                }
                className="flex-1 bg-slate-950/80 border border-white/15 focus:border-[#f06449] rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none transition-colors"
              />

              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="px-4 sm:px-5 py-3 rounded-2xl bg-[#f06449] hover:bg-[#d9533a] disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-[#f06449]/20 cursor-pointer shrink-0"
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
