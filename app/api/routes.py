"""
FastAPI Route Handlers for Japanese AI Tutor Backend.
Provides endpoints for health checks, conversational chat inference, and system metadata.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from app.api.schemas import (
    ChatRequest,
    ChatResponse,
    HealthResponse,
    UsageInfo,
    TimingInfo,
    ErrorResponse
)
from app.api.security import sanitize_user_input, verify_api_key
from app.api.config import settings
from app.api.inference import (
    BaseInferenceService,
    InferenceTimeoutError,
    GPUOutOfMemoryError,
    ModelNotLoadedError
)
from app.cli_tutor import SYSTEM_PROMPT

router = APIRouter()

def get_inference_service(request: Request) -> BaseInferenceService:
    """Dependency provider for the shared inference service instance."""
    return request.app.state.inference_service


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service Health Check",
    tags=["System"]
)
@router.get(
    "/api/v1/health",
    response_model=HealthResponse,
    summary="Service Health Check (v1)",
    tags=["System"]
)
async def health_check(
    service: BaseInferenceService = Depends(get_inference_service)
) -> HealthResponse:
    """Returns the operational status, loaded model, adapter verification, and GPU VRAM usage."""
    return service.get_health()


@router.get(
    "/api/v1/info",
    summary="System and Model Metadata",
    tags=["System"]
)
async def system_info(
    service: BaseInferenceService = Depends(get_inference_service)
) -> Dict[str, Any]:
    """Returns metadata about the active model, adapter, and generation defaults."""
    health = service.get_health()
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "model": health.model,
        "is_fine_tuned": health.adapter_loaded,
        "adapter_path": health.adapter_path,
        "license": "Apache-2.0 (Qwen2.5 Base Model) / Custom Educational Weights",
        "limits": {
            "max_message_chars": settings.max_message_chars,
            "max_history_turns": settings.max_history_turns,
            "timeout_seconds": settings.inference_timeout_seconds
        },
        "default_generation": {
            "temperature": 0.3,
            "top_p": 0.9,
            "max_new_tokens": 512,
            "repetition_penalty": 1.15
        }
    }


@router.post(
    "/api/v1/chat",
    response_model=ChatResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Validation or malicious input error"},
        401: {"model": ErrorResponse, "description": "Missing API key"},
        403: {"model": ErrorResponse, "description": "Invalid API key"},
        503: {"model": ErrorResponse, "description": "Model not loaded or GPU OOM"},
        504: {"model": ErrorResponse, "description": "Inference timeout"}
    },
    summary="Generate Japanese Tutor Response",
    tags=["Inference"]
)
async def chat_inference(
    request: ChatRequest,
    service: BaseInferenceService = Depends(get_inference_service),
    _: bool = Depends(verify_api_key)
) -> ChatResponse:
    """
    Submits a user prompt and optional conversation history to the fine-tuned Japanese AI Tutor.
    Validates message lengths, bounds generation settings, and returns structured responses.
    """
    # 1. Sanitize user message
    clean_message = sanitize_user_input(request.message)

    # 2. Build multi-turn messages array
    active_system = request.custom_system_prompt or SYSTEM_PROMPT
    messages: List[Dict[str, str]] = [{"role": "system", "content": active_system}]

    if request.history:
        for turn in request.history:
            clean_turn = sanitize_user_input(turn.content)
            messages.append({"role": turn.role.value, "content": clean_turn})

    messages.append({"role": "user", "content": clean_message})

    # 3. Resolve generation settings
    gen_config = request.generation

    # 4. Execute generation through decoupled inference service
    try:
        reply_text, prompt_tokens, completion_tokens, latency_ms, finish_reason = await service.generate(
            messages=messages,
            gen_config=gen_config,
            timeout_seconds=settings.inference_timeout_seconds
        )
    except ModelNotLoadedError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Inference model is currently unavailable: {e}"
        )
    except InferenceTimeoutError as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Inference request timed out: {e}"
        )
    except GPUOutOfMemoryError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"GPU out of memory: {e}. Please reduce sequence length or concurrency."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during model inference."
        )

    health = service.get_health()

    # 5. Optional Text-to-Speech synthesis
    audio_base64 = None
    if request.enable_tts:
        try:
            from app.voice.tts import EdgeTTSEngine, MockTTS
            tts_engine = MockTTS() if settings.mock_mode else EdgeTTSEngine()
            tts_res = tts_engine.synthesize(text=reply_text, language=request.tts_language or "ja")
            import base64
            audio_base64 = base64.b64encode(tts_res.audio_bytes).decode("ascii")
        except Exception as e:
            # TTS is optional: failure to synthesize does not fail the chat response
            pass

    return ChatResponse(
        status="ok",
        response=reply_text,
        model=health.model,
        is_fine_tuned=health.adapter_loaded,
        finish_reason=finish_reason,
        usage=UsageInfo(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens
        ),
        timings=TimingInfo(
            inference_ms=latency_ms
        ),
        audio_base64=audio_base64
    )


from fastapi import UploadFile, File, Form
from fastapi.responses import Response
from app.api.schemas import TTSRequest, TranscriptionResponse


@router.post(
    "/api/v1/tts",
    summary="Synthesize Text to Speech",
    tags=["Voice"]
)
async def text_to_speech(
    request: TTSRequest,
    _: bool = Depends(verify_api_key)
) -> Response:
    """Synthesizes Japanese or English text into natural neural speech audio (MP3)."""
    from app.voice.tts import EdgeTTSEngine, MockTTS
    tts_engine = MockTTS() if settings.mock_mode else EdgeTTSEngine()
    try:
        tts_res = tts_engine.synthesize(
            text=request.text,
            language=request.language or "ja",
            voice=request.voice
        )
        return Response(
            content=tts_res.audio_bytes,
            media_type="audio/mpeg" if tts_res.format == "mp3" else "audio/wav"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech synthesis error: {e}"
        )


@router.post(
    "/api/v1/transcribe",
    response_model=TranscriptionResponse,
    summary="Transcribe Microphone Audio (Local STT)",
    tags=["Voice"]
)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(default="ja"),
    _: bool = Depends(verify_api_key)
) -> TranscriptionResponse:
    """Transcribes client microphone audio using local on-device Faster-Whisper."""
    from app.voice.stt import FasterWhisperSTT, MockSTT
    from app.voice.exceptions import EmptyAudioError, NoSpeechDetectedError, UnsupportedAudioFormatError

    audio_bytes = await file.read()
    if not audio_bytes or len(audio_bytes) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Audio recording was empty or too short."
        )

    stt_engine = MockSTT() if settings.mock_mode else FasterWhisperSTT(model_size="tiny", device="cpu", compute_type="int8")

    try:
        res = stt_engine.transcribe(audio_bytes, language=language, store_audio=False)
        return TranscriptionResponse(
            status="ok",
            transcription=res.text,
            language=res.language,
            confidence=res.confidence,
            duration=res.duration
        )
    except EmptyAudioError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NoSpeechDetectedError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except UnsupportedAudioFormatError as e:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Transcription error: {e}")

