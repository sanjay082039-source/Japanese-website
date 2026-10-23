"""
Model Inference Service for Japanese AI Tutor API.
Decouples model loading, adapter verification, and GPU generation logic
from FastAPI request-handling code.
"""

import os
import time
import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional, Any

import torch
from app.api.schemas import HealthResponse, GenerationConfig

logger = logging.getLogger("TutorAPI.Inference")

class InferenceError(Exception):
    """Base exception for inference errors."""
    pass

class ModelNotLoadedError(InferenceError):
    """Raised when inference is attempted before the model is loaded."""
    pass

class InferenceTimeoutError(InferenceError):
    """Raised when inference exceeds the configured timeout threshold."""
    pass

class GPUOutOfMemoryError(InferenceError):
    """Raised when GPU VRAM is exhausted during generation."""
    pass


class BaseInferenceService(ABC):
    """Abstract interface for AI Tutor inference engines."""

    @abstractmethod
    async def generate(
        self,
        messages: List[Dict[str, str]],
        gen_config: GenerationConfig,
        timeout_seconds: float = 45.0
    ) -> Tuple[str, int, int, float, str]:
        """
        Executes text generation.
        Returns:
            Tuple of (response_text, prompt_tokens, completion_tokens, latency_ms, finish_reason)
        """
        pass

    @abstractmethod
    def get_health(self) -> HealthResponse:
        """Returns health and resource metrics."""
        pass

    @property
    @abstractmethod
    def is_loaded(self) -> bool:
        pass


class TutorInferenceService(BaseInferenceService):
    """
    Production inference service wrapping the fine-tuned QLoRA Japanese AI Tutor.
    Enforces thread-safe GPU access via asyncio.Lock and robust OOM recovery.
    """

    def __init__(
        self,
        base_model_id: str = "Qwen/Qwen2.5-1.5B-Instruct",
        adapter_path: Optional[str] = "adapters/japanese-ai-tutor-qlora",
        quantization: str = "4bit"
    ):
        self.base_model_id = base_model_id
        self.adapter_path = adapter_path
        self.quantization = quantization

        self.model = None
        self.tokenizer = None
        self.is_fine_tuned = False
        self._lock = asyncio.Lock()
        self._load_error: Optional[str] = None

    def load_model(self):
        """Loads and verifies tokenizer, base model, and LoRA adapter."""
        logger.info(f"Loading Base Model: '{self.base_model_id}', Adapter: '{self.adapter_path}'...")
        try:
            from app.cli_tutor import load_tutor_model
            self.model, self.tokenizer, self.is_fine_tuned = load_tutor_model(
                base_model_id=self.base_model_id,
                adapter_path=self.adapter_path,
                quant=self.quantization
            )
            self._load_error = None
            logger.info("Model and LoRA adapter loaded successfully.")
        except Exception as e:
            self._load_error = str(e)
            logger.error(f"Failed to load tutor model: {e}", exc_info=True)
            raise ModelNotLoadedError(f"Model initialization failed: {e}") from e

    @property
    def is_loaded(self) -> bool:
        return self.model is not None and self.tokenizer is not None

    def _sync_generate(
        self,
        messages: List[Dict[str, str]],
        gen_config: GenerationConfig
    ) -> Tuple[str, int, int, float, str]:
        """Synchronous generation executed inside a background thread pool."""
        if not self.is_loaded:
            raise ModelNotLoadedError("Model is not initialized.")

        start_time = time.perf_counter()

        # Format with chat template
        chat_prompt = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        device = "cuda" if torch.cuda.is_available() else "cpu"
        inputs = self.tokenizer(chat_prompt, return_tensors="pt").to(device)
        prompt_tokens = int(inputs["input_ids"].shape[1])

        try:
            with torch.no_grad():
                output_ids = self.model.generate(
                    **inputs,
                    max_new_tokens=gen_config.max_new_tokens,
                    temperature=gen_config.temperature,
                    top_p=gen_config.top_p,
                    repetition_penalty=gen_config.repetition_penalty,
                    do_sample=True if gen_config.temperature > 0 else False,
                    pad_token_id=self.tokenizer.pad_token_id
                )
        except torch.cuda.OutOfMemoryError as e:
            logger.error(f"GPU OOM during generation: {e}")
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            raise GPUOutOfMemoryError(
                "GPU VRAM exhausted during token generation. The request was aborted to safeguard system stability."
            ) from e

        response_ids = output_ids[0][prompt_tokens:]
        completion_tokens = int(len(response_ids))
        response_text = self.tokenizer.decode(response_ids, skip_special_tokens=True).strip()

        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        finish_reason = "length" if completion_tokens >= gen_config.max_new_tokens else "stop"

        return response_text, prompt_tokens, completion_tokens, latency_ms, finish_reason

    async def generate(
        self,
        messages: List[Dict[str, str]],
        gen_config: GenerationConfig,
        timeout_seconds: float = 45.0
    ) -> Tuple[str, int, int, float, str]:
        if not self.is_loaded:
            raise ModelNotLoadedError("Inference service is not loaded or has failed initialization.")

        # Serialize GPU inference via lock to prevent race conditions & multi-request VRAM spikes
        async with self._lock:
            try:
                return await asyncio.wait_for(
                    asyncio.to_thread(self._sync_generate, messages, gen_config),
                    timeout=timeout_seconds
                )
            except asyncio.TimeoutError as e:
                logger.warning(f"Inference timed out after {timeout_seconds} seconds.")
                raise InferenceTimeoutError(
                    f"Model generation exceeded the maximum timeout of {timeout_seconds}s."
                ) from e

    def get_health(self) -> HealthResponse:
        vram_alloc = 0.0
        vram_res = 0.0
        vram_tot = 0.0
        gpu_ok = torch.cuda.is_available()

        if gpu_ok:
            try:
                vram_alloc = round(torch.cuda.memory_allocated() / (1024 ** 3), 2)
                vram_res = round(torch.cuda.memory_reserved() / (1024 ** 3), 2)
                vram_tot = round(torch.cuda.get_device_properties(0).total_memory / (1024 ** 3), 2)
            except Exception:
                pass

        if self._load_error:
            status = "degraded"
        elif self.is_loaded:
            status = "healthy"
        else:
            status = "initializing"

        return HealthResponse(
            status=status,
            model=self.base_model_id,
            adapter_loaded=self.is_fine_tuned,
            adapter_path=self.adapter_path if self.is_fine_tuned else None,
            gpu_available=gpu_ok,
            vram_allocated_gb=vram_alloc,
            vram_reserved_gb=vram_res,
            vram_total_gb=vram_tot,
            timestamp=datetime.now(timezone.utc).isoformat()
        )


