"""
Automated Test Suite for Japanese AI Tutor Voice Pipeline.
Tests:
- Decoupling and independent substitution of STT, LLM, and TTS components.
- Error handling: Empty audio, corrupted formats, silence/noise, missing resources.
- Speech-to-Text with Faster-Whisper and mock engines.
- Text-to-Speech synthesis for Japanese and English voices.
- Text cleaning for TTS (furigana, markdown, emojis).
- Strict privacy verification (zero persistent audio files).
- User transcription review and manual correction flow.
- Complete end-to-end Audio -> Transcription -> Review -> Tutor LLM -> Spoken Response pipeline.
- Web API endpoints (/api/status, /api/privacy, /api/transcribe, /api/chat, /api/tts).
"""

import os
import io
import wave
import struct
import tempfile
import unittest
import numpy as np

from app.voice.exceptions import (
    VoiceError,
    EmptyAudioError,
    NoSpeechDetectedError,
    UnsupportedAudioFormatError,
    STTResourceUnavailableError,
    TTSUnavailableError,
    LLMUnavailableError,
)
from app.voice.stt import FasterWhisperSTT, MockSTT, TranscriptionResult, BaseSTTEngine
from app.voice.tts import EdgeTTSEngine, MockTTS, TTSResult, clean_text_for_speech, BaseTTSEngine
from app.voice.llm import TutorLLMEngine, MockLLMEngine, BaseLLMEngine
from app.voice.pipeline import VoiceTutorPipeline, VoiceTurnResult
from app.web_tutor import create_app

def create_synthetic_sine_wave(duration_sec: float = 1.0, freq: float = 440.0, sample_rate: int = 16000) -> bytes:
    """Generates a valid 16-bit mono PCM WAV audio buffer in memory."""
    num_samples = int(sample_rate * duration_sec)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)  # Mono
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        # Generate sine wave
        t = np.linspace(0, duration_sec, num_samples, False)
        sine = np.sin(2 * np.pi * freq * t) * 32767
        data = sine.astype(np.int16).tobytes()
        wav.writeframes(data)
    return buffer.getvalue()


class TestVoiceDecoupling(unittest.TestCase):
    """Verifies that STT, LLM, and TTS can each be replaced independently."""

    def test_custom_components_interchangeable(self):
        class CustomSTT(BaseSTTEngine):
            @property
            def is_local(self): return True
            @property
            def name(self): return "CustomSTT"
            def transcribe(self, audio_data, language=None, store_audio=False):
                return TranscriptionResult(text="桜は綺麗です", language="ja", confidence=0.99, duration=1.5)

        class CustomLLM(BaseLLMEngine):
            @property
            def model_name(self): return "CustomLLM"
            def generate_response(self, user_message, conversation_history=None, system_prompt=None):
                return "はい、「桜」【さくら】(sakura) means cherry blossom."

        class CustomTTS(BaseTTSEngine):
            @property
            def is_local(self): return True
            @property
            def provider_info(self): return "Custom local engine"
            def synthesize(self, text, language="ja", voice=None):
                return TTSResult(audio_bytes=b"CUSTOM_AUDIO_BYTES", format="wav", voice="custom", text_length=len(text))

        pipeline = VoiceTutorPipeline(
            stt_engine=CustomSTT(),
            llm_engine=CustomLLM(),
            tts_engine=CustomTTS()
        )

        dummy_audio = create_synthetic_sine_wave(0.5)
        turn = pipeline.process_turn(dummy_audio)

        self.assertEqual(turn.transcription.text, "桜は綺麗です")
        self.assertIn("sakura", turn.tutor_response)
        self.assertIsNotNone(turn.synthesized_audio)
        self.assertEqual(turn.synthesized_audio.audio_bytes, b"CUSTOM_AUDIO_BYTES")


