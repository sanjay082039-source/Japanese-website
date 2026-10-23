# 🚀 Japanese AI Tutor - API Backend Architecture & Deployment Guide

This document describes the minimal REST API backend for the Japanese AI Tutor, including endpoint specifications, CORS configuration, security considerations, rate limiting, and production deployment instructions.

---

## 1. Architectural Design & Concurrency

The API backend is built using **FastAPI** and **Uvicorn**, serving the local fine-tuned `Qwen2.5-1.5B-Instruct` model and verified LoRA adapter (`adapters/japanese-ai-tutor-qlora`).

```
[ Frontend / Website ]
       │  (HTTPS / REST)
       ▼
[ FastAPI App (app/server.py) ]
  ├── CORS Middleware (Configurable Origins)
  ├── Security & Input Sanitization Layer
  └── Pydantic Schema Validation
       │
       ▼
[ Decoupled Inference Engine (app/api/inference.py) ]
  ├── asyncio.Lock (Serialized Thread-Safe GPU Access)
  ├── Timeout Guard (45s Default)
  └── GPU OOM Recovery (Automatic Cache Flushing)
       │
       ▼
[ Fine-Tuned Local LLM (Qwen2.5-1.5B + QLoRA) ]
```

### Zero Paid Model Policy & Independence
- **100% Local Inference**: Responses are generated on your local hardware using the trained QLoRA weights.
- **No External Paid Models**: The system never silently redirects queries to external commercial APIs (e.g., OpenAI, Anthropic). If local GPU resources are unavailable, the API returns a structured HTTP 503 error instead of incurring unbudgeted API expenses.

---

## 2. API Endpoints Specification

### 1. Health Diagnostics: `GET /health` (or `GET /api/v1/health`)
Returns real-time GPU memory allocation, model readiness, and adapter verification.

**Response (HTTP 200 OK):**
```json
{
  "status": "healthy",
  "model": "Qwen/Qwen2.5-1.5B-Instruct",
  "adapter_loaded": true,
  "adapter_path": "adapters/japanese-ai-tutor-qlora",
  "gpu_available": true,
  "vram_allocated_gb": 1.14,
  "vram_reserved_gb": 1.22,
  "vram_total_gb": 5.72,
  "timestamp": "2026-10-22T18:02:11.310015+00:00"
}
```

---

### 2. Chat Inference: `POST /api/v1/chat`
Submits a prompt and optional multi-turn conversation history.

**Request Body:**
```json
{
  "message": "日本語の助詞「は」と「が」の違いを教えてください。",
  "history": [
    {
      "role": "user",
      "content": "こんにちは、先生！"
    },
    {
      "role": "assistant",
      "content": "こんにちは！日本語の勉強を始めましょう。"
    }
  ],
  "generation": {
    "temperature": 0.3,
    "top_p": 0.9,
    "max_new_tokens": 256,
    "repetition_penalty": 1.15
  }
}
```

**Response (HTTP 200 OK):**
```json
{
  "status": "ok",
  "response": "**は**: 主題・文脈の提示に用います。\n**が**: 新情報の導入や主語の特定に用います。",
  "model": "Qwen/Qwen2.5-1.5B-Instruct",
  "is_fine_tuned": true,
  "finish_reason": "stop",
  "usage": {
    "prompt_tokens": 252,
    "completion_tokens": 99,
    "total_tokens": 351
  },
  "timings": {
    "inference_ms": 3484.7
  }
}
```

---

### 3. Metadata & Limits: `GET /api/v1/info`
Returns active generation limits, licensing, and defaults.

---

## 3. CORS Configuration

To allow your future website (e.g., Next.js, Vite, React, or Svelte) to communicate with the API:

