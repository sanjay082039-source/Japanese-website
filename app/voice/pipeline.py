"""
Voice Pipeline Orchestrator for Japanese AI Tutor.
Coordinates the decoupled STT, LLM, and TTS components, enforcing strict audio privacy
and supporting user transcription review/correction before model submission.
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any, Union, BinaryIO
import logging

from app.voice.stt import BaseSTTEngine, FasterWhisperSTT, TranscriptionResult
from app.voice.tts import BaseTTSEngine, EdgeTTSEngine, TTSResult
from app.voice.llm import BaseLLMEngine, TutorLLMEngine
from app.voice.exceptions import VoiceError

logger = logging.getLogger("VoiceTutor.Pipeline")

@dataclass
class VoiceTurnResult:
    """Result of an end-to-end voice interaction turn."""
    transcription: TranscriptionResult
    tutor_response: str
    synthesized_audio: Optional[TTSResult]
    corrected_input: Optional[str] = None

class VoiceTutorPipeline:
    """
    Decoupled pipeline orchestrator coordinating STT -> Tutor LLM -> TTS.
    Allows independent swapping of any component.
    """

    def __init__(
        self,
        stt_engine: Optional[BaseSTTEngine] = None,
        llm_engine: Optional[BaseLLMEngine] = None,
        tts_engine: Optional[BaseTTSEngine] = None,
        allow_audio_storage: bool = False
    ):
        self.stt = stt_engine or FasterWhisperSTT(model_size="tiny", device="cpu", compute_type="int8")
        self.llm = llm_engine or TutorLLMEngine()
        self.tts = tts_engine or EdgeTTSEngine(default_language="ja")
        self.allow_audio_storage = allow_audio_storage

    def get_privacy_report(self) -> Dict[str, Any]:
        """Returns clear audit metadata documenting where audio and text are processed."""
        return {
            "speech_recognition": {
                "engine": self.stt.name,
                "is_local": self.stt.is_local,
                "data_policy": "100% on-device local transcription. Audio NEVER leaves the host machine."
                if self.stt.is_local else "Audio sent to external ASR service."
            },
            "speech_synthesis": {
                "engine": type(self.tts).__name__,
                "is_local": self.tts.is_local,
                "data_policy": self.tts.provider_info
            },
            "audio_storage": {
                "allowed": self.allow_audio_storage,
                "policy": "Ephemeral in-memory / temporary files strictly unlinked immediately after inference. No voice recordings are retained."
                if not self.allow_audio_storage else "Audio storage is explicitly enabled by configuration."
            }
        }

    # Step 1: Speech-to-Text (Transcribe)
    def transcribe(
        self,
        audio_data: Union[bytes, str, BinaryIO],
        language: Optional[str] = None
    ) -> TranscriptionResult:
        """
        Converts microphone audio to text.
        Never stores the audio unless self.allow_audio_storage is explicitly True.
        """
        return self.stt.transcribe(
            audio_data=audio_data,
            language=language,
            store_audio=self.allow_audio_storage
        )

    # Step 2: Query Tutor LLM with verified/corrected text
    def ask_tutor(
        self,
        user_text: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        """Sends user text (or corrected transcription) to the fine-tuned Japanese AI Tutor LLM."""
        return self.llm.generate_response(
            user_message=user_text,
            conversation_history=conversation_history,
            system_prompt=system_prompt
        )

    # Step 3: Text-to-Speech (Synthesize response)
    def synthesize(
        self,
        text: str,
        language: str = "ja",
        voice: Optional[str] = None
    ) -> TTSResult:
        """Optionally converts tutor response text into spoken audio."""
        return self.tts.synthesize(text=text, language=language, voice=voice)

    # Complete pipeline helper
    def process_turn(
        self,
        audio_data: Union[bytes, str, BinaryIO],
        user_confirmed_text: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        language: Optional[str] = None,
        enable_tts: bool = True
    ) -> VoiceTurnResult:
        """
        Runs the full voice turn:
        1. Transcribes audio if confirmed text is not already provided.
        2. Uses user_confirmed_text if provided (allowing human correction).
        3. Queries the Japanese AI Tutor LLM.
        4. Synthesizes spoken output if enable_tts is True.
        """
        if user_confirmed_text is not None and user_confirmed_text.strip():
            # User reviewed and corrected text directly
            transcription = TranscriptionResult(
                text=user_confirmed_text.strip(),
                language=language or "ja",
                confidence=1.0,
                duration=0.0
            )
            final_query = user_confirmed_text.strip()
        else:
            transcription = self.transcribe(audio_data=audio_data, language=language)
            final_query = transcription.text

        response_text = self.ask_tutor(
            user_text=final_query,
            conversation_history=conversation_history
        )

        audio_res: Optional[TTSResult] = None
        if enable_tts:
            audio_res = self.synthesize(text=response_text, language=language or "ja")

        return VoiceTurnResult(
            transcription=transcription,
            tutor_response=response_text,
            synthesized_audio=audio_res,
            corrected_input=final_query if user_confirmed_text else None
        )
