"""
Japanese AI Tutor - Voice Support Package.
Provides modular, decoupled components for:
- Local offline speech-to-text (STT via Faster-Whisper)
- High-quality neural text-to-speech (TTS via Edge-TTS)
- Language model integration with QLoRA Japanese AI Tutor
- Privacy-preserving pipeline orchestration
"""

from app.voice.exceptions import (
    VoiceError,
    EmptyAudioError,
    NoSpeechDetectedError,
    UnsupportedAudioFormatError,
    STTResourceUnavailableError,
    TTSUnavailableError,
    LLMUnavailableError,
)
from app.voice.stt import (
    BaseSTTEngine,
    FasterWhisperSTT,
    MockSTT,
    TranscriptionResult,
)
from app.voice.tts import (
    BaseTTSEngine,
    EdgeTTSEngine,
    MockTTS,
    TTSResult,
    clean_text_for_speech,
)
from app.voice.llm import (
    BaseLLMEngine,
    TutorLLMEngine,
    MockLLMEngine,
)
from app.voice.pipeline import (
    VoiceTutorPipeline,
    VoiceTurnResult,
)

__all__ = [
    "VoiceError",
    "EmptyAudioError",
    "NoSpeechDetectedError",
    "UnsupportedAudioFormatError",
    "STTResourceUnavailableError",
    "TTSUnavailableError",
    "LLMUnavailableError",
    "BaseSTTEngine",
    "FasterWhisperSTT",
    "MockSTT",
    "TranscriptionResult",
    "BaseTTSEngine",
    "EdgeTTSEngine",
    "MockTTS",
    "TTSResult",
    "clean_text_for_speech",
    "BaseLLMEngine",
    "TutorLLMEngine",
    "MockLLMEngine",
    "VoiceTutorPipeline",
    "VoiceTurnResult",
]
