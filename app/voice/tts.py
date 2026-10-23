"""
Text-to-Speech (TTS) Component for Japanese AI Tutor.
Provides decoupled speech synthesis engines supporting Japanese and English voices
with natural neural intonation.
"""

import re
import io
import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict

from app.voice.exceptions import TTSUnavailableError, VoiceError

logger = logging.getLogger("VoiceTutor.TTS")

@dataclass
class TTSResult:
    """Encapsulates synthesized audio output and metadata."""
    audio_bytes: bytes
    format: str  # "mp3" or "wav"
    voice: str
    text_length: int

def clean_text_for_speech(text: str) -> str:
    """
    Cleans markdown formatting, emojis, furigana brackets, and symbols
    so the speech engine reads natural, fluent Japanese/English.
    """
    if not text:
        return ""

    # 1. Simplify Furigana notation: 勉強【べんきょう】 -> べんきょう (or keep 勉強)
    # Edge-TTS reads kanji very well, but if furigana is bracketed e.g. 漢字【かんじ】,
    # reading both sounds redundant. We keep the kanji or reading cleanly.
    cleaned = re.sub(r"【(.*?)】", r" (\1)", text)

    # 2. Strip code blocks and inline code
    cleaned = re.sub(r"```[\s\S]*?```", " ", cleaned)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)

    # 3. Strip Markdown headers, bold, italics, links
    cleaned = re.sub(r"^#{1,6}\s+", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\*\*([^*]+)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*([^*]+)\*", r"\1", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", cleaned)
    cleaned = re.sub(r"^[\*\-\+]\s+", "", cleaned, flags=re.MULTILINE)

    # 4. Remove UI symbols/emojis that could sound awkward
    cleaned = re.sub(r"[🌸🧑🤖✅⚠️🧹🔊]", "", cleaned)

    # 5. Collapse excessive whitespace
    cleaned = re.sub(r"\n{2,}", "\n", cleaned)
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    return cleaned.strip()


class BaseTTSEngine(ABC):
    """Abstract interface for text-to-speech synthesis engines."""

    @abstractmethod
    def synthesize(
        self,
        text: str,
        language: str = "ja",
        voice: Optional[str] = None
    ) -> TTSResult:
        """
        Synthesizes text into audio bytes.

        Args:
            text: Text to synthesize.
            language: Language preference ('ja', 'en', or 'auto').
            voice: Specific voice identifier (optional).

        Returns:
            TTSResult containing audio_bytes and format.
        """
        pass

    @property
    @abstractmethod
    def is_local(self) -> bool:
        """Indicates if synthesis runs locally without external network requests."""
        pass

    @property
    @abstractmethod
    def provider_info(self) -> str:
        """Details whether audio/text is processed locally or sent externally."""
        pass


class EdgeTTSEngine(BaseTTSEngine):
    """
    Neural Text-to-Speech engine utilizing Microsoft Edge neural voices.
    Provides natural Japanese and English pronunciation at ₹0 cost.
    Requires external internet access for synthesis requests.
    """

    DEFAULT_VOICES = {
        "ja": "ja-JP-NanamiNeural",  # Fluent, clear Japanese female voice
        "ja_male": "ja-JP-KeitaNeural",
        "en": "en-US-JennyNeural",   # Natural American English female voice
        "en_male": "en-US-GuyNeural"
    }

    def __init__(self, default_language: str = "ja"):
        self.default_language = default_language

    @property
    def is_local(self) -> bool:
        return False

    @property
    def provider_info(self) -> str:
        return (
            "External Service (Microsoft Edge Neural TTS via HTTPS). "
            "Text strings are sent securely over TLS for neural synthesis. "
            "No personal user data is stored, and no API keys or subscriptions are required."
        )

    def _select_voice(self, text: str, language: Optional[str] = None, voice: Optional[str] = None) -> str:
        if voice:
            return voice

        lang = (language or self.default_language).lower().strip()
        if lang in ("ja", "japanese"):
            return self.DEFAULT_VOICES["ja"]
        elif lang in ("en", "english"):
            return self.DEFAULT_VOICES["en"]
        elif lang == "auto":
            # Heuristic: Check if text contains Japanese kana/kanji characters
            has_japanese = bool(re.search(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]", text))
            return self.DEFAULT_VOICES["ja"] if has_japanese else self.DEFAULT_VOICES["en"]
        return self.DEFAULT_VOICES.get(lang, self.DEFAULT_VOICES["ja"])

    async def _async_synthesize(self, text: str, voice: str) -> bytes:
        import edge_tts
        communicate = edge_tts.Communicate(text, voice)
        audio_buffer = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.extend(chunk["data"])
        return bytes(audio_buffer)

    def synthesize(
        self,
        text: str,
        language: str = "ja",
        voice: Optional[str] = None
    ) -> TTSResult:
        if not text or not text.strip():
            raise VoiceError("Cannot synthesize empty text.")

        speech_text = clean_text_for_speech(text)
        if not speech_text:
            raise VoiceError("Text content after markdown cleaning is empty.")

        chosen_voice = self._select_voice(speech_text, language=language, voice=voice)

        try:
            # Handle existing event loop if called within an async context
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                # Running inside existing loop (e.g. notebook or async server)
                import nest_asyncio
                nest_asyncio.apply()
                audio_bytes = loop.run_until_complete(self._async_synthesize(speech_text, chosen_voice))
            else:
                audio_bytes = asyncio.run(self._async_synthesize(speech_text, chosen_voice))

            if not audio_bytes:
                raise TTSUnavailableError("Edge-TTS returned zero audio bytes.")

            return TTSResult(
                audio_bytes=audio_bytes,
                format="mp3",
                voice=chosen_voice,
                text_length=len(speech_text)
            )
        except Exception as e:
            if isinstance(e, VoiceError):
                raise
            raise TTSUnavailableError(
                f"Failed to synthesize speech via Edge-TTS ({chosen_voice}): {e}. "
                "Verify internet connectivity or use an offline fallback."
            ) from e


class MockTTS(BaseTTSEngine):
    """Deterministic Mock TTS engine for offline testing without network."""

    def __init__(self):
        # Minimal valid 44-byte 8kHz mono WAV header
        self._mock_wav = (
            b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00"
            b"@\x1f\x00\x00\x80>\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        )
        self.should_fail = False

    @property
    def is_local(self) -> bool:
        return True

    @property
    def provider_info(self) -> str:
        return "Local Mock Engine (Offline Unit Testing)"

    def synthesize(
        self,
        text: str,
        language: str = "ja",
        voice: Optional[str] = None
    ) -> TTSResult:
        if self.should_fail:
            raise TTSUnavailableError("Mock TTS simulated service failure.")
        if not text or not text.strip():
            raise VoiceError("Cannot synthesize empty text.")

        return TTSResult(
            audio_bytes=self._mock_wav,
            format="wav",
            voice=voice or "mock-voice",
            text_length=len(text)
        )
