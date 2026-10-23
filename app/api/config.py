"""
Configuration settings for the Japanese AI Tutor API backend.
Supports environment variables and command-line overrides with sensible defaults.
"""

import os
from typing import List
from pydantic import BaseModel, Field

class APISettings(BaseModel):
    """API server configuration settings."""
    app_name: str = "Japanese AI Tutor API"
    app_version: str = "1.0.0"
    host: str = Field(default_factory=lambda: os.getenv("TUTOR_HOST", "127.0.0.1"))
    port: int = Field(default_factory=lambda: int(os.getenv("TUTOR_PORT", "8000")))

    # Model & Adapter Settings
    base_model_id: str = Field(
        default_factory=lambda: os.getenv("TUTOR_BASE_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
    )
    adapter_path: str = Field(
        default_factory=lambda: os.getenv("TUTOR_ADAPTER_PATH", "adapters/japanese-ai-tutor-qlora")
    )
    quantization: str = Field(
        default_factory=lambda: os.getenv("TUTOR_QUANT", "4bit")
    )

    # Safety & Resource Bounds
    max_message_chars: int = Field(
        default_factory=lambda: int(os.getenv("TUTOR_MAX_MESSAGE_CHARS", "2000"))
    )
    max_history_turns: int = Field(
        default_factory=lambda: int(os.getenv("TUTOR_MAX_HISTORY_TURNS", "20"))
    )
    inference_timeout_seconds: float = Field(
        default_factory=lambda: float(os.getenv("TUTOR_TIMEOUT_SECONDS", "45.0"))
    )

    # CORS Settings
    cors_origins: List[str] = Field(
        default_factory=lambda: os.getenv(
            "TUTOR_CORS_ORIGINS",
            "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:7860"
        ).split(",")
    )

    # Optional Authentication (if non-empty, requires X-API-Key header)
    api_key: str = Field(default_factory=lambda: os.getenv("TUTOR_API_KEY", ""))

    # Mock mode (for fast CI / unit testing without GPU)
    mock_mode: bool = Field(
        default_factory=lambda: os.getenv("TUTOR_MOCK_MODE", "false").lower() in ("true", "1", "yes")
    )

settings = APISettings()