class TestSpeechToText(unittest.TestCase):
    """Tests Speech-to-Text recognition and error handling."""

    def setUp(self):
        self.mock_stt = MockSTT(canned_response="日本語を勉強したいです。")
        self.whisper_stt = FasterWhisperSTT(model_size="tiny", device="cpu", compute_type="int8")

    def test_empty_audio_raises_error(self):
        with self.assertRaises(EmptyAudioError):
            self.whisper_stt.transcribe(b"")

        with self.assertRaises(EmptyAudioError):
            self.whisper_stt.transcribe(b"short")

        with self.assertRaises(EmptyAudioError):
            self.mock_stt.transcribe(b"")

    def test_corrupted_format_raises_error(self):
        # 200 bytes of random garbage without any audio headers
        garbage_bytes = b"X" * 250
        with self.assertRaises(UnsupportedAudioFormatError):
            self.whisper_stt.transcribe(garbage_bytes)

    def test_silence_detection(self):
        # 1.5 seconds of pure silence
        sample_rate = 16000
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(b"\x00" * (sample_rate * 2))
        silent_audio = buffer.getvalue()

        with self.assertRaises(NoSpeechDetectedError):
            self.whisper_stt.transcribe(silent_audio)

    def test_mock_stt_variations(self):
        res = self.mock_stt.transcribe(b"A" * 150)
        self.assertEqual(res.text, "日本語を勉強したいです。")
        self.assertEqual(res.language, "ja")

        self.mock_stt.should_fail_noisy = True
        with self.assertRaises(NoSpeechDetectedError):
            self.mock_stt.transcribe(b"A" * 150)


class TestTextToSpeech(unittest.TestCase):
    """Tests Text-to-Speech synthesis, text sanitization, and voice selection."""

    def test_text_sanitization(self):
        raw_markdown = (
            "### 勉強【べんきょう】(benkyou)\n"
            "**勉強** means *study* in Japanese! 🌸\n"
            "- Example: `毎日日本語を勉強します。`\n"
            "[Learn more](https://example.com)"
        )
        cleaned = clean_text_for_speech(raw_markdown)
        self.assertNotIn("###", cleaned)
        self.assertNotIn("**", cleaned)
        self.assertNotIn("`", cleaned)
        self.assertNotIn("🌸", cleaned)
        self.assertIn("勉強 (べんきょう)", cleaned)
        self.assertIn("study in Japanese", cleaned)

    def test_edge_tts_japanese_synthesis(self):
        tts = EdgeTTSEngine(default_language="ja")
        res = tts.synthesize("こんにちは！日本語の勉強を頑張りましょう。", language="ja")
        self.assertIsInstance(res.audio_bytes, bytes)
        self.assertGreater(len(res.audio_bytes), 1000)
        self.assertEqual(res.format, "mp3")
        self.assertIn("Nanami", res.voice)

    def test_edge_tts_english_synthesis(self):
        tts = EdgeTTSEngine(default_language="en")
        res = tts.synthesize("Good morning! Let's practice Japanese together.", language="en")
        self.assertIsInstance(res.audio_bytes, bytes)
        self.assertGreater(len(res.audio_bytes), 1000)
        self.assertIn("Jenny", res.voice)

    def test_empty_text_error(self):
        tts = EdgeTTSEngine()
        with self.assertRaises(VoiceError):
            tts.synthesize("")

        with self.assertRaises(VoiceError):
            tts.synthesize("   \n\t  ")


class TestAudioPrivacyAndZeroRetention(unittest.TestCase):
    """Verifies that no microphone audio recordings are stored on disk."""

    def test_zero_disk_storage_guarantee(self):
        pipeline = VoiceTutorPipeline(
            stt_engine=FasterWhisperSTT(model_size="tiny", device="cpu", compute_type="int8"),
            llm_engine=MockLLMEngine(),
            tts_engine=MockTTS(),
            allow_audio_storage=False
        )

        # Count files in tempdir before
        temp_dir = tempfile.gettempdir()
        initial_audio_temps = [f for f in os.listdir(temp_dir) if f.endswith(".audio") or f.endswith(".wav")]

        synthetic_audio = create_synthetic_sine_wave(0.2)
        try:
            pipeline.transcribe(synthetic_audio)
        except (NoSpeechDetectedError, VoiceError):
            pass  # Even if no speech is detected, cleanup MUST happen

        # Check files after
        post_audio_temps = [f for f in os.listdir(temp_dir) if f.endswith(".audio")]
        self.assertEqual(
            len(post_audio_temps),
            0,
            f"Leaked temporary audio files found on disk: {post_audio_temps}"
        )


class TestTranscriptionReviewAndCorrection(unittest.TestCase):
    """Verifies that user can review, edit, and correct transcription before LLM query."""

    def test_user_confirmed_text_overrides_stt(self):
        pipeline = VoiceTutorPipeline(
            stt_engine=MockSTT(canned_response="misheard transcription"),
            llm_engine=MockLLMEngine(),
            tts_engine=MockTTS()
        )

        dummy_audio = create_synthetic_sine_wave(0.5)

        # 1. User reviews transcription and edits it to "corrected Japanese question"
        user_corrected = "毎日日本語を勉強します"
        turn = pipeline.process_turn(
            audio_data=dummy_audio,
            user_confirmed_text=user_corrected
        )

        self.assertEqual(turn.corrected_input, user_corrected)
        self.assertIn(user_corrected, turn.tutor_response)


