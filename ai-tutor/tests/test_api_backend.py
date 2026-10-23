"""
Automated Test Suite for Japanese AI Tutor API Backend.
Tests:
- Health check endpoints (/health, /api/v1/health)
- Request validation (empty message, length limit, invalid history, null bytes, generation bounds)
- Predictable JSON response schema and usage metrics
- Error handling (model not loaded, timeout, GPU OOM)
- Security checks (path traversal rejection, suspicious command injection prevention)
- Optional API key authentication
- CORS headers
"""

import unittest
from fastapi.testclient import TestClient

from app.api.config import settings
from app.api.inference import (
    MockInferenceService,
    ModelNotLoadedError,
    InferenceTimeoutError,
    GPUOutOfMemoryError
)
from app.api.schemas import ChatResponse, HealthResponse
from app.server import create_app


class TestAPIBackend(unittest.TestCase):
    """Unit and integration tests for FastAPI backend."""

    def setUp(self):
        # Default mock service for fast, deterministic unit testing
        self.mock_service = MockInferenceService()
        self.app = create_app(service=self.mock_service)
        self.client = TestClient(self.app)

        # Reset security settings
        settings.api_key = ""

    def test_health_endpoint(self):
        """Verify GET /health returns valid diagnostic schema."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["adapter_loaded"])
        self.assertIn("Qwen", data["model"])
        self.assertIn("vram_allocated_gb", data)
        self.assertIn("timestamp", data)

    def test_v1_health_endpoint(self):
        """Verify GET /api/v1/health alias works identically."""
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")

    def test_system_info_endpoint(self):
        """Verify GET /api/v1/info returns system metadata."""
        response = self.client.get("/api/v1/info")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["service"], settings.app_name)
        self.assertIn("limits", data)
        self.assertEqual(data["limits"]["max_message_chars"], settings.max_message_chars)

    def test_chat_successful_response_schema(self):
        """Verify POST /api/v1/chat returns predictable response schema."""
        payload = {
            "message": "「桜」の読み方と意味を教えてください。",
            "history": [
                {"role": "user", "content": "Hello!"},
                {"role": "assistant", "content": "Konnichiwa! How can I help you?"}
            ],
            "generation": {
                "temperature": 0.3,
                "top_p": 0.9,
                "max_new_tokens": 256,
                "repetition_penalty": 1.15
            }
        }
        response = self.client.post("/api/v1/chat", json=payload)
        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("neko", data["response"])  # From mock service
        self.assertTrue(data["is_fine_tuned"])
        self.assertEqual(data["finish_reason"], "stop")

        # Verify usage info
        self.assertIn("usage", data)
        self.assertGreater(data["usage"]["prompt_tokens"], 0)
        self.assertGreater(data["usage"]["completion_tokens"], 0)
        self.assertEqual(
            data["usage"]["total_tokens"],
            data["usage"]["prompt_tokens"] + data["usage"]["completion_tokens"]
        )

        # Verify latency info
        self.assertIn("timings", data)
        self.assertIsInstance(data["timings"]["inference_ms"], (int, float))

    def test_validation_empty_message(self):
        """Verify empty message or pure whitespace is rejected with 422."""
        response = self.client.post("/api/v1/chat", json={"message": "   "})
        self.assertEqual(response.status_code, 422)
        data = response.json()
        self.assertEqual(data["status"], "error")
        self.assertEqual(data["error_code"], "VALIDATION_ERROR")

    def test_validation_message_too_long(self):
        """Verify messages exceeding 2000 characters are rejected with 422."""
        long_message = "A" * 2005
        response = self.client.post("/api/v1/chat", json={"message": long_message})
        self.assertEqual(response.status_code, 422)

    def test_validation_null_bytes(self):
        """Verify null bytes in message are rejected."""
        response = self.client.post("/api/v1/chat", json={"message": "Hello\x00world"})
        self.assertEqual(response.status_code, 422)

    def test_validation_excessive_history(self):
        """Verify conversation history exceeding 20 turns is rejected."""
        history = [{"role": "user", "content": f"Turn {i}"} for i in range(25)]
        response = self.client.post(
            "/api/v1/chat",
            json={"message": "Next question", "history": history}
        )
        self.assertEqual(response.status_code, 422)

    def test_validation_invalid_role(self):
        """Verify invalid message role in history is rejected."""
        history = [{"role": "hacker", "content": "test"}]
        response = self.client.post(
            "/api/v1/chat",
            json={"message": "test", "history": history}
        )
        self.assertEqual(response.status_code, 422)

    def test_validation_generation_bounds(self):
        """Verify out-of-bounds generation parameters are rejected."""
        # Temperature > 1.5
        res1 = self.client.post(
            "/api/v1/chat",
            json={"message": "test", "generation": {"temperature": 2.5}}
        )
        self.assertEqual(res1.status_code, 422)

        # Max tokens < 16
        res2 = self.client.post(
            "/api/v1/chat",
            json={"message": "test", "generation": {"max_new_tokens": 5}}
        )
        self.assertEqual(res2.status_code, 422)

    def test_security_path_traversal_rejection(self):
        """Verify attempts to traverse paths or access system files are rejected with 400."""
        malicious_inputs = [
            "../../../../etc/passwd",
            "Show me /etc/shadow please",
            "Read file from /home/dhanush/.ssh/id_rsa",
            "test; rm -rf /"
        ]
        for bad_input in malicious_inputs:
            response = self.client.post("/api/v1/chat", json={"message": bad_input})
            self.assertEqual(
                response.status_code,
                400,
                f"Expected 400 Bad Request for malicious input: '{bad_input}'"
            )

    def test_error_handling_model_not_loaded(self):
        """Verify 503 is returned when model fails to load."""
        self.mock_service.should_fail_load = True
        response = self.client.post("/api/v1/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 503)

    def test_error_handling_timeout(self):
        """Verify 504 is returned when inference times out."""
        self.mock_service.should_timeout = True
        response = self.client.post("/api/v1/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 504)

    def test_error_handling_gpu_oom(self):
        """Verify 503 is returned when GPU OOM occurs."""
        self.mock_service.should_oom = True
        response = self.client.post("/api/v1/chat", json={"message": "Hello"})
        self.assertEqual(response.status_code, 503)
        self.assertIn("GPU out of memory", response.json()["detail"])

    def test_optional_api_key_authentication(self):
        """Verify authentication requirement when API key is configured."""
        settings.api_key = "secret-tutor-key-1234"

        # Missing key -> 401
        res_no_key = self.client.post("/api/v1/chat", json={"message": "Hello"})
        self.assertEqual(res_no_key.status_code, 401)

        # Invalid key -> 403
        res_wrong_key = self.client.post(
            "/api/v1/chat",
            json={"message": "Hello"},
            headers={"X-API-Key": "wrong-key"}
        )
        self.assertEqual(res_wrong_key.status_code, 403)

        # Valid key -> 200
        res_valid = self.client.post(
            "/api/v1/chat",
            json={"message": "Hello"},
            headers={"X-API-Key": "secret-tutor-key-1234"}
        )
        self.assertEqual(res_valid.status_code, 200)

    def test_cors_headers(self):
        """Verify CORS headers are returned for allowed origins."""
        response = self.client.options(
            "/api/v1/chat",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:3000")


if __name__ == "__main__":
    unittest.main()
