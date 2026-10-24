"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, Square, Send, X, FileText, Image as ImageIcon, Sparkles, Volume2, Headphones } from "lucide-react";

export interface AttachmentItem {
  name: string;
  kind: "image" | "file" | "tag";
}

export interface AiChat8Props {
  onSendMessage?: (transcript: string) => Promise<void> | void;
  initialTranscript?: string;
  title?: string;
  placeholderPrompt?: string;
  attachments?: AttachmentItem[];
  isProcessing?: boolean;
  className?: string;
  mode?: "embedded" | "standalone";
}

const DEFAULT_BAR_COUNT = 28;
const DEFAULT_ATTACHMENTS: AttachmentItem[] = [
  { name: "JLPT Accent Coach", kind: "tag" },
  { name: "Grammar Analysis", kind: "tag" },
  { name: "Furigana & Romaji", kind: "tag" },
];

export default function AiChat8({
  onSendMessage,
  initialTranscript = "こんにちは！日本語で話しかけてみてください (Hello! Try speaking in Japanese)",
  title = "Sensei Voice Composer",
  placeholderPrompt = "Tap the microphone and speak in Japanese or English...",
  attachments: customAttachments,
  isProcessing = false,
  className = "",
  mode = "standalone",
}: AiChat8Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>(() =>
    Array.from({ length: DEFAULT_BAR_COUNT }, () => 14)
  );
  const [attachments, setAttachments] = useState<AttachmentItem[]>(
    customAttachments ?? DEFAULT_ATTACHMENTS
  );
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize Speech Recognition if supported in browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "ja-JP"; // Default to Japanese recognition

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          if (currentTranscript.trim()) {
            setTranscript(currentTranscript);
          }
        };

        recognition.onerror = (e: any) => {
          console.warn("[AiChat8] Speech recognition error:", e.error);
        };

        recognition.onend = () => {
          // If ended unexpectedly while still supposed to record
          if (isRecording) {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [isRecording]);

  // Timer counter when recording
  useEffect(() => {
    if (!isRecording) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  // Audio Visualizer Simulation or Web Audio capture
  useEffect(() => {
    if (!isRecording) {
      setWaveformBars(Array.from({ length: DEFAULT_BAR_COUNT }, () => 14));
      return;
    }

    // Try to connect to real microphone analyzer if possible
    let mounted = true;

    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateBars = () => {
          if (!mounted || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          // Downsample or interpolate into 28 bars
          const newBars: number[] = [];
          const step = Math.max(1, Math.floor(dataArray.length / DEFAULT_BAR_COUNT));
          for (let i = 0; i < DEFAULT_BAR_COUNT; i++) {
            const rawVal = dataArray[i * step] || 0;
            // Scale between 15% and 98%
            const scaled = Math.min(100, Math.max(15, (rawVal / 255) * 100));
            newBars.push(scaled);
          }
          setWaveformBars(newBars);
          animFrameRef.current = requestAnimationFrame(updateBars);
        };
        updateBars();
      } catch {
        // Fallback to organic animated simulated frequency waveform
        const simInterval = window.setInterval(() => {
          if (!mounted) return;
          setWaveformBars(
            Array.from({ length: DEFAULT_BAR_COUNT }, (_, idx) => {
              const base = 25 + 65 * Math.random();
              const wave = Math.sin((idx / DEFAULT_BAR_COUNT) * Math.PI) * 20;
              return Math.min(98, Math.max(15, base + wave));
            })
          );
        }, 120);

        return () => window.clearInterval(simInterval);
      }
    }

    initAudio();

    return () => {
      mounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isRecording]);

  const startRecording = useCallback(() => {
    setIsSent(false);
    setElapsedSeconds(0);
    setTranscript("");
    setIsRecording(true);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Speech recognition already running or error:", err);
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  }, []);

  const handleSend = useCallback(async () => {
    const textToSend = transcript.trim();
    if (!textToSend || isProcessing) return;

    stopRecording();
    setIsSent(true);

    if (onSendMessage) {
      await onSendMessage(textToSend);
    }
  }, [transcript, isProcessing, stopRecording, onSendMessage]);

  const removeAttachment = (name: string) => {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  };

  const hasContent = transcript.trim().length > 0;

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden rounded-2xl border border-[#e7e2d7] bg-white text-slate-900 shadow-xl p-6 sm:p-8 ${className}`}
    >
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        {/* Header: Title + Status + Timer */}
        <header className="flex shrink-0 items-center justify-between gap-3 pb-6 border-b border-[#e7e2d7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1d4ed8]/10 border border-[#1d4ed8]/20 flex items-center justify-center text-[#1d4ed8]">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2">
                <span>{title}</span>
                <span className="text-[10px] text-slate-500 font-japanese">(音声作曲)</span>
              </h1>
              <p className="text-[11px] text-slate-500">React Bits Pro • AI Chat 8 Voice Composer</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium tabular-nums px-2.5 py-0.5 rounded-full ${
                isRecording
                  ? "bg-[#d9381e]/10 text-[#c53018] border border-[#d9381e]/30"
                  : isSent
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-[#f8f6f0] text-slate-700 border border-[#e7e2d7]"
              }`}
            >
              {isRecording && (
                <span className="inline-block size-2 rounded-full bg-[#d9381e] animate-ping" />
              )}
              {isSent
                ? "Dispatched (送信完了)"
                : isRecording
                ? "Listening (録音中)..."
                : hasContent
                ? "Transcript Ready (文字起こし完了)"
                : "Standby (待機中)"}
            </span>

            {/* Timer */}
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {Math.floor(elapsedSeconds / 60)}:
              {String(elapsedSeconds % 60).padStart(2, "0")}
            </span>
          </div>
        </header>

        {/* Live Transcript & Waveform Stage */}
        <div className="flex min-h-[160px] sm:min-h-[190px] flex-1 flex-col justify-center gap-6 py-6">
          {/* Transcript display */}
          <div className="min-h-[56px] flex items-center">
            {transcript ? (
              <p className="text-lg sm:text-xl font-medium tracking-tight text-slate-900 leading-relaxed select-text font-japanese">
                {transcript}
              </p>
            ) : (
              <p className="text-sm sm:text-base text-slate-400 italic select-none">
                {placeholderPrompt}
              </p>
            )}
          </div>

          {/* 28-Bar Waveform Audio Visualizer */}
          <div
            className="flex h-14 w-full items-center justify-between gap-1 select-none"
            aria-hidden="true"
          >
            {waveformBars.map((barHeight, idx) => (
              <div
                key={idx}
                className={`h-full w-1 shrink-0 rounded-full transition-all duration-150 ease-out ${
                  isRecording
                    ? "bg-gradient-to-t from-[#1d4ed8] via-[#3b82f6] to-[#d9381e] shadow-[0_0_8px_rgba(217,56,30,0.3)]"
                    : "bg-slate-200"
                }`}
                style={{
                  transform: `scaleY(${barHeight / 100})`,
                  transformOrigin: "center",
                }}
              />
            ))}
          </div>
        </div>

        {/* Voice Composer Toolbar & Controls */}
        <div className="relative flex w-full flex-col rounded-xl border border-[#e7e2d7] bg-[#f8f6f0] p-3.5 shadow-sm transition-all focus-within:border-[#1d4ed8]/60 focus-within:ring-2 focus-within:ring-[#1d4ed8]/20">
          {/* Context / Attachment Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-2.5">
              {attachments.map((att) => (
                <span
                  key={att.name}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e2d7] bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs transition-all hover:border-slate-300"
                >
                  <Sparkles className="w-3 h-3 text-[#d9381e] shrink-0" />
                  <span className="max-w-[140px] truncate">{att.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${att.name}`}
                    onClick={() => removeAttachment(att.name)}
                    className="ml-0.5 inline-flex size-4 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Controls Bar: Record Button + Status Text + Send Button */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#e7e2d7]">
            <div className="flex items-center gap-2.5">
              {/* Record / Stop Button */}
              <button
                type="button"
                aria-label={isRecording ? "Stop recording" : "Start recording"}
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl font-semibold transition-all duration-150 active:scale-95 ${
                  isRecording
                    ? "bg-[#d9381e] text-white shadow-md shadow-[#d9381e]/30 hover:bg-[#b82e18]"
                    : "bg-white text-slate-700 hover:bg-slate-50 hover:text-[#1d4ed8] border border-[#e7e2d7] shadow-xs"
                }`}
              >
                {isRecording ? (
                  <Square className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              <span className="text-xs text-slate-500 select-none">
                {isRecording
                  ? "Tap to stop"
                  : isSent
                  ? "Message sent to Sensei"
                  : hasContent
                  ? "Tap mic to re-record"
                  : "Tap mic to speak"}
              </span>
            </div>

            {/* Send Button */}
            <button
              type="button"
              aria-label="Send transcript to AI Sensei"
              onClick={handleSend}
              disabled={!hasContent || isProcessing}
              className={`relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl transition-all duration-150 active:scale-95 disabled:cursor-not-allowed ${
                hasContent && !isProcessing
                  ? "bg-[#1d4ed8] text-white shadow-md shadow-[#1d4ed8]/30 hover:bg-[#1e40af]"
                  : "bg-slate-200 text-slate-400"
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