class TestCompleteAudioToTextToAnswerPath(unittest.TestCase):
    """
    Comprehensive End-to-End Test:
    Generates real Japanese speech -> transcribes with Faster-Whisper ->
    passes to Tutor LLM -> synthesizes answer back to speech with Edge-TTS.
    """

    def test_complete_audio_pipeline(self):
        # 1. Synthesize real spoken Japanese audio using Edge-TTS
        sample_japanese_phrase = "こんにちは"
        tts = EdgeTTSEngine(default_language="ja")
        speech_clip = tts.synthesize(sample_japanese_phrase, language="ja")
        self.assertGreater(len(speech_clip.audio_bytes), 2000)

        # 2. Feed the spoken audio through the real local Faster-Whisper STT
        stt = FasterWhisperSTT(model_size="tiny", device="cpu", compute_type="int8")
        transcription = stt.transcribe(speech_clip.audio_bytes, language="ja")

        self.assertIsNotNone(transcription.text)
        self.assertGreater(len(transcription.text), 0)
        # Faster-Whisper should transcribe 'こんにちは' or similar greeting
        self.assertIn("こんにちは", transcription.text.replace(" ", ""))

        # 3. Query LLM with the transcribed speech
        llm = MockLLMEngine(reply="こんにちは！何か質問はありますか？(Hello! Do you have any questions?)")
        reply = llm.generate_response(transcription.text)
        self.assertIn("こんにちは", reply)

        # 4. Synthesize the tutor's response back into speech
        final_audio = tts.synthesize(reply, language="ja")
        self.assertGreater(len(final_audio.audio_bytes), 3000)
        self.assertEqual(final_audio.format, "mp3")


class TestWebAPIEndpoints(unittest.IsolatedAsyncioTestCase):
    """Tests the aiohttp web server API routes."""

    async def asyncSetUp(self):
        from aiohttp.test_utils import TestClient, TestServer
        self.pipeline = VoiceTutorPipeline(
            stt_engine=MockSTT(canned_response="ありがとう"),
            llm_engine=MockLLMEngine(),
            tts_engine=MockTTS()
        )
        app = create_app(self.pipeline, model_name="Mock Japanese AI Tutor")
        self.server = TestServer(app)
        self.client = TestClient(self.server)
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()

    async def test_get_index(self):
        res = await self.client.get("/")
        self.assertEqual(res.status, 200)
        text = await res.text()
        self.assertIn("Sensei AI Tutor", text)
        self.assertIn("Local STT", text)

    async def test_get_status(self):
        res = await self.client.get("/api/status")
        self.assertEqual(res.status, 200)
        data = await res.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["stt_local"])
        self.assertFalse(data["audio_storage_allowed"])

    async def test_get_privacy(self):
        res = await self.client.get("/api/privacy")
        self.assertEqual(res.status, 200)
        data = await res.json()
        self.assertIn("speech_recognition", data)
        self.assertIn("audio_storage", data)
        self.assertIn("Ephemeral", data["audio_storage"]["policy"])

    async def test_post_chat(self):
        payload = {
            "message": "What does arigatou mean?",
            "history": [],
            "language": "ja",
            "enable_tts": True
        }
        res = await self.client.post("/api/chat", json=payload)
        self.assertEqual(res.status, 200)
        data = await res.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("benkyou", data["response"])
        self.assertIsNotNone(data["audio_base64"])

    async def test_post_transcribe_raw_bytes(self):
        dummy_audio = create_synthetic_sine_wave(0.5)
        res = await self.client.post("/api/transcribe", data=dummy_audio)
        self.assertEqual(res.status, 200)
        data = await res.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["transcription"], "ありがとう")

    async def test_post_tts(self):
        payload = {"text": "こんにちは", "language": "ja"}
        res = await self.client.post("/api/tts", json=payload)
        self.assertEqual(res.status, 200)
        self.assertEqual(res.headers["Content-Type"], "audio/wav")
        body = await res.read()
        self.assertGreater(len(body), 40)


if __name__ == "__main__":
    unittest.main()
