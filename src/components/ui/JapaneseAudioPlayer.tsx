"use client";

import React, { useState, useCallback } from "react";
import { Volume2, VolumeX, Sparkles } from "lucide-react";

interface JapaneseAudioPlayerProps {
  text: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function JapaneseAudioPlayer({
  text,
  label,
  size = "md",
  className = "",
}: JapaneseAudioPlayerProps) {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        console.warn("SpeechSynthesis API not supported in this browser.");
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.85; // Authentic teaching cadence
      utterance.pitch = 1.0;

      // Select Japanese voice if available
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find((v) => v.lang.startsWith("ja") || v.name.includes("Japanese"));
      if (jaVoice) {
        utterance.voice = jaVoice;
      }

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [text]
  );

  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs gap-1.5",
    md: "px-3.5 py-1.5 text-xs gap-2",
    lg: "px-4 py-2 text-sm gap-2.5",
  };

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-4.5 h-4.5",
  };

  return (
    <button
      type="button"
      onClick={speak}
      title={`Listen to Japanese pronunciation of "${text}"`}
      className={`btn-spring group inline-flex items-center rounded-full border border-[#f06449]/35 bg-[#f06449]/10 hover:bg-[#f06449]/20 text-[#ff7c62] hover:text-white font-medium shadow-sm hover:shadow-coral-glow backdrop-blur-md cursor-pointer transition-all duration-200 ${sizeClasses[size]} ${
        speaking ? "border-[#f06449] bg-[#f06449]/30 scale-105 shadow-coral-glow" : ""
      } ${className}`}
    >
      <Volume2
        className={`${iconSizes[size]} transition-transform duration-200 group-hover:scale-110 ${
          speaking ? "text-[#ff7c62] animate-pulse" : "text-[#f06449]"
        }`}
      />
      {label && <span className="font-japanese tracking-wide">{label}</span>}
      {speaking && (
        <span className="flex items-center gap-0.5 ml-1">
          <span className="w-1 h-2 bg-[#f06449] rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1 h-3 bg-[#f06449] rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1 h-2 bg-[#f06449] rounded-full animate-bounce" />
        </span>
      )}
    </button>
  );
}
