"""
Speech-to-Text (STT) Component for Japanese AI Tutor.
Provides modular, decoupled transcription engines with 100% local processing
using Faster-Whisper (zero cost, zero cloud data transmission, strict privacy).
"""

import os
import io
import tempfile
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Union, BinaryIO

from app.voice.exceptions import (
    EmptyAudioError,
    NoSpeechDetectedError,
    UnsupportedAudioFormatError,
    STTResourceUnavailableError,
)

logger = logging.getLogger("VoiceTutor.STT")

@dataclass
class TranscriptionResult:
    """Encapsulates transcription output and metadata."""
    text: str
    language: str
    confidence: float
    duration: float

class BaseSTTEngine(ABC):
    """Abstract interface for speech-to-text recognition engines."""

    @abstractmethod
    def transcribe(
        self,
        audio_data: Union[bytes, str, BinaryIO],
        language: Optional[str] = None,
        store_audio: bool = False
    ) -> TranscriptionResult:
        """
        Transcribes the provided audio into text.

        Args:
            audio_data: Raw audio bytes, path to an audio file, or a file-like stream.
            language: Target language code ('ja', 'en', or None for automatic detection).
            store_audio: If True, explicitly allows audio retention; defaults to False (strict privacy).

        Returns:
            TranscriptionResult containing text, detected/selected language, confidence, and duration.
        """
        pass

    @property
    @abstractmethod
    def is_local(self) -> bool:
        """Returns True if audio is processed locally on-device without external API calls."""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable identifier for the STT engine."""
        pass


class FasterWhisperSTT(BaseSTTEngine):
    """
    Local, privacy-preserving STT engine powered by Faster-Whisper (CTranslate2).
    Processes audio completely on-device without cloud data transmission.
    """

    def __init__(
        self,
        model_size: str = "tiny",
        device: str = "cpu",
        compute_type: str = "int8",
        download_root: Optional[str] = None
    ):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.download_root = download_root
        self._model = None

    def _get_model(self):
        """Lazy loader for Whisper model to avoid premature memory consumption."""
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info(f"Loading Faster-Whisper '{self.model_size}' on {self.device} ({self.compute_type})...")
                self._model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type,
                    download_root=self.download_root
                )
                logger.info("Faster-Whisper model ready.")
            except Exception as e:
                raise STTResourceUnavailableError(
                    f"Failed to load Faster-Whisper model '{self.model_size}': {e}. "
                    "Ensure 'faster-whisper' is installed and required libraries (libcublas/CTranslate2) are present."
                ) from e
        return self._model

    @property
    def is_local(self) -> bool:
        return True

    @property
    def name(self) -> str:
        return f"Faster-Whisper ({self.model_size}, local)"

    def transcribe(
        self,
        audio_data: Union[bytes, str, BinaryIO],
        language: Optional[str] = None,
        store_audio: bool = False
    ) -> TranscriptionResult:
        # 1. Validate Input
        if not audio_data:
            raise EmptyAudioError("Audio input is empty (0 bytes received).")

        temp_path: Optional[str] = None
        input_source: Union[str, BinaryIO]

        try:
            if isinstance(audio_data, bytes):
                if len(audio_data) < 128:
                    raise EmptyAudioError("Audio data is too small to contain valid audio frames.")
                # Create an ephemeral temporary file for libav / ctranslate2 decoding
                with tempfile.NamedTemporaryFile(suffix=".audio", delete=False) as tmp:
                    tmp.write(audio_data)
                    tmp.flush()
                    temp_path = tmp.name
                input_source = temp_path
            elif isinstance(audio_data, str):
                if not os.path.exists(audio_data):
                    raise FileNotFoundError(f"Audio file '{audio_data}' not found.")
                if os.path.getsize(audio_data) < 128:
                    raise EmptyAudioError(f"Audio file '{audio_data}' is empty or too small.")
                input_source = audio_data
            else:
                input_source = audio_data

            # 2. Transcribe using Whisper
            model = self._get_model()

            # Normalize language parameter: whisper accepts 'ja', 'en', etc.
            lang_param = language.lower().strip() if language and language.strip() != "auto" else None

            try:
                segments, info = model.transcribe(
                    input_source,
                    language=lang_param,
                    beam_size=5,
                    vad_filter=True,  # Filter out silence and background noise
                    vad_parameters=dict(min_silence_duration_ms=500)
                )
                segment_list = list(segments)
            except Exception as e:
                err_msg = str(e).lower()
                if "invalid data found when processing input" in err_msg or "unknown format" in err_msg:
                    raise UnsupportedAudioFormatError(
                        f"Unsupported or corrupted audio format: {e}. "
                        "Please provide standard WAV, MP3, WebM, or OGG audio."
                    ) from e
                raise VoiceError(f"Transcription execution failed: {e}") from e

            # 3. Process and Clean Transcription
            full_text = " ".join([seg.text.strip() for seg in segment_list]).strip()

            if not full_text:
                raise NoSpeechDetectedError(
                    "No intelligible speech detected in recording. "
                    "Please check your microphone volume and speak clearly."
                )

            # Average confidence / probability
            probs = [seg.avg_logprob for seg in segment_list if hasattr(seg, "avg_logprob")]
            confidence = round(sum(probs) / len(probs), 4) if probs else 0.0
            duration = round(info.duration, 2) if hasattr(info, "duration") else 0.0
            detected_lang = info.language if hasattr(info, "language") else (language or "unknown")

            return TranscriptionResult(
                text=full_text,
                language=detected_lang,
                confidence=confidence,
                duration=duration
            )

        finally:
            # Enforce privacy guarantee: delete temporary files unless explicit storage is enabled
            if temp_path and os.path.exists(temp_path):
                if not store_audio:
                    try:
                        os.unlink(temp_path)
                    except OSError:
                        pass


class MockSTT(BaseSTTEngine):
    """Mock STT Engine for fast, deterministic unit testing without external weights."""

    def __init__(self, canned_response: str = "こんにちは、日本語を勉強したいです。"):
        self.canned_response = canned_response
        self.should_fail_empty = False
        self.should_fail_format = False
        self.should_fail_noisy = False

    @property
    def is_local(self) -> bool:
        return True

    @property
    def name(self) -> str:
        return "Mock STT (Testing)"

    def transcribe(
        self,
        audio_data: Union[bytes, str, BinaryIO],
        language: Optional[str] = None,
        store_audio: bool = False
    ) -> TranscriptionResult:
        if self.should_fail_empty or not audio_data or (isinstance(audio_data, bytes) and len(audio_data) < 100):
            raise EmptyAudioError("Empty audio buffer received.")
        if self.should_fail_format:
            raise UnsupportedAudioFormatError("Unsupported audio codec format.")
        if self.should_fail_noisy:
            raise NoSpeechDetectedError("No speech detected due to ambient noise.")

        return TranscriptionResult(
            text=self.canned_response,
            language=language or "ja",
            confidence=0.98,
            duration=2.5
        )
