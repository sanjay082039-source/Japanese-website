"""
Pydantic Request and Response Schemas for Japanese AI Tutor API.
Enforces rigorous validation on message lengths, history size, and generation bounds.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    """A single turn in the conversation history."""
    role: MessageRole = Field(..., description="Role of the speaker: 'user' or 'assistant'.")
    content: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Text content of the message turn (1 to 2000 characters)."
    )

    @field_validator("content")
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Message content cannot be empty or purely whitespace.")
        # Reject null bytes and non-printable control characters that could trigger exploits
        if "\x00" in stripped:
            raise ValueError("Null bytes are prohibited in message content.")
        return stripped


class GenerationConfig(BaseModel):
    """Configurable generation parameters with safe boundaries."""
    temperature: float = Field(
        default=0.3,
        ge=0.0,
        le=1.5,
        description="Sampling temperature (0.0 = greedy/deterministic, 1.5 = highly creative)."
    )
    top_p: float = Field(
        default=0.9,
        ge=0.1,
        le=1.0,
        description="Nucleus sampling threshold."
    )
    max_new_tokens: int = Field(
        default=512,
        ge=16,
        le=1024,
        description="Maximum new tokens generated per response (16 to 1024)."
    )
    repetition_penalty: float = Field(
        default=1.15,
        ge=1.0,
        le=2.0,
        description="Penalty for repeating token sequences (1.0 = no penalty)."
    )


class ChatRequest(BaseModel):
    """Input payload for the /api/v1/chat endpoint."""
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="User question or prompt to the Japanese AI Tutor (1 to 2000 characters)."
    )
    history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="Optional prior conversation turns (maximum 20 turns)."
    )
    generation: Optional[GenerationConfig] = Field(
        default_factory=GenerationConfig,
        description="Optional custom generation parameters."
    )
    enable_tts: Optional[bool] = Field(
        default=False,
        description="Optionally synthesize spoken audio for the response."
    )
    tts_language: Optional[str] = Field(
        default="ja",
        description="Language for speech synthesis ('ja' or 'en')."
    )
    custom_system_prompt: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Optional override for pedagogical system prompt."
    )

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("User message cannot be empty or solely whitespace.")
        if "\x00" in cleaned:
            raise ValueError("Null bytes are prohibited.")
        return cleaned

    @field_validator("history")
    @classmethod
    def validate_history_length(cls, v: Optional[List[ChatMessage]]) -> Optional[List[ChatMessage]]:
        if v is not None and len(v) > 20:
            raise ValueError(f"History cannot exceed 20 turns (received {len(v)} turns).")
        return v


class UsageInfo(BaseModel):
    """Token consumption statistics."""
    prompt_tokens: int = Field(..., description="Estimated or actual tokens in the prompt.")
    completion_tokens: int = Field(..., description="Tokens generated in the response.")
    total_tokens: int = Field(..., description="Total tokens processed.")


class TimingInfo(BaseModel):
    """Latency breakdown for the request."""
    inference_ms: float = Field(..., description="Time spent executing model inference in milliseconds.")


class ChatResponse(BaseModel):
    """Predictable output payload for the /api/v1/chat endpoint."""
    status: str = Field(default="ok", description="Status indicator: 'ok'.")
    response: str = Field(..., description="Assistant response text with Japanese annotations and English explanations.")
    model: str = Field(..., description="Base model name.")
    is_fine_tuned: bool = Field(..., description="True if fine-tuned LoRA adapter is loaded and active.")
    finish_reason: str = Field(default="stop", description="Reason inference terminated ('stop' or 'length').")
    usage: UsageInfo = Field(..., description="Token usage statistics.")
    timings: TimingInfo = Field(..., description="Inference latency metrics.")
    audio_base64: Optional[str] = Field(default=None, description="Base64-encoded MP3 audio if TTS was requested.")


class TranscriptionResponse(BaseModel):
    """Payload returned by /api/v1/transcribe."""
    status: str = Field(default="ok")
    transcription: str
    language: str
    confidence: float
    duration: float


class TTSRequest(BaseModel):
    """Input payload for /api/v1/tts."""
    text: str = Field(..., min_length=1, max_length=1000)
    language: Optional[str] = Field(default="ja")
    voice: Optional[str] = Field(default=None)



class HealthResponse(BaseModel):
    """Status payload for the /health endpoint."""
    status: str = Field(..., description="Service health: 'healthy', 'degraded', or 'initializing'.")
    model: str = Field(..., description="Loaded base model identifier.")
    adapter_loaded: bool = Field(..., description="True if fine-tuned LoRA adapter is verified.")
    adapter_path: Optional[str] = Field(default=None, description="Path to active adapter.")
    gpu_available: bool = Field(..., description="True if NVIDIA CUDA GPU is available.")
    vram_allocated_gb: float = Field(..., description="Current GPU VRAM allocated in GB.")
    vram_reserved_gb: float = Field(..., description="Current GPU VRAM reserved in GB.")
    vram_total_gb: float = Field(..., description="Total GPU VRAM in GB.")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp.")


class ErrorResponse(BaseModel):
    """Predictable error payload for failed requests."""
    status: str = Field(default="error", description="Status indicator: 'error'.")
    error: str = Field(..., description="Short error summary.")
    detail: Optional[str] = Field(default=None, description="Detailed explanatory message.")
    error_code: str = Field(..., description="Structured machine-readable error code.")