class MockInferenceService(BaseInferenceService):
    """Deterministic Mock Inference Engine for fast unit tests without GPU overhead."""

    def __init__(self, response_text: Optional[str] = None):
        self.response_text = response_text or (
            "こんにちは！(Konnichiwa!)\n"
            "「猫」【ねこ】(neko) means 'cat' in Japanese! 🐱\n"
            "Keep up the great study!"
        )
        self.is_fine_tuned = True
        self.should_timeout = False
        self.should_oom = False
        self.should_fail_load = False

    @property
    def is_loaded(self) -> bool:
        return not self.should_fail_load

    async def generate(
        self,
        messages: List[Dict[str, str]],
        gen_config: GenerationConfig,
        timeout_seconds: float = 45.0
    ) -> Tuple[str, int, int, float, str]:
        if not self.is_loaded:
            raise ModelNotLoadedError("Mock service simulated model unavailable.")
        if self.should_timeout:
            raise InferenceTimeoutError(f"Generation timed out after {timeout_seconds}s.")
        if self.should_oom:
            raise GPUOutOfMemoryError("Mock GPU VRAM simulated out of memory.")

        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        reply = f"{self.response_text}\n(Echo: {last_user})"
        prompt_tokens = sum(len(m["content"].split()) for m in messages) + 10
        completion_tokens = len(reply.split())
        return reply, prompt_tokens, completion_tokens, 15.5, "stop"

    def get_health(self) -> HealthResponse:
        return HealthResponse(
            status="healthy" if self.is_loaded else "degraded",
            model="Qwen/Qwen2.5-1.5B-Instruct-Mock",
            adapter_loaded=self.is_fine_tuned,
            adapter_path="adapters/japanese-ai-tutor-qlora",
            gpu_available=True,
            vram_allocated_gb=1.14,
            vram_reserved_gb=1.22,
            vram_total_gb=5.72,
            timestamp=datetime.now(timezone.utc).isoformat()
        )
