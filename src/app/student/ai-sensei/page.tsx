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
  HelpCircle,
  Lightbulb,
  CheckCircle2,
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
      content:
        "こんにちは！RIT Senseiです。JLPTの勉強や日本語の会話、分からない単語の質問など、何でも気軽に聞いてくださいね。\n\n💡 **Tip:** Unfamiliar word? Type `@explain <word>` (e.g. `@explain 謙虚` or `@explain 食べる`) for instant kanji, readings, meanings, and example sentences!",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Japanese Voice synthesis loader
  const [japaneseVoice, setJapaneseVoice] = useState<SpeechSynthesisVoice | null>(null);

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
          voices.find((v) => v.name.toLowerCase().includes("japanese") || v.name.toLowerCase().includes("japan"));
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

  const handleSpeak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    // Strip markdown tags for clean pronunciation
    const cleanText = text
      .replace(/###|##|#|\*|_|`|\[.*?\]|\(.*?\)/g, "")
      .replace(/English Meaning[\s\S]*$/, "") // Speak primary Japanese portion
      .slice(0, 300);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ja-JP";
    utterance.rate = 0.85; // Natural study pace
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
        throw new Error("AI Sensei is currently unavailable.");
      }

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || "ごめんなさい、理解できませんでした。(Pardon, I didn't quite catch that.)",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "先生は現在他の学生と対応中です。もう一度お試しください。(Error connecting to AI Sensei. Please check your network.)",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "@explain 感謝",
    "@explain 一期一会",
    "今日のおすすめの文法を教えてください。(Teach me today's grammar)",
    "JLPTの勉強方法を教えてください。(Tips for JLPT study)",
  ];

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
                Conversational Language Partner
              </span>
              {user && (
                <span className="text-xs text-slate-400 font-mono">
                  Adapted to JLPT {user.courseLevel}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1 flex items-center gap-2.5">
              <Bot className="w-7 h-7 text-[#93c5fd]" />
              RIT AI Sensei (日本語パートナー)
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Practice conversational Japanese, ask grammar questions, and use{" "}
              <code className="text-[#ff7c62] bg-[#f06449]/10 px-1 py-0.5 rounded">@explain &lt;word&gt;</code> for comprehensive vocabulary breakdowns.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {japaneseVoice ? "Native Voice Ready" : "WebSpeech Active"}
            </span>
          </div>
        </div>

        {/* Chat Stream Window */}
        <div className="flex-1 min-h-[480px] bg-slate-900/60 border border-white/10 rounded-3xl p-4 sm:p-6 flex flex-col justify-between overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed ${
                      isSensei
                        ? "bg-[#0b1a2d]/90 border border-[#296ec2]/30 text-slate-200"
                        : "bg-[#f06449] text-white font-medium shadow-lg shadow-[#f06449]/20"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                    <div className="flex items-center justify-between gap-4 mt-3 pt-2 border-t border-white/10 text-[10px] text-slate-400">
                      <span>{m.timestamp}</span>
                      {isSensei && (
                        <button
                          onClick={() => handleSpeak(m.content)}
                          className="hover:text-white flex items-center gap-1 text-[#93c5fd] transition-colors cursor-pointer"
                          title="Listen to native pronunciation"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          Listen Pronunciation
                        </button>
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
                  Sensei is formulating an answer...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
                <Lightbulb className="w-3 h-3 text-[#ff7c62]" /> Suggestions:
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
                placeholder="Ask in Japanese or type @explain <word>..."
                className="flex-1 bg-slate-950/80 border border-white/15 focus:border-[#f06449] rounded-2xl px-4 py-3 text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="px-5 py-3 rounded-2xl bg-[#f06449] hover:bg-[#d9533a] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-[#f06449]/20 cursor-pointer"
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
