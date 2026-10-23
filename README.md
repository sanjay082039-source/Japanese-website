# 🌸 Japanese AI Tutor (日本語 AI チューター)

An open-source, conversational AI tutor fine-tuned with **4-bit QLoRA** on modern multilingual language models. Built to run locally on consumer NVIDIA GPUs (e.g., RTX 4050 / RTX 3050 with 6GB VRAM) or on free cloud hardware (Google Colab T4) with zero proprietary API fees (₹0 / $0 budget).

---

## 📑 Table of Contents
1. [Project Purpose](#1-project-purpose)
2. [Architecture and Workflow](#2-architecture-and-workflow)
3. [Prerequisites](#3-prerequisites)
4. [Installation Instructions](#4-installation-instructions)
5. [Dataset Preparation & Quality Control](#5-dataset-preparation--quality-control)
6. [Training Commands (Local GPU)](#6-training-commands-local-gpu)
7. [How to Resume Training](#7-how-to-resume-training)
8. [How to Load and Verify the Adapter](#8-how-to-load-and-verify-the-adapter)
9. [How to Test the Chatbot](#9-how-to-test-the-chatbot)
10. [How to Use the Colab Notebook](#10-how-to-use-the-colab-notebook)
11. [How to Start the REST API Backend](#11-how-to-start-the-rest-api-backend)
12. [Troubleshooting Guide](#12-troubleshooting-guide)
13. [Known Limitations and Future Improvements](#13-known-limitations-and-future-improvements)

---

## 1. Project Purpose

Learning Japanese presents unique challenges: kanji readings with multiple pronunciations (*onyomi* and *kunyomi*), subtle particle distinctions (such as は vs. が or に vs. で), varying politeness registers (*keigo* vs. casual speech), and contextual omission of subjects.

The **Japanese AI Tutor** ("Sensei") provides an encouraging, pedagogically sound conversational partner that:
- **Prioritizes Direct Answers:** Directly answers questions before providing explanations.
- **Annotates Readings:** Formats Japanese expressions with Furigana (e.g., `勉強【べんきょう】`) and Romaji alongside clear English explanations.
- **Corrects Gently:** Kindly explains why phrasing is unnatural and provides native alternatives rather than just stating an error.
- **Maintains Pedagogical Boundaries:** Answers general knowledge questions directly in English without forcing an artificial Japanese grammar drill into unrelated topics.
- **Expresses Intellectual Humility:** Openly acknowledges uncertain slang origins, dialect variations, or disputed etymologies instead of inventing facts.
- **Strictly ₹0 Budget & Privacy-First:** Uses open-weight models (Apache 2.0), local offline speech recognition, and zero paid cloud subscriptions.

---

## 2. Architecture and Workflow

The system is engineered as a modular pipeline where data preparation, model training, evaluation, inference, speech processing, and web serving are completely decoupled:

```
[ Raw Curated Data (Tatoeba / Tanaka / JLPT) ]
                     │
                     ▼
[ Validation & Quality Pipeline (scripts/validate_dataset.py) ]
                     │
                     ▼ (Cleaned ChatML JSONL)
[ Base Model: Qwen/Qwen2.5-1.5B-Instruct (4-bit NF4) ]
                     │
                     ▼ (TRL SFTTrainer + PEFT LoRA)
[ Fine-Tuned LoRA Adapter (adapters/japanese-ai-tutor-qlora) ]
                     │
         ┌───────────┴───────────┬───────────────────────┐
         ▼                       ▼                       ▼
[ Terminal Sensei Chat ]   [ Voice Web App ]     [ FastAPI Backend ]
  (app/cli_tutor.py)     (app/web_tutor.py)       (app/server.py)
   - Multi-turn context   - Faster-Whisper (Local)  - REST JSON /api/v1/chat
   - Context pruning      - Edge-TTS Spoken Audio   - Health & VRAM Metrics
   - /status & /clear     - Transcription Review    - Thread-Safe GPU Lock
```

### Component Decoupling
- **Model Training:** Standalone scripts in `scripts/` using Hugging Face `transformers`, `peft`, `trl`, and `bitsandbytes`.
- **Inference Layer:** Standardized loading in `app/cli_tutor.py` that strictly verifies adapter loading (never silently falls back to un-adapted base models).
- **Speech Pipeline:** Separate STT (`FasterWhisperSTT`), LLM (`TutorLLMEngine`), and TTS (`EdgeTTSEngine`) interfaces in `app/voice/`.
- **API Backend:** Modular FastAPI server with Pydantic validation, CORS middleware, and input sanitization in `app/server.py` and `app/api/`.

---

## 3. Prerequisites

### Hardware
- **GPU (Recommended):** NVIDIA GPU with $\ge$ 4 GB to 6 GB VRAM (tested on NVIDIA GeForce RTX 4050 Laptop GPU, 6 GB VRAM; also verified on Google Colab Tesla T4, 15 GB VRAM).
- **CPU Fallback:** x86_64 CPU with $\ge$ 8 GB RAM (inference only; training on CPU is not recommended).
- **Disk Space:** $\ge$ 10 GB free space for virtual environment, base model weights, and checkpoints.

### Software
- **Operating System:** Linux (Arch Linux, CachyOS, Ubuntu 22.04+, Debian 12+, Fedora 38+).
- **NVIDIA Drivers & CUDA:** Driver supporting CUDA 12.0+ (`nvidia-smi`).
- **Python:** Python 3.10, 3.11, or 3.12 (Python 3.11 recommended).
- **Package Manager:** [`uv`](https://docs.astral.sh/uv/) (installed in user space; does not require root permissions).

---

## 4. Installation Instructions

### 1. Clone Repository & Setup Virtual Environment
```bash
# 1. Install uv fast package manager (if not present)
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.local/bin/env

# 2. Create isolated Python 3.11 virtual environment
uv venv --python 3.11 .venv

# 3. Activate environment
source .venv/bin/activate

# 4. Install pinned dependencies
uv pip install -r requirements.txt
```

### 2. Pre-Flight Hardware & Software Diagnostics
Before training or downloading weights, run the automated verification script:
```bash
.venv/bin/python scripts/02_validate_env.py
```
This script confirms:
- Python version is in the supported sweet spot (3.10–3.12).
- Key ML libraries (`torch`, `transformers`, `datasets`, `trl`, `peft`, `accelerate`, `bitsandbytes`) import cleanly.
- CUDA availability and exact compute capability (e.g., Ada Lovelace 8.9).
- GPU matrix multiplication on tensor cores.
- `bitsandbytes` 4-bit NF4 quantization kernel execution.

---

## 5. Dataset Preparation & Quality Control

The training curriculum covers 12 pedagogical competencies: English-to-Japanese translation, Japanese-to-English translation, grammar and particles, vocabulary and kanji, polite vs. casual styles, gentle correction, multi-turn dialogue, JLPT levels (N5 to N1), conversational context, general knowledge, ambiguity handling, and intellectual humility.

### Licenses
All training data is curated from open-license repositories:
- **Tatoeba Project / Tanaka Corpus:** Creative Commons Attribution 2.0 France (CC-BY 2.0 FR).
- **Open Educational Resources:** CC-BY-SA 4.0 / Public Domain.
- Audited registry and attribution notices are maintained in [`data/dataset_license.md`](data/dataset_license.md) and [`data/dataset_registry.json`](data/dataset_registry.json).

### Running Dataset Curation & Validation
```bash
# 1. Prepare and split dataset into train / validation / test splits
.venv/bin/python scripts/prepare_dataset.py

# 2. Validate format and schema adherence (ChatML messages array)
.venv/bin/python scripts/validate_dataset.py --input data/processed/train.jsonl
.venv/bin/python scripts/validate_dataset.py --input data/processed/val.jsonl
.venv/bin/python scripts/validate_dataset.py --input data/processed/test.jsonl

# 3. Check for duplicates and cross-split data leakage
.venv/bin/python scripts/check_duplicates.py \
  --train data/processed/train.jsonl \
  --val data/processed/val.jsonl \
  --test data/processed/test.jsonl
```

---

## 6. Training Commands (Local GPU)

Fine-tuning utilizes Parameter-Efficient Fine-Tuning (**QLoRA**) with 4-bit NormalFloat (`nf4`) quantization and double quantization, keeping memory footprint under 2.5 GB VRAM during training.

### Launch Local SFT Training:
```bash
.venv/bin/python scripts/train_sft.py \
  --model-id "Qwen/Qwen2.5-1.5B-Instruct" \
  --train-file "data/processed/train.jsonl" \
  --val-file "data/processed/val.jsonl" \
  --output-dir "adapters/japanese-ai-tutor-qlora" \
  --epochs 3 \
  --batch-size 1 \
  --grad-accum 2 \
  --lr 0.0002 \
  --max-seq-length 512 \
  --lora-r 16 \
  --lora-alpha 32
```

### Configurable Hyperparameters:
- `--lora-r`: Rank of LoRA update matrices (default: 16).
- `--lora-alpha`: LoRA scaling factor (default: 32).
- `--target-modules`: Comprehensive projections targeted: `q_proj`, `k_proj`, `v_proj`, `o_proj`, `gate_proj`, `up_proj`, `down_proj`.
- `--smoke-test`: Quick verification flag that runs a single step on a tiny subset to verify the pipeline before launching full training.

---

## 7. How to Resume Training

If a training session is interrupted by a power cut, manual termination, or system restart:
Every training checkpoint is automatically saved in `adapters/japanese-ai-tutor-qlora/checkpoint-<step>/` along with optimizer state, scheduler state, and trainer progress.

To resume from the latest saved checkpoint:
```bash
.venv/bin/python scripts/train_sft.py \
  --resume "adapters/japanese-ai-tutor-qlora/checkpoint-35" \
  --output-dir "adapters/japanese-ai-tutor-qlora"
```

In Google Colab, checkpoints are automatically mirrored to your mounted Google Drive (`/content/drive/MyDrive/japanese_ai_tutor_checkpoints/`), so re-running the notebook automatically resumes from the latest checkpoint without starting from scratch.

---

## 8. How to Load and Verify the Adapter

The system enforces strict verification: if an adapter path is supplied, the loader loads it into a `PeftModel` and validates active adapter weights. If the path is invalid or corrupted, it **aborts immediately** rather than silently falling back to the unadapted base model.

### Programmatic Python Usage:
```python
from app.cli_tutor import load_tutor_model, generate_response

# Load base model + fine-tuned LoRA adapter
model, tokenizer, is_fine_tuned = load_tutor_model(
    base_model_id="Qwen/Qwen2.5-1.5B-Instruct",
    adapter_path="adapters/japanese-ai-tutor-qlora",
    quant="4bit"
)

# Format messages with ChatML template
messages = [
    {"role": "system", "content": "You are Sensei, an encouraging Japanese AI Tutor."},
    {"role": "user", "content": "What is the difference between は and が?"}
]

# Generate pedagogical response
response = generate_response(model, tokenizer, messages, temperature=0.3)
print(response)
```

---

## 9. How to Test the Chatbot

### 1. Interactive Terminal Session (Sensei CLI)
Launch the interactive terminal chat:
```bash
# Convenient one-line launcher
./scripts/chat.sh

# Or directly with custom options
.venv/bin/python app/cli_tutor.py \
  --model "Qwen/Qwen2.5-1.5B-Instruct" \
  --adapter "adapters/japanese-ai-tutor-qlora" \
  --quant "4bit"
```

#### In-Chat Slash Commands:
- `/clear`: Clears conversation history to start a fresh topic.
- `/status`: Displays current GPU VRAM usage and active adapter.
- `/history`: Shows recent conversation turns retained in memory.
- `/help`: Displays tips for asking questions.
- `exit` or `quit`: Exits the session.

### 2. Single-Query Mode (Non-Interactive / Scripting)
```bash
.venv/bin/python app/cli_tutor.py --query "Explain the difference between 食べる and 食事する."
```

### 3. Automated Chatbot Test Suite
Run the 8-stage automated test suite:
```bash
.venv/bin/python tests/test_chat_app.py
```
Verifies:
- Multi-turn sliding window history pruning.
- Strict absence of silent fallback when adapter path is missing.
- VRAM footprint remains under 2.5 GB.
- Pedagogical accuracy on translation, gentle correction, general QA, and ambiguity.

---

## 10. How to Use the Colab Notebook

To train on a free cloud GPU without utilizing your local machine:
1. Open [Google Colab](https://colab.research.google.com/).
2. Click **Upload** and select [`notebooks/colab_japanese_ai_tutor.ipynb`](notebooks/colab_japanese_ai_tutor.ipynb).
3. Set runtime to GPU: **Runtime $\to$ Change runtime type $\to$ Hardware accelerator: T4 GPU $\to$ Save**.
4. Run the notebook sequentially from top to bottom:
   - Verifies Tesla T4 GPU (~15 GB VRAM).
   - Installs compatible libraries.
   - Mounts Google Drive for persistent checkpoints.
   - Runs baseline pre-training inference.
   - Trains QLoRA adapter across 12 competencies.
   - Tests fine-tuned model improvements.
   - Zips and triggers a one-click browser download of `japanese_ai_tutor_colab_adapter.zip` (~37 MB).
5. Extract the downloaded zip file into your local `adapters/japanese-ai-tutor-qlora/` directory to run locally.

Detailed cloud limits and instructions are documented in [`notebooks/README.md`](notebooks/README.md).

---

## 11. How to Start the REST API Backend

A production-ready FastAPI backend serving the fine-tuned tutor to future websites and mobile apps.

### Start the Server:
```bash
# Production server on port 8000
.venv/bin/uvicorn app.server:app --host 127.0.0.1 --port 8000

# Or directly via Python module:
.venv/bin/python -m app.server --port 8000

# Fast Mock Mode for frontend development (zero GPU overhead):
.venv/bin/python -m app.server --port 8000 --mock
```

### API Endpoints:
- `GET /health` or `GET /api/v1/health`: Returns system status, model ID, adapter verification, and GPU VRAM metrics.
- `POST /api/v1/chat`: Submits prompt and multi-turn history; returns JSON response with Furigana, romaji, token usage, and latency.
- `GET /api/v1/info`: Returns model metadata, licensing, and active generation limits.

### Sample Request:
```bash
curl -X POST http://127.0.0.1:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "日本語の助詞「に」と「で」の使い分けを例文付きで教えてください。",
    "generation": {
      "temperature": 0.3,
      "max_new_tokens": 256
    }
  }'
```

### Automated API Test Suite:
```bash
.venv/bin/python -m unittest tests/test_api_backend.py -v
```
Verifies health checks, request bounds, null-byte rejection, path traversal prevention, timeout handling, GPU OOM recovery, and CORS headers.

### 🌐 Full-Stack Web Application (Sensei Web UI):
The FastAPI server automatically serves the compiled, responsive Single Page Web Application at `http://localhost:8000/`.

```bash
# Launch unified full-stack server (serves both UI & REST API on port 8000)
./scripts/start_fullstack.sh

# Or run frontend development mode with Vite hot-reloading (proxied to API):
cd frontend && npm run dev
```

Open `http://localhost:8000` (or `http://localhost:5173` in Vite dev mode) to access:
- **5 Guided Pathways:** Free Conversation, Sentence Fixer, Particle Mastery, JLPT Drills, and Tokyo Roleplay.
- **HTML5 Furigana Annotations:** Renders `<ruby>漢字<rt>かんじ</rt></ruby>` tags with kana floating directly above kanji.
- **Voice Studio:** Local Faster-Whisper audio recording, live visualizer canvas, editable transcription review card, and Edge-TTS audio playback (0.8x, 1.0x, 1.2x speeds).
- **Study Deck & Anki Export:** 1-click vocabulary saving with `.txt` / `.tsv` export for Anki flashcard decks.
- **Live Diagnostics Modal:** Real-time GPU VRAM progress bar and generation parameter sliders.

Complete deployment guides (systemd service, Nginx reverse proxy, rate limiting) are documented in [`docs/API_BACKEND_GUIDE.md`](docs/API_BACKEND_GUIDE.md).

---

## 🎙️ Optional Voice Support (Experimental)

> [!NOTE]
> **Status: Experimental (Fully Validated End-to-End)**  
> Voice support has been tested and verified across the complete audio $\to$ transcription $\to$ LLM $\to$ TTS pipeline. It is marked as experimental to indicate ongoing tuning for ambient noise resistance and diverse browser microphone hardware codecs.

- **100% Local STT:** Audio is converted to text using `faster-whisper` (`whisper-tiny` / `whisper-base`) locally on-device. Zero audio packets leave your computer.
- **Strict Zero Storage Policy:** Ephemeral audio buffers are decoded in memory or in temporary files deleted immediately after transcription. No recordings are saved to disk.
- **Editable Review Card:** Transcriptions appear in an editable text box before being sent to the tutor, allowing users to correct misheard kanji or homophones.
- **Neural TTS:** Model responses are synthesized into speech using Microsoft Edge Neural TTS (`ja-JP-NanamiNeural` for Japanese and `en-US-JennyNeural` for English) at ₹0 cost.

### Launch the Voice Web Application:
```bash
.venv/bin/python app/web_tutor.py --port 7860
```
Open `http://localhost:7860` in your web browser, grant microphone access, and converse with Sensei.

### Run Automated Voice Tests:
```bash
.venv/bin/python -m unittest tests/test_voice_pipeline.py -v
```
Detailed data flow documentation is provided in [`docs/VOICE_GUIDE.md`](docs/VOICE_GUIDE.md).

---

## 12. Troubleshooting Guide

### 1. CUDA Out-of-Memory (OOM) Errors
- **Symptom:** `torch.cuda.OutOfMemoryError: CUDA out of memory.`
- **Cause:** GPU VRAM exceeded due to excessive batch size, sequence length, or competing applications (browser hardware acceleration, other models).
- **Fix:**
  1. Ensure `--batch-size 1` and `--grad-accum 2` or `4` are used.
  2. Reduce maximum sequence length: `--max-seq-length 384` or `256`.
  3. Ensure 4-bit quantization is enabled: `--quant 4bit`.
  4. Check competing GPU processes using `nvidia-smi` and terminate rogue processes.

### 2. Package Incompatibility & CUDA Build Mismatches
- **Symptom:** `ImportError: cannot import name ...` or `undefined symbol: cudaSetupArgument`.
- **Cause:** Virtual environment has mismatched PyTorch CUDA wheels or pip installed incompatible dependencies.
- **Fix:**
  Recreate the environment cleanly with the pinned requirements:
  ```bash
  rm -rf .venv
  uv venv --python 3.11 .venv
  uv pip install -r requirements.txt
  .venv/bin/python scripts/02_validate_env.py
  ```

### 3. Model Download Issues & HF Hub Rate Limits
- **Symptom:** `HTTPError: 429 Client Error: Too Many Requests` or slow downloads.
- **Cause:** Unauthenticated requests to Hugging Face Hub during initial base model download.
- **Fix:**
  Authenticate your environment using a free Hugging Face User Access Token:
  ```bash
  export HF_TOKEN="hf_your_token_here"
  ```
  Once downloaded, weights are cached locally in `~/.cache/huggingface/` and do not require repeated downloads.

### 4. Microphone & Audio Issues (Voice Mode)
- **Symptom:** `EmptyAudioError` or browser shows *"Microphone permission denied"*.
- **Fix:**
  1. Ensure your browser is allowed access to audio input in site settings (`chrome://settings/content/microphone` or `about:preferences#privacy`).
  2. On Linux, verify PipeWire or PulseAudio audio capture:
     ```bash
     arecord -l
     ```
  3. If running in a headless server or container, microphone audio must be captured from the client web browser, not the host machine.

---

## 13. Known Limitations and Future Improvements

### Known Limitations
1. **Model Parameter Scale (1.5B):** `Qwen2.5-1.5B-Instruct` is optimized for high efficiency and low VRAM usage (< 2.5 GB). While proficient at standard grammar, particles, and JLPT N5–N2 questions, it has more limited vocabulary depth than larger 7B+ models for obscure classical Japanese (*Kobun*) or archaic kanji compounds.
2. **Homophone Disambiguation in Speech:** Japanese contains many homophones (words with identical kana readings, e.g., 雨 vs. 飴 or 橋 vs. 端). The editable transcription review card mitigates this by allowing manual correction, but unedited speech may occasionally select an alternative kanji representation.
3. **External TTS Network Requirement:** While speech recognition (STT) and language model inference (LLM) run 100% locally and offline, the current default text-to-speech engine (`edge-tts`) requires an internet connection for neural speech synthesis.

### Future Improvements
1. **RAG Knowledge Base Integration:** Integrate Retrieval-Augmented Generation using the JMdict Japanese-English dictionary and Kanjidic2 for exact dictionary definitions, stroke orders, and JLPT frequency rankings.
2. **Fully Offline Local Neural TTS:** Integrate a compact on-device Japanese TTS model (such as Piper or StyleTTS2) for environments requiring 100% air-gapped, zero-internet operation.
3. **Interactive Audio Pronunciation Scoring:** Analyze user pitch accent and vowel length directly from speech waveforms to provide phonetic pronunciation feedback.
4. **Exportable Flashcards (Anki Integration):** Add a one-click button in the chat interface to export new vocabulary and grammar points directly to Anki `.apkg` flashcard decks.

---

## 🧪 Comprehensive Verification Summary

Run all test suites to confirm full project health:

```bash
# 1. Chat application & adapter verification (8 tests)
.venv/bin/python tests/test_chat_app.py

# 2. Voice pipeline (STT, TTS, Decoupling, Privacy, Web API) (18 tests)
.venv/bin/python -m unittest tests/test_voice_pipeline.py -v

# 3. REST API backend (Health, Chat, Validation, Security, CORS) (16 tests)
.venv/bin/python -m unittest tests/test_api_backend.py -v
```
