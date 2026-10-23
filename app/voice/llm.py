"""
LLM Interface Component for Japanese AI Tutor Voice Pipeline.
Decouples LLM generation from audio input/output, enabling independent testing
and swapping of language models.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Any
import logging

from app.voice.exceptions import LLMUnavailableError

logger = logging.getLogger("VoiceTutor.LLM")

class BaseLLMEngine(ABC):
    """Abstract interface for Japanese Tutor language models."""

    @abstractmethod
    def generate_response(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        """Generates the tutor response given the user message and optional turn history."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Human-readable model name."""
        pass


class TutorLLMEngine(BaseLLMEngine):
    """
    Production LLM Engine using the trained Japanese AI Tutor
    (Qwen2.5-1.5B-Instruct + Fine-tuned QLoRA adapter).
    """

    def __init__(
        self,
        base_model_id: str = "Qwen/Qwen2.5-1.5B-Instruct",
        adapter_path: Optional[str] = "adapters/japanese-ai-tutor-qlora",
        quant: str = "4bit"
    ):
        self.base_model_id = base_model_id
        self.adapter_path = adapter_path
        self.quant = quant
        self.model = None
        self.tokenizer = None
        self.is_fine_tuned = False

    def load(self):
        """Loads and verifies the base model and adapter."""
        if self.model is None:
            try:
                from app.cli_tutor import load_tutor_model
                self.model, self.tokenizer, self.is_fine_tuned = load_tutor_model(
                    base_model_id=self.base_model_id,
                    adapter_path=self.adapter_path,
                    quant=self.quant
                )
            except Exception as e:
                raise LLMUnavailableError(f"Failed to load tutor model: {e}") from e

    @property
    def model_name(self) -> str:
        adapter_note = f" + LoRA ({self.adapter_path})" if self.is_fine_tuned else " (Base)"
        return f"{self.base_model_id}{adapter_note}"

    def generate_response(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        if self.model is None:
            self.load()

        from app.cli_tutor import SYSTEM_PROMPT, generate_response

        active_system = system_prompt or SYSTEM_PROMPT
        messages = [{"role": "system", "content": active_system}]

        if conversation_history:
            messages.extend(conversation_history)

        messages.append({"role": "user", "content": user_message})

        try:
            return generate_response(
                model=self.model,
                tokenizer=self.tokenizer,
                messages=messages,
                temperature=0.3,
                top_p=0.9,
                max_new_tokens=512,
                stream=False
            )
        except Exception as e:
            raise LLMUnavailableError(f"Generation error: {e}") from e


class MockLLMEngine(BaseLLMEngine):
    """Deterministic Mock LLM for rapid unit testing without GPU overhead."""

    def __init__(self, reply: Optional[str] = None):
        self.reply = reply or (
            "こんにちは！(Konnichiwa! / Hello!)\n"
            "「勉強」【べんきょう】(benkyou) means 'study' or 'diligence' in Japanese.\n"
            "Keep up the great work! 🌸"
        )

    @property
    def model_name(self) -> str:
        return "Mock Tutor LLM (Test Engine)"

    def generate_response(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        system_prompt: Optional[str] = None
    ) -> str:
        if not user_message.strip():
            raise LLMUnavailableError("Cannot generate response for empty user message.")
        return f"{self.reply}\n(Echo: {user_message})"