### Default Allowed Origins:
- `http://localhost:3000` (Next.js / Create-React-App)
- `http://localhost:5173` (Vite)
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:7860` (Voice Web Client)

### Configuring Custom Domains:
Pass the `TUTOR_CORS_ORIGINS` environment variable as a comma-separated list:
```bash
export TUTOR_CORS_ORIGINS="https://myjapanesetutor.com,https://staging.myjapanesetutor.com"
```
The CORS middleware automatically handles `OPTIONS` preflight requests, sets `Access-Control-Allow-Origin`, and allows `Content-Type` and `X-API-Key` headers.

---

## 4. Security, Credentials & Injection Defense

### 1. Protection Against Arbitrary File Access & Injection
All user inputs pass through [`app/api/security.py`](file:///home/dhanush/.gemini/antigravity-ide/scratch/japanese-ai-tutor/app/api/security.py):
- Rejects directory traversal payloads (`../`, `/etc/`, `/proc/`, `/sys/`, `/home/...`).
- Prohibits shell injection sequences (`; rm`, `| sh`, `& bash`).
- Strips null bytes (`\x00`) to prevent low-level buffer poisoning.
- Restricts message length to $\le 2000$ characters and history to $\le 20$ turns.

### 2. Private Credential Protection
- **No Token Leaks**: Server responses never output environment variables, local system paths, or model tokens.
- **Timing-Attack Resistance**: When API key authentication is enabled, comparison uses constant-time `hmac.compare_digest`.

### 3. Optional API Key Authentication
For public hosting or multi-tenant deployments, define an API key:
```bash
export TUTOR_API_KEY="your-secret-secure-token"
```
When configured, clients must include the header:
```http
X-API-Key: your-secret-secure-token
```
If `TUTOR_API_KEY` is left blank (default), authentication is disabled for straightforward local development.

---

## 5. Concurrency & Rate Limiting

### GPU Concurrency Serialization
Because PyTorch model inference on a single GPU is stateful and memory-intensive:
- An internal `asyncio.Lock` ensures only one token generation pass runs on the GPU at any millisecond.
- Additional requests queue non-blockingly on the event loop rather than causing race conditions or VRAM collisions.

### Recommended Production Rate Limiting
For production deployments exposed to the internet, enforce rate limits at the reverse proxy (Nginx or Caddy) to prevent denial-of-service:

**Nginx Configuration:**
```nginx
# Limit to 15 requests per minute per IP with a burst of 5
limit_req_zone $binary_remote_addr zone=tutor_limit:10m rate=15r/m;

server {
    server_name api.myjapanesetutor.com;

    location /api/v1/chat {
        limit_req zone=tutor_limit burst=5 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

---

## 6. Local Launch & Sample Client Code

### Launch Commands
```bash
# Production GPU Server
.venv/bin/uvicorn app.server:app --host 127.0.0.1 --port 8000

# Or via Python module directly:
.venv/bin/python -m app.server --port 8000

# Fast Mock Mode for Frontend Development (zero GPU needed):
.venv/bin/python -m app.server --port 8000 --mock
```

### Sample cURL Request
```bash
curl -X POST http://127.0.0.1:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I say \"Where is the station?\" in polite Japanese?",
    "generation": {
      "temperature": 0.3,
      "max_new_tokens": 256
    }
  }'
```

### Sample Frontend TypeScript / JavaScript Client (`fetch`)
```typescript
interface ChatResponse {
  status: string;
  response: string;
  model: string;
  is_fine_tuned: boolean;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  timings: { inference_ms: number };
}

async function askSensei(question: string): Promise<string> {
  const res = await fetch("http://127.0.0.1:8000/api/v1/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: question,
      generation: { temperature: 0.3, max_new_tokens: 300 }
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "API request failed");
  }

  const data: ChatResponse = await res.json();
  return data.response;
}
```

---

## 7. Production Deployment Checklist

1. **Hardware**: 1 NVIDIA GPU with $\ge$ 4 GB VRAM (RTX 3050, RTX 4060, T4, A10) and CUDA 12.x.
2. **Systemd Service (`/etc/systemd/system/japanese-tutor-api.service`)**:
   ```ini
   [Unit]
   Description=Japanese AI Tutor FastAPI Service
   After=network.target

   [Service]
   User=dhanush
   WorkingDirectory=/home/dhanush/.gemini/antigravity-ide/scratch/japanese-ai-tutor
   ExecStart=/home/dhanush/.gemini/antigravity-ide/scratch/japanese-ai-tutor/.venv/bin/uvicorn app.server:app --host 127.0.0.1 --port 8000
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
3. **Automated Testing Verification**:
   Always verify the test suite passes before rolling out updates:
   ```bash
   .venv/bin/python -m unittest tests/test_api_backend.py -v
   ```
