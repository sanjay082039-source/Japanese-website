"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { UserSession } from "@/lib/types";
import {
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Bot,
  HelpCircle,
  Eye,
  EyeOff,
  Gauge,
  Check,
  ShieldCheck,
  Globe,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const STORAGE_KEY = "sensei_chat_history_v1";

const QUICK_CHIPS = [
  { label: "Explain this grammar", prompt: "Could you explain the difference between particles は (wa) and が (ga)?" },
  { label: "Check my sentence", prompt: "Can you check my sentence: わたしは日本のアニメを好きです。" },
  { label: "Quiz me", prompt: "Please give me a JLPT N5 grammar or particle quiz question!" },
  { label: "Kanji help", prompt: "Teach me an essential college kanji with stroke order and example words." },
  { label: "Pronunciation tips", prompt: "What are the most important pitch-accent and pronunciation tips for Japanese?" },
];

export default function ChatbotWidget() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);


  // Bilingual Display Toggles
  const [showFurigana, setShowFurigana] = useState(true);
  const [showRomaji, setShowRomaji] = useState(true);

  // Audio / TTS state
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [ttsSpeed, setTtsSpeed] = useState<0.75 | 1 | 1.25>(1);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [japaneseVoice, setJapaneseVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [englishVoice, setEnglishVoice] = useState<SpeechSynthesisVoice | null>(null);

  // Voice Input / STT state
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState<"ja-JP" | "en-US" | "auto">("ja-JP");
  const [sttSupported, setSttSupported] = useState(true);
  const [sttError, setSttError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Load voices and session storage
  useEffect(() => {
    // 1. Session Storage
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          } else {
            setInitialWelcome();
          }
        } else {
          setInitialWelcome();
        }
      } catch {
        setInitialWelcome();
      }
    }

    // 2. Web Speech TTS Voices
    const updateVoices = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        const ja =
          voices.find((v) => v.lang.startsWith("ja")) ||
          voices.find((v) => v.name.toLowerCase().includes("japanese") || v.name.toLowerCase().includes("japan"));
        const en =
          voices.find((v) => v.lang === "en-US") ||
          voices.find((v) => v.lang.startsWith("en"));

        if (ja) setJapaneseVoice(ja);
        if (en) setEnglishVoice(en);
      }
    };

    updateVoices();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    // 3. Web Speech STT Check
    if (typeof window !== "undefined") {
      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRec) {
        setSttSupported(false);
      }
    }
  }, []);

  // Check user authentication session on mount and route changes
  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setUser(data.user);
        } else {
          if (isMounted) setUser(null);
        }
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setAuthChecked(true);
      }
    }
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [pathname]);


  // Save to Session Storage
  useEffect(() => {
    if (messages.length > 0 && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.warn("Could not save chat history to sessionStorage:", e);
      }
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, isOpen]);

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const setInitialWelcome = () => {
    setMessages([
      {
        id: "welcome-msg",
        role: "assistant",
        content: `### 🌸 こんにちは！ Welcome to Sensei Bot

I'm your college Japanese tutor. Feel free to ask about grammar, vocabulary, kanji, pronunciation, particles, or JLPT practice!

- **Japanese:** 「何でも気軽に質問してください」
- **Reading:** [なんでも きがるに しつもん してください]
- **Romaji:** *Nandemo kigaru ni shitsumon shite kudasai*
- **Meaning:** "Please ask anything feel free to ask!"
- **Grammar Note:** **〜てください (-te kudasai)** is the standard polite request form built from the verb te-form.

Click any quick-action chip below or ask your own question in English or Japanese!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const clearChat = () => {
    if (window.confirm("Clear this session's conversation history?")) {
      sessionStorage.removeItem(STORAGE_KEY);
      setInitialWelcome();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingMessageId(null);
    }
  };

  // Voice Input (Web Speech Recognition)
  const toggleListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setSttError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      setSttError(null);
      const recognition = new SpeechRec();
      const actualLang = speechLang === "auto" ? "ja-JP" : speechLang;
      recognition.lang = actualLang;
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
        if (event.error === "not-allowed") {
          setSttError("Microphone permission was denied. Please allow microphone access.");
        } else if (event.error !== "no-speech") {
          setSttError(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e: any) {
      setSttError("Unable to access microphone.");
      setIsListening(false);
    }
  };

  // Voice Output (SpeechSynthesis)
  const handlePlayVoice = (text: string, msgId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    if (speakingMessageId === msgId) {
      setSpeakingMessageId(null);
      return;
    }

    // Extract Japanese portions or clean sentences
    const cleanLines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => !l.startsWith("###") && !l.startsWith("##") && !l.startsWith("#"))
      .join(" ")
      .replace(/[*_#`\[\]]/g, "")
      .slice(0, 450);

    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleanLines);
    const utterance = new SpeechSynthesisUtterance(cleanLines);

    if (hasJapanese) {
      utterance.lang = "ja-JP";
      if (japaneseVoice) utterance.voice = japaneseVoice;
    } else {
      utterance.lang = "en-US";
      if (englishVoice) utterance.voice = englishVoice;
    }

    utterance.rate = ttsSpeed;
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    setSpeakingMessageId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Send Message with Streaming Response
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputValue).trim();
    if (!prompt || isStreaming) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue("");
    setIsStreaming(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Unable to reach Sensei Bot.");
      }

      if (!response.body) {
        throw new Error("No response body received from server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, content: accumulated } : msg
          )
        );
      }

      // Auto-read response if enabled
      if (isTtsEnabled && accumulated) {
        setTimeout(() => {
          handlePlayVoice(accumulated, assistantMsgId);
        }, 150);
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: `⚠️ ${err.message || "Something went wrong while connecting to Sensei Bot. Please try again."}`,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  // Filter content based on Bilingual display toggles (Romaji / Furigana)
  const formatBilingualContent = (raw: string) => {
    let text = raw;

    // Filter Furigana/Reading lines: e.g. - **Reading:** [ひらがな]
    if (!showFurigana) {
      text = text.replace(/(\*+Reading:\*+\s*\[.*?\]\n?)/gi, "");
    }

    // Filter Romaji lines: e.g. - **Romaji:** *romaji*
    if (!showRomaji) {
      text = text.replace(/(\*+Romaji:\*+\s*\*.*?\*\n?)/gi, "");
    }

    return text;
  };

  // Only render the chatbot widget when the student or staff is logged in and not on /login
  if (!user || pathname === "/login") {
    return null;
  }

  return (
    <>
      {/* Floating Bottom-Right Launcher Button */}
      <div className="fixed bottom-5 right-5 z-50">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open Sensei Bot Japanese tutor chat"
            aria-expanded={isOpen}
            aria-controls="sensei-chatbot-panel"
            className="group relative flex items-center gap-2.5 px-4 py-3.5 rounded-full bg-gradient-to-r from-[#081220] via-[#10243e] to-[#f06449] border border-[#f06449]/50 text-white shadow-2xl hover:shadow-[#f06449]/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <div className="relative">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-ping"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5"></span>
              <Bot className="w-6 h-6 text-[#93c5fd]" />
            </div>

            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold leading-tight flex items-center gap-1">
                <span>Sensei Bot</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#f06449]/20 text-[#ff7c62] border border-[#f06449]/30 font-mono">
                  AI Tutor
                </span>
              </div>
              <div className="text-[10px] text-slate-300">Ask Japanese Questions</div>
            </div>

            <span className="sr-only">Open Japanese Tutor Chat</span>
          </button>
        )}
      </div>

      {/* Floating Chat Modal Panel */}
      {isOpen && (
        <div
          id="sensei-chatbot-panel"
          ref={panelRef}
          role="dialog"
          aria-label="Sensei Bot Japanese Tutor"
          aria-modal="true"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-32px)] max-w-sm sm:max-w-md h-[580px] max-h-[88vh] bg-[#081220]/95 backdrop-blur-2xl border border-[#296ec2]/35 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-900/90 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#296ec2] to-[#0f294d] border border-[#93c5fd]/30 flex items-center justify-center shrink-0 shadow-md">
                <Bot className="w-5 h-5 text-[#93c5fd]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-sm font-extrabold text-white tracking-tight">Sensei Bot</h2>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {user.name} • {user.courseLevel ? `JLPT ${user.courseLevel} Track` : "RIT Japanese Tutor"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                aria-label="Clear chat history"
                title="Clear chat"
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close Sensei Bot"
                title="Close (Esc)"
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Bilingual & Voice Controls Toolbar */}
          <div className="px-3.5 py-2 bg-slate-950/60 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300 shrink-0">
            {/* Bilingual Display Toggles */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowFurigana(!showFurigana)}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer ${
                  showFurigana
                    ? "bg-[#296ec2]/30 border-[#93c5fd]/40 text-[#93c5fd]"
                    : "bg-slate-900 border-white/10 text-slate-400"
                }`}
                title="Toggle Furigana reading display"
              >
                {showFurigana ? "Furigana: ON" : "Furigana: OFF"}
              </button>

              <button
                onClick={() => setShowRomaji(!showRomaji)}
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-medium transition-colors cursor-pointer ${
                  showRomaji
                    ? "bg-[#296ec2]/30 border-[#93c5fd]/40 text-[#93c5fd]"
                    : "bg-slate-900 border-white/10 text-slate-400"
                }`}
                title="Toggle Romaji phonetic alphabet display"
              >
                {showRomaji ? "Romaji: ON" : "Romaji: OFF"}
              </button>
            </div>

            {/* Voice Read-Aloud & Speed Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsTtsEnabled(!isTtsEnabled)}
                className={`p-1 rounded-lg border transition-colors cursor-pointer ${
                  isTtsEnabled
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-900 border-white/10 text-slate-400"
                }`}
                title={isTtsEnabled ? "Mute automatic replies" : "Enable automatic voice reply"}
              >
                {isTtsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>

              {/* Speed Selector */}
              <button
                onClick={() => {
                  if (ttsSpeed === 0.75) setTtsSpeed(1);
                  else if (ttsSpeed === 1) setTtsSpeed(1.25);
                  else setTtsSpeed(0.75);
                }}
                className="px-1.5 py-0.5 rounded-lg bg-slate-900 border border-white/10 hover:border-[#93c5fd]/40 text-[10px] text-slate-300 transition-colors cursor-pointer"
                title="Change TTS voice playback speed"
              >
                {ttsSpeed}x
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-700">
            {messages.map((m) => {
              const isAssistant = m.role === "assistant";
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  {isAssistant && (
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#296ec2] to-[#0f294d] border border-[#93c5fd]/30 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Bot className="w-4 h-4 text-[#93c5fd]" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] sm:max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      isAssistant
                        ? "bg-[#0b1a2d]/90 border border-[#296ec2]/30 text-slate-200"
                        : "bg-[#f06449] text-white font-medium shadow-md shadow-[#f06449]/20"
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">
                      {isAssistant ? formatBilingualContent(m.content) : m.content}
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-2 pt-1.5 border-t border-white/10 text-[10px] text-slate-400">
                      <span>{m.timestamp}</span>
                      {isAssistant && m.content && (
                        <button
                          onClick={() => handlePlayVoice(m.content, m.id)}
                          className="hover:text-white flex items-center gap-1 text-[#93c5fd] transition-colors cursor-pointer"
                          title="Read message aloud"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>{speakingMessageId === m.id ? "Stop" : "Play"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing / Streaming Indicator */}
            {isStreaming && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#296ec2] to-[#0f294d] border border-[#93c5fd]/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-[#93c5fd] animate-pulse" />
                </div>
                <div className="px-3 py-2 rounded-2xl bg-[#0b1a2d]/90 border border-[#296ec2]/30 text-slate-400 text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f06449] animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#93c5fd] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></span>
                  <span className="text-[11px] ml-1">Sensei is formulating answer...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick-Action Chips */}
          <div className="px-3 py-1.5 bg-slate-950/70 border-t border-white/5 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5 text-[#f06449]" /> Topics:
              </span>
              {QUICK_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip.prompt)}
                  disabled={isStreaming}
                  className="px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 disabled:opacity-50 border border-white/10 text-[10px] text-slate-300 hover:text-white whitespace-nowrap transition-colors cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* STT Error Alert */}
          {sttError && (
            <div className="px-3 py-1.5 bg-rose-500/20 text-rose-200 text-[10px] border-t border-rose-500/30 flex items-center justify-between">
              <span>{sttError}</span>
              <button onClick={() => setSttError(null)} className="underline cursor-pointer">
                Dismiss
              </button>
            </div>
          )}

          {/* Input Bar & Voice Controls */}
          <div className="p-3 bg-slate-900 border-t border-white/10 shrink-0">
            {isListening && (
              <div className="mb-2 px-2.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="text-[11px] font-semibold text-white">
                    Listening ({speechLang === "ja-JP" ? "Japanese" : speechLang === "en-US" ? "English" : "Auto"})...
                  </span>
                </div>
                <button
                  onClick={toggleListening}
                  className="text-[10px] px-2 py-0.5 rounded bg-rose-600 text-white font-bold cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* STT Mic Button with Graceful Fallback */}
              {sttSupported ? (
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={toggleListening}
                    aria-label={isListening ? "Stop voice recording" : "Start voice recording"}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isListening
                        ? "bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-600/30 animate-pulse"
                        : "bg-slate-950 hover:bg-slate-800 border-white/15 text-[#93c5fd]"
                    }`}
                    title={isListening ? "Stop listening" : `Voice Input (${speechLang})`}
                  >
                    {isListening ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-[#93c5fd]" />}
                  </button>

                  {/* Recognition Language Selector */}
                  <select
                    value={speechLang}
                    onChange={(e) => setSpeechLang(e.target.value as any)}
                    className="ml-1 bg-slate-950 text-[10px] text-slate-300 border border-white/15 rounded-lg px-1.5 py-2 outline-none cursor-pointer"
                    title="Choose speech recognition language"
                  >
                    <option value="ja-JP">🇯🇵 JA</option>
                    <option value="en-US">🇺🇸 EN</option>
                    <option value="auto">🌐 Auto</option>
                  </select>
                </div>
              ) : null}

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening to speech..."
                    : "Ask about Japanese grammar, kanji, or check sentences..."
                }
                disabled={isStreaming}
                className="flex-1 bg-slate-950 border border-white/15 focus:border-[#f06449] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
              />

              <button
                type="submit"
                disabled={isStreaming || !inputValue.trim()}
                aria-label="Send message"
                className="px-3.5 py-2.5 rounded-xl bg-[#f06449] hover:bg-[#d9533a] disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#f06449]/20 cursor-pointer shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Privacy Note */}
            <div className="mt-2 text-[9px] text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
                Session only • No personal data collected
              </span>
              <span>RIT Sensei Bot</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
