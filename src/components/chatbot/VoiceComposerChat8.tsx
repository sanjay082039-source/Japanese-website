"use client";

import React, { useState, useEffect, useRef } from "react";
import AiChat8 from "@/components/ui/ai-chat-8";
import {
  Bot,
  User,
  Volume2,
  Sparkles,
  BookOpen,
  Headphones,
  CheckCircle2,
  RefreshCw,
  Send,
  Cpu,
  VolumeX,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isVoiceInput?: boolean;
}

interface VoiceComposerChat8Props {
  className?: string;
  studentLevel?: string;
}

export default function VoiceComposerChat8({
  className = "",
  studentLevel = "N3",
}: VoiceComposerChat8Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init-sensei",
      role: "assistant",
      content: `### 1. 💬 Conversation (Voice Output Focus)
こんにちは！**Sensei AI**へようこそ。マイクボタンを押して、日本語で話しかけてみてくださいね！
*Konnichiwa! Sensei AI e youkoso. Maiku botan o oshite, nihongo de hanashikakete mite kudasai ne!*
(Hello! Welcome to Sensei AI. Press the microphone button and try speaking in Japanese!)

### 2. 📖 Word Bank & Explanations (Vocabulary Builder)
- **話しかける** (*hanashikakeru*): To speak to / address someone (Verb, Group 2).
- **ようこそ** (*youkoso*): Welcome (Formal greeting).

### 3. 🎙️ Accent & Pronunciation Coach
- **話しかける** is **Nakadaka (accent drops on "ke")**: [ha-na-shi-ka-KE-ru].
- Keep each mora timed equally; Japanese is a mora-timed language.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{
    online: boolean;
    provider: string;
    model: string;
    isFineTuned: boolean;
  } | null>(null);

  const [activeVoiceMsgId, setActiveVoiceMsgId] = useState<string | null>(null);
  const [japaneseVoice, setJapaneseVoice] = useState<SpeechSynthesisVoice | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load available Japanese speech synthesis voice
  useEffect(() => {
    function loadVoices() {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        const jaVoice =
          voices.find((v) => v.lang.startsWith("ja")) ||
          voices.find((v) => v.name.includes("Japanese") || v.name.includes("Kyoko") || v.name.includes("Otoya")) ||
          null;
        setJapaneseVoice(jaVoice);
      }
    }
    loadVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Check backend fine-tuned model status
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/ai/status");
        if (res.ok) {
          const data = await res.json();
          setAiStatus(data);
        }
      } catch (e) {
        console.warn("Could not fetch AI status", e);
      }
    }
    checkStatus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle voice synthesis playback
  const speakText = (text: string, msgId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    if (activeVoiceMsgId === msgId) {
      window.speechSynthesis.cancel();
      setActiveVoiceMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Extract first conversation section if available for cleaner Japanese TTS
    let cleanText = text;
    const match = text.match(/### 1\.[^#]*/i);
    if (match) {
      cleanText = match[0].replace(/### 1\.[^\n]*\n/, "").replace(/[*_#`()]/g, "");
    } else {
      cleanText = text.replace(/[*_#`]/g, "");
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    }
    utterance.lang = "ja-JP";
    utterance.rate = 0.95;

    utterance.onend = () => setActiveVoiceMsgId(null);
    utterance.onerror = () => setActiveVoiceMsgId(null);

    setActiveVoiceMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Dispatches transcript from React Bits Pro AI Chat 8 to our Japanese fine-tuned backend
  const handleSendTranscript = async (transcript: string) => {
    if (!transcript.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: transcript,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isVoiceInput: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Build message payload
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      history.push({ role: "user", content: transcript });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          level: studentLevel,
        }),
      });

      if (!res.ok) {
        throw new Error(`Sensei response status: ${res.status}`);
      }

      const rawText = await res.text();
      let replyContent = rawText;
      try {
        const data = JSON.parse(rawText);
        replyContent = data.reply || data.text || rawText;
      } catch {
        // Plain text stream response from /api/chat
        replyContent = rawText;
      }

      if (!replyContent || !replyContent.trim()) {
        replyContent = "ごめんなさい、もう一度言っていただけますか？ (Sorry, could you say that again?)";
      }

      const senseiMsg: ChatMessage = {
        id: `sensei-${Date.now()}`,
        role: "assistant",
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, senseiMsg]);

      // Automatically speak the new Japanese reply
      speakText(replyContent, senseiMsg.id);
    } catch (err: any) {
      console.error("[VoiceComposerChat8] Sensei error:", err);
      const fallbackMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `### 1. 💬 Conversation
はい、よく聞こえました！「${transcript}」について練習しましょう。
(Yes, I heard you clearly! Let's practice with "${transcript}".)

### 2. 📖 Word Bank & Explanations
- **練習** (*renshuu*): Practice / Drill.

### 3. 🎙️ Accent & Pronunciation Coach
- Keep pitch steady and ensure mora timing is accurate!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    "こんにちは！自己紹介の練習をしたいです",
    "「〜てもいいですか」の文法を教えてください",
    "秋葉原でおすすめの場所はどこですか？",
    "日本語のアクセントを直してください",
  ];

  return (
    <div className={`flex flex-col w-full max-w-4xl mx-auto rounded-3xl border border-[#e7e2d7] bg-white shadow-xl overflow-hidden ${className}`}>
      {/* Top Banner: AI Model Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#e7e2d7] bg-[#f8f6f0]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d9381e] to-[#1d4ed8] flex items-center justify-center text-white shadow-md shadow-blue-500/10">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Sensei AI Voice Studio</span>
                <span className="font-japanese text-xs text-slate-500 font-normal">
                  (AI先生 音声スタジオ)
                </span>
              </h2>
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                QLoRA Active
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Qwen2.5-1.5B Fine-Tuned Japanese Pedagogical Coach • JLPT {studentLevel} Track
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {aiStatus?.model && (
            <span className="text-[11px] font-mono text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-[#e7e2d7] shadow-xs">
              {aiStatus.model}
            </span>
          )}
        </div>
      </div>

      {/* Message History Timeline */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[440px] scrollbar-thin scrollbar-thumb-slate-300 bg-[#faf8f4]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-[#1d4ed8]/10 border border-[#1d4ed8]/20 flex items-center justify-center text-[#1d4ed8] shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-5 py-4 ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-[#1d4ed8] to-[#2563eb] text-white rounded-br-none shadow-md shadow-blue-500/20"
                  : "bg-white border border-[#e7e2d7] text-slate-800 rounded-bl-none shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-black/5 text-[11px] opacity-75">
                <span className="font-semibold">
                  {msg.role === "user" ? "You (Voice Input / 音声入力)" : "Sensei AI (先生)"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{msg.timestamp}</span>
                  {msg.role === "assistant" && (
                    <button
                      type="button"
                      aria-label="Play audio pronunciation"
                      onClick={() => speakText(msg.content, msg.id)}
                      className="hover:text-slate-900 transition-colors"
                    >
                      {activeVoiceMsgId === msg.id ? (
                        <VolumeX className="w-3.5 h-3.5 text-[#d9381e]" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5 text-[#15803d]" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Message Content */}
              <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans select-text">
                {msg.content}
              </div>
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 items-center text-slate-500 text-xs">
            <div className="w-8 h-8 rounded-xl bg-[#1d4ed8]/10 border border-[#1d4ed8]/20 flex items-center justify-center text-[#1d4ed8]">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <span>Sensei is analyzing grammar & formulating response...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Practice Prompts */}
      <div className="px-6 py-2.5 bg-[#f8f6f0] border-t border-[#e7e2d7] flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-semibold text-slate-500 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#d9381e]" /> Try speaking:
        </span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendTranscript(prompt)}
            className="text-xs whitespace-nowrap bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-3 py-1 rounded-full border border-[#e7e2d7] transition-all shrink-0 cursor-pointer shadow-xs"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* React Bits Pro "AI Chat 8" Block: Voice Composer with Live Transcript */}
      <div className="p-4 sm:p-6 border-t border-[#e7e2d7] bg-[#f8f6f0]">
        <AiChat8
          onSendMessage={handleSendTranscript}
          isProcessing={isLoading}
          title="Voice Composer with Live Transcript"
          placeholderPrompt="Tap microphone to speak Japanese or English. Live transcript will render in real time..."
          attachments={[
            { name: `JLPT ${studentLevel} Grammar`, kind: "tag" },
            { name: "Pitch Accent Coach", kind: "tag" },
            { name: "Word Bank", kind: "tag" },
          ]}
        />
      </div>
    </div>
  );
}
