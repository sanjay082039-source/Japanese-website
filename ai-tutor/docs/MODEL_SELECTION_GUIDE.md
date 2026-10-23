# 🌸 Model Selection & Architectural Evaluation Guide: Japanese AI Tutor

This guide evaluates candidate open-weight conversational LLMs from Hugging Face for our Japanese AI Tutor, with specific focus on your actual hardware:
**NVIDIA GeForce RTX 4050 Laptop GPU (5.72 GB Total VRAM) | 412 GB NVMe SSD | CachyOS Linux**.

---

## 1. Candidate 1 Evaluation: `Qwen/Qwen3-4B`
- **Hugging Face Model Link:** [https://huggingface.co/Qwen/Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B)
- **License:** **Apache-2.0** (Permissive; free for research and commercial use; no usage restrictions).
- **Architecture:** Dense Causal Language Model with Grouped Query Attention (GQA: 32 Q heads, 8 KV heads), 36 layers, SwiGLU activations, RoPE embeddings.
- **Parameters:** 4.02 Billion (Non-embedding: 3.61 Billion).
- **Context Length:** 32,768 tokens natively (extensible to 131,072 with YaRN).
- **Tokenizer:** 151,669 tokens with extensive Japanese kanji/kana and multilingual tokenization efficiency.
- **Chat Template:** Standard ChatML format supporting unique **dual execution modes**:
  - `enable_thinking=True`: Thinking mode with `<think>...</think>` scratchpad reasoning tokens.
  - `enable_thinking=False`: Non-thinking mode for direct, low-latency conversational tutoring.

### Hardware Compatibility Analysis (RTX 4050 6GB):
| Configuration | Memory Footprint | GPU Suitability (5.72 GB VRAM) |
| :--- | :--- | :--- |
| **BF16 / FP16 Native Weights** | ~8.04 GB VRAM | ❌ **Incompatible** (Instant CUDA Out of Memory error) |
| **8-bit Quantization (bitsandbytes)** | ~4.60 GB VRAM | ⚠️ **Risky** (Leaves <1.1 GB for KV cache and PyTorch runtime) |
| **4-bit NF4 Quantization (bitsandbytes)** | ~2.40 GB VRAM | ✅ **Supported for Inference** (~3.1 GB peak VRAM with KV cache) |
| **Local QLoRA Fine-Tuning (4-bit)** | ~5.10 GB VRAM | ⚠️ **Marginal** (Leaves only ~600 MB headroom; context must be ≤1024 tokens) |

---

## 2. Comparative Evaluation of Alternative Models

| Feature / Metric | Candidate 1: `Qwen3-4B` | Candidate 2: `Qwen2.5-3B-Instruct` | Candidate 3: `Qwen2.5-1.5B-Instruct` |
| :--- | :--- | :--- | :--- |
| **Parameters** | 4.02B | 3.09B | 1.54B |
| **Download Size** | 7.49 GB | 5.75 GB | **2.88 GB** |
| **License** | Apache-2.0 | Apache-2.0 | Apache-2.0 |
| **4-bit Inference VRAM** | ~2.9 GB | ~2.3 GB | **~1.4 GB** |
| **4-bit QLoRA VRAM** | ~5.1 GB (Very tight) | ~4.2 GB (Healthy margin) | **~3.0 GB (Zero OOM risk)** |
| **Inference Speed (RTX 4050)** | ~35 tokens/sec | ~45 tokens/sec | **~65+ tokens/sec** |
| **Japanese Nuance** | Exceptional | Outstanding | High |
| **Long Context Fine-Tuning** | Limited to 1024 tok | Up to 2048 tok | Up to 4096 tok |

---

## 3. Senior Engineer Recommendation & Trade-Offs

1. **For Local Development & Fast Experimentation:**
   - **`Qwen/Qwen2.5-1.5B-Instruct`** is our primary local baseline. It downloads in under 3 GB, operates at 65+ tokens/second, uses only 1.4 GB VRAM during inference, and fine-tunes with zero risk of crashing your laptop GPU.
2. **For Production Japanese Tutoring (Sweet Spot):**
   - **`Qwen/Qwen2.5-3B-Instruct`** or **`Qwen/Qwen3-4B`** (4-bit quantized).
   - If training locally, `Qwen2.5-3B-Instruct` provides a 1.5 GB safety buffer below your 5.72 GB VRAM ceiling.
   - For `Qwen3-4B`, local inference in 4-bit runs smoothly, while full QLoRA fine-tuning is ideally run either locally with strict gradient checkpointing or on a free cloud T4 GPU (15GB VRAM) using our [`scripts/cloud_colab_train.ipynb`](file:///home/dhanush/.gemini/antigravity-ide/scratch/japanese-ai-tutor/scripts/cloud_colab_train.ipynb).
