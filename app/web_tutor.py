#!/usr/bin/env python3
"""
Japanese AI Tutor - Voice-Enabled Web Application Server
Provides a modern web interface with client-side microphone recording,
local offline speech recognition via Faster-Whisper, transcription review/editing,
tutor LLM inference, and Edge-TTS spoken responses.
"""

import os
import sys
import json
import base64
import argparse
import logging
from aiohttp import web

from app.voice.exceptions import (
    VoiceError,
    EmptyAudioError,
    NoSpeechDetectedError,
    UnsupportedAudioFormatError,
    STTResourceUnavailableError,
    TTSUnavailableError,
    LLMUnavailableError,
)
from app.voice.stt import FasterWhisperSTT, MockSTT
from app.voice.tts import EdgeTTSEngine, MockTTS
from app.voice.llm import TutorLLMEngine, MockLLMEngine
from app.voice.pipeline import VoiceTutorPipeline

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("VoiceTutor.Web")

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
INDEX_PATH = os.path.join(TEMPLATE_DIR, "index.html")

def create_app(
    pipeline: VoiceTutorPipeline,
    model_name: str = "Japanese AI Tutor"
) -> web.Application:
    """Builds and configures the aiohttp web application with API routes."""
    app = web.Application(client_max_size=25 * 1024 * 1024)  # 25 MB max upload
    app["pipeline"] = pipeline
    app["model_name"] = model_name

    # Routes
    app.router.add_get("/", handle_index)
    app.router.add_get("/api/status", handle_status)
    app.router.add_get("/api/privacy", handle_privacy)
    app.router.add_post("/api/transcribe", handle_transcribe)
    app.router.add_post("/api/chat", handle_chat)
    app.router.add_post("/api/tts", handle_tts)

    return app

async def handle_index(request: web.Request) -> web.Response:
    """Serves the main interactive voice tutoring web application."""
    if not os.path.exists(INDEX_PATH):
        return web.Response(text="index.html not found.", status=404)
    with open(INDEX_PATH, "r", encoding="utf-8") as f:
        html = f.read()
    return web.Response(text=html, content_type="text/html")

async def handle_status(request: web.Request) -> web.Response:
    """Returns runtime model, adapter, and component status."""
    pipeline: VoiceTutorPipeline = request.app["pipeline"]
    is_fine_tuned = getattr(pipeline.llm, "is_fine_tuned", False)
    adapter_path = getattr(pipeline.llm, "adapter_path", None)

    return web.json_response({
        "status": "ok",
        "model": pipeline.llm.model_name,
        "adapter_active": is_fine_tuned,
        "adapter_path": adapter_path,
        "stt_engine": pipeline.stt.name,
        "stt_local": pipeline.stt.is_local,
        "tts_engine": type(pipeline.tts).__name__,
        "tts_local": pipeline.tts.is_local,
        "audio_storage_allowed": pipeline.allow_audio_storage
    })

async def handle_privacy(request: web.Request) -> web.Response:
    """Returns privacy policy and data-flow documentation."""
    pipeline: VoiceTutorPipeline = request.app["pipeline"]
    return web.json_response(pipeline.get_privacy_report())

async def handle_transcribe(request: web.Request) -> web.Response:
    """
    Accepts microphone audio from the client and transcribes it locally.
    Enforces strict zero audio storage on the host machine.
    """
    pipeline: VoiceTutorPipeline = request.app["pipeline"]

    audio_bytes = None
    language = "ja"

    if request.content_type.startswith("multipart/"):
        reader = await request.multipart()
        while True:
            part = await reader.next()
            if part is None:
                break
            if part.name == "audio":
                audio_bytes = await part.read()
            elif part.name == "language":
                language = (await part.text()).strip()
    else:
        # Raw audio byte payload
        audio_bytes = await request.read()
        language = request.query.get("language", "ja")

    if not audio_bytes or len(audio_bytes) < 100:
        return web.json_response(
            {"status": "error", "error": "Audio recording was empty or too short. Please speak clearly into your microphone."},
            status=400
        )

    try:
        # Transcribe audio using decoupled STT engine
        result = pipeline.transcribe(audio_bytes, language=language)
        return web.json_response({
            "status": "ok",
            "transcription": result.text,
            "language": result.language,
            "confidence": result.confidence,
            "duration": result.duration
        })

    except EmptyAudioError as e:
        return web.json_response({"status": "error", "error": str(e)}, status=400)
    except NoSpeechDetectedError as e:
        return web.json_response({"status": "error", "error": str(e)}, status=422)
    except UnsupportedAudioFormatError as e:
        return web.json_response({"status": "error", "error": str(e)}, status=415)
    except STTResourceUnavailableError as e:
        return web.json_response({"status": "error", "error": f"Speech recognition unavailable: {e}"}, status=503)
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        return web.json_response({"status": "error", "error": f"Transcription failed: {e}"}, status=500)

