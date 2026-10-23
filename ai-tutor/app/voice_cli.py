#!/usr/bin/env python3
"""
Japanese AI Tutor - Voice CLI Companion
Allows testing and interacting with the voice pipeline from the terminal.
Supports testing audio files or live recording via system tools (ffmpeg/arecord).
"""

import os
import sys
import argparse
import subprocess
import tempfile
from typing import Optional

from app.voice.pipeline import VoiceTutorPipeline
from app.voice.stt import FasterWhisperSTT, MockSTT
from app.voice.tts import EdgeTTSEngine, MockTTS
from app.voice.llm import TutorLLMEngine, MockLLMEngine
from app.voice.exceptions import VoiceError

def record_microphone_audio(duration: int = 5) -> bytes:
    """Records audio from system microphone using ffmpeg or arecord without persistent storage."""
    print(f"\n🎙️ Recording {duration} seconds from microphone... Speak now!")
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        # Try ffmpeg with default ALSA / pulse device
        cmd = [
            "ffmpeg", "-y", "-f", "pulse", "-i", "default",
            "-t", str(duration), "-ac", "1", "-ar", "16000", tmp_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if res.returncode != 0:
            # Fallback to arecord
            cmd2 = ["arecord", "-d", str(duration), "-f", "cd", "-t", "wav", tmp_path]
            subprocess.run(cmd2, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        with open(tmp_path, "rb") as f:
            audio_bytes = f.read()
        return audio_bytes
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def play_audio(audio_bytes: bytes, audio_format: str = "mp3"):
    """Plays audio bytes using ffplay, mpv, or aplay."""
    with tempfile.NamedTemporaryFile(suffix=f".{audio_format}", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        for player in ["ffplay", "mpv", "aplay"]:
            if subprocess.run(["which", player], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                flags = ["-nodisp", "-autoexit", "-loglevel", "quiet"] if player == "ffplay" else []
                subprocess.run([player] + flags + [tmp_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                break
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def main():
    parser = argparse.ArgumentParser(description="Japanese AI Tutor - Voice CLI")
    parser.add_argument("--audio-file", help="Path to input audio file to transcribe and process")
    parser.add_argument("--record", action="store_true", help="Record audio from microphone")
    parser.add_argument("--duration", type=int, default=5, help="Recording duration in seconds (default: 5)")
    parser.add_argument("--language", default="ja", choices=["ja", "en", "auto"], help="Speech language")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-1.5B-Instruct")
    parser.add_argument("--adapter-path", default="adapters/japanese-ai-tutor-qlora")
    parser.add_argument("--mock-llm", action="store_true", help="Use mock LLM for testing")
    parser.add_argument("--no-tts", action="store_true", help="Disable TTS synthesis")
    parser.add_argument("--play-tts", action="store_true", help="Play synthesized audio out loud")
    args = parser.parse_args()

    # Initialize components
    stt = FasterWhisperSTT(model_size="tiny", device="cpu", compute_type="int8")
    tts = EdgeTTSEngine(default_language="ja")
    llm = MockLLMEngine() if args.mock_llm else TutorLLMEngine(
        base_model_id=args.base_model,
        adapter_path=args.adapter_path
    )
    pipeline = VoiceTutorPipeline(stt_engine=stt, llm_engine=llm, tts_engine=tts)

    # Obtain audio data
    audio_data: Optional[bytes] = None
    if args.audio_file:
        if not os.path.exists(args.audio_file):
            print(f"Error: Audio file '{args.audio_file}' does not exist.")
            sys.exit(1)
        with open(args.audio_file, "rb") as f:
            audio_data = f.read()
    elif args.record:
        try:
            audio_data = record_microphone_audio(args.duration)
        except Exception as e:
            print(f"Recording error: {e}")
            sys.exit(1)
    else:
        print("Please specify either --audio-file <path> or --record to test microphone input.")
        sys.exit(1)

    print("\n" + "=" * 60)
    print(" 🌸 RUNNING VOICE PIPELINE")
    print("=" * 60)

    # 1. STT
    print("\n[1/3] Transcribing audio with Faster-Whisper...")
    try:
        transcription = pipeline.transcribe(audio_data, language=args.language)
        print(f"  📝 Detected Transcription: \"{transcription.text}\"")
        print(f"  🌐 Language: {transcription.language} (Confidence: {transcription.confidence})")
    except VoiceError as e:
        print(f"  ❌ Speech Recognition Error: {e}")
        sys.exit(1)

    # 2. Transcription Review / Edit prompt (Requirement 3)
    user_confirm = input("\n[Review] Press Enter to send, or type corrected text: ").strip()
    final_text = user_confirm if user_confirm else transcription.text

    # 3. Tutor LLM
    print(f"\n[2/3] Querying Japanese AI Tutor with: \"{final_text}\"...")
    tutor_reply = pipeline.ask_tutor(final_text)
    print(f"\n🌸 Sensei's Response:\n{tutor_reply}\n")

    # 4. TTS
    if not args.no_tts:
        print("[3/3] Synthesizing speech with Edge-TTS...")
        try:
            tts_res = pipeline.synthesize(tutor_reply, language=args.language)
            print(f"  🔊 Synthesized {len(tts_res.audio_bytes)} bytes of speech ({tts_res.voice}).")
            if args.play_tts:
                print("  ▶️ Playing audio...")
                play_audio(tts_res.audio_bytes, tts_res.format)
        except Exception as e:
            print(f"  ⚠️ TTS Warning: {e}")

    print("=" * 60)
    print(" ✅ Voice interaction completed successfully.")

if __name__ == "__main__":
    main()
