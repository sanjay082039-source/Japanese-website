#!/usr/bin/env python3
"""
Japanese AI Tutor - Minimal Production API Server
Provides high-performance, validated REST endpoints for web applications.
"""

import os
import sys
import argparse
import logging
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.config import settings
from app.api.routes import router
from app.api.inference import (
    BaseInferenceService,
    TutorInferenceService,
    MockInferenceService
)
from app.api.schemas import ErrorResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("TutorAPI.Server")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager handling model initialization and GPU shutdown."""
    logger.info("=" * 60)
    logger.info(" 🌸 STARTING JAPANESE AI TUTOR API BACKEND")
    logger.info(f" Host:             {settings.host}:{settings.port}")
    logger.info(f" Base Model:       {settings.base_model_id}")
    logger.info(f" Adapter:          {settings.adapter_path}")
    logger.info(f" Quantization:     {settings.quantization}")
    logger.info(f" Mock Mode:        {settings.mock_mode}")
    logger.info(f" Allowed Origins:  {settings.cors_origins}")
    logger.info("=" * 60)

    # 1. Initialize Inference Service
    if settings.mock_mode:
        logger.info("Running in Mock Mode (fast unit-testing service).")
        inference_service = MockInferenceService()
    else:
        logger.info("Initializing GPU Tutor Inference Service...")
        inference_service = TutorInferenceService(
            base_model_id=settings.base_model_id,
            adapter_path=settings.adapter_path,
            quantization=settings.quantization
        )
        try:
            inference_service.load_model()
        except Exception as e:
            logger.error(f"Critical failure during model loading: {e}", exc_info=True)
            # In production, we keep the service in degraded state so /health returns informative status
            logger.warning("Server will start in degraded state; /health will report unavailable status.")

    app.state.inference_service = inference_service
    yield

    # 2. Shutdown Cleanup
    logger.info("Shutting down Tutor API server...")
    if hasattr(app.state, "inference_service"):
        app.state.inference_service = None
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
    logger.info("Cleanup complete.")


def create_app(service: Optional[BaseInferenceService] = None) -> FastAPI:
    """Factory function creating and configuring the FastAPI instance."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Minimal REST API backend serving the fine-tuned Japanese AI Tutor (Qwen2.5-1.5B QLoRA). "
            "Provides strictly validated chat endpoints, health diagnostics, and safe generation bounds."
        ),
        lifespan=lifespan
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # Custom Validation Error Handler
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        details = exc.errors()
        error_msg = "; ".join(f"{e.get('loc', ['field'])[-1]}: {e.get('msg', 'invalid')}" for e in details)
        return JSONResponse(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            content=ErrorResponse(
                status="error",
                error="Request validation failed.",
                detail=error_msg,
                error_code="VALIDATION_ERROR"
            ).model_dump()
        )

    # Attach API router
    app.include_router(router)

    if service is not None:
        app.state.inference_service = service

    # Mount compiled Single Page Application frontend if built
    from fastapi.staticfiles import StaticFiles
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
    if os.path.exists(frontend_dist):
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app


# Module-level app instance for ASGI servers (e.g. uvicorn app.server:app)
app = create_app()


def main():
    parser = argparse.ArgumentParser(description="Japanese AI Tutor - API Server")
    parser.add_argument("--host", default=settings.host, help="Bind address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=settings.port, help="Bind port (default: 8000)")
    parser.add_argument("--base-model", default=settings.base_model_id, help="Base Hugging Face model identifier")
    parser.add_argument("--adapter-path", default=settings.adapter_path, help="Path to fine-tuned LoRA adapter")
    parser.add_argument("--quant", default=settings.quantization, choices=["4bit", "8bit", "none"], help="Quantization")
    parser.add_argument("--mock", action="store_true", help="Launch in lightweight mock mode for testing")
    parser.add_argument("--api-key", default="", help="Optional API key requirement")
    args = parser.parse_args()

    # Apply CLI overrides to settings
    settings.host = args.host
    settings.port = args.port
    settings.base_model_id = args.base_model
    settings.adapter_path = args.adapter_path
    settings.quantization = args.quant
    settings.mock_mode = args.mock
    settings.api_key = args.api_key

    uvicorn.run(
        "app.server:app",
        host=args.host,
        port=args.port,
        reload=False,
        log_level="info"
    )


if __name__ == "__main__":
    main()