async def handle_chat(request: web.Request) -> web.Response:
    """
    Receives user text (typed or verified transcription) and returns the tutor's response
    with optional spoken audio (synthesized via Edge-TTS).
    """
    pipeline: VoiceTutorPipeline = request.app["pipeline"]

    try:
        data = await request.json()
    except Exception:
        return web.json_response({"status": "error", "error": "Invalid JSON body"}, status=400)

    user_message = data.get("message", "").strip()
    if not user_message:
        return web.json_response({"status": "error", "error": "Empty message received"}, status=400)

    history = data.get("history", [])
    language = data.get("language", "ja")
    enable_tts = data.get("enable_tts", True)

    try:
        # 1. Generate text response from Japanese AI Tutor LLM
        tutor_response = pipeline.ask_tutor(
            user_text=user_message,
            conversation_history=history
        )

        # 2. Optionally synthesize response to audio
        audio_base64 = None
        if enable_tts:
            try:
                tts_result = pipeline.synthesize(text=tutor_response, language=language)
                audio_base64 = base64.b64encode(tts_result.audio_bytes).decode("ascii")
            except Exception as e:
                logger.warning(f"TTS synthesis warning (falling back to text-only): {e}")

        return web.json_response({
            "status": "ok",
            "response": tutor_response,
            "audio_base64": audio_base64
        })

    except LLMUnavailableError as e:
        return web.json_response({"status": "error", "error": f"Tutor model error: {e}"}, status=503)
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        return web.json_response({"status": "error", "error": f"Generation failed: {e}"}, status=500)

async def handle_tts(request: web.Request) -> web.Response:
    """Generates speech audio for arbitrary text."""
    pipeline: VoiceTutorPipeline = request.app["pipeline"]

    try:
        data = await request.json()
    except Exception:
        return web.json_response({"status": "error", "error": "Invalid JSON"}, status=400)

    text = data.get("text", "").strip()
    language = data.get("language", "ja")

    if not text:
        return web.json_response({"status": "error", "error": "No text provided"}, status=400)

    try:
        res = pipeline.synthesize(text=text, language=language)
        return web.Response(
            body=res.audio_bytes,
            content_type="audio/mpeg" if res.format == "mp3" else "audio/wav"
        )
    except Exception as e:
        return web.json_response({"status": "error", "error": f"TTS failure: {e}"}, status=502)


def main():
    parser = argparse.ArgumentParser(description="Japanese AI Tutor - Voice Web Application")
    parser.add_argument("--host", default="127.0.0.1", help="Host address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=7860, help="Port to bind (default: 7860)")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-1.5B-Instruct", help="Hugging Face base model")
    parser.add_argument("--adapter-path", default="adapters/japanese-ai-tutor-qlora", help="Path to LoRA adapter")
    parser.add_argument("--whisper-model", default="tiny", help="Faster-Whisper model size (tiny, base, small)")
    parser.add_argument("--quant", default="4bit", choices=["4bit", "8bit", "none"], help="LLM quantization")
    parser.add_argument("--store-audio", action="store_true", help="Explicitly allow persisting audio recordings (default: False)")
    parser.add_argument("--mock-llm", action="store_true", help="Use lightweight mock LLM for testing/development")
    parser.add_argument("--mock-stt", action="store_true", help="Use mock STT engine")
    parser.add_argument("--mock-tts", action="store_true", help="Use mock TTS engine")

    args = parser.parse_args()

    # Configure STT
    if args.mock_stt:
        stt_engine = MockSTT()
    else:
        stt_engine = FasterWhisperSTT(model_size=args.whisper_model, device="cpu", compute_type="int8")

    # Configure TTS
    if args.mock_tts:
        tts_engine = MockTTS()
    else:
        tts_engine = EdgeTTSEngine(default_language="ja")

    # Configure LLM
    if args.mock_llm:
        llm_engine = MockLLMEngine()
    else:
        llm_engine = TutorLLMEngine(
            base_model_id=args.base_model,
            adapter_path=args.adapter_path,
            quant=args.quant
        )

    pipeline = VoiceTutorPipeline(
        stt_engine=stt_engine,
        llm_engine=llm_engine,
        tts_engine=tts_engine,
        allow_audio_storage=args.store_audio
    )

    print("\n" + "=" * 65)
    print(" 🌸 JAPANESE AI TUTOR - VOICE WEB SERVER")
    print(f" URL:            http://{args.host}:{args.port}")
    print(f" STT Engine:     {pipeline.stt.name} (Local: {pipeline.stt.is_local})")
    print(f" TTS Engine:     {type(pipeline.tts).__name__}")
    print(f" LLM Engine:     {pipeline.llm.model_name}")
    print(f" Audio Storage:  {'Allowed (Authorised)' if args.store_audio else 'Strictly Ephemeral (Zero Storage)'}")
    print("=" * 65 + "\n")

    app = create_app(pipeline, model_name=pipeline.llm.model_name)
    web.run_app(app, host=args.host, port=args.port)

if __name__ == "__main__":
    main()
