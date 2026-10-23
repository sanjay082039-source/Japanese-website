# 🌸 Japanese AI Tutor - Google Colab Cloud Training Guide

This directory contains the official Jupyter notebook for fine-tuning the **Japanese AI Tutor** on a free Google Colab GPU (Tesla T4 with ~15 GB VRAM).

---

## 🚀 How to Open in Google Colab

You can upload the notebook directly to Google Colab:
1. Navigate to [colab.research.google.com](https://colab.research.google.com/).
2. Click **Upload** and select `notebooks/colab_japanese_ai_tutor.ipynb` (or `scripts/cloud_colab_train.ipynb`).
3. Set your runtime to GPU: **Runtime -> Change runtime type -> Hardware accelerator: T4 GPU -> Save**.

---

## 📋 What the Notebook Covers

| Section | Focus | Purpose |
| :--- | :--- | :--- |
| **1. Hardware Check** | `torch.cuda.is_available()` | Verifies NVIDIA T4 GPU and displays available VRAM (~15 GB). Alerts if running on CPU. |
| **2. Dependencies** | Pinned pip packages | Installs `torch`, `transformers`, `peft`, `trl`, `accelerate`, and `bitsandbytes` 4-bit kernels. |
| **3. Secure Auth** | `google.colab.userdata` | Uses Colab's native Secrets manager for `HF_TOKEN`. **Zero hardcoded credentials**. |
| **4. Google Drive Mount** | `drive.mount('/content/drive')` | Saves checkpoints persistently in Drive so disconnected sessions can be resumed. |
| **5. Curriculum Dataset** | 12 Competencies | Ingests and validates the curriculum (particles, grammar, translation, correction, JLPT). |
| **6. Base Model Loader** | `Qwen2.5-1.5B` 4-bit | Loads model in 4-bit NF4 precision with Apache-2.0 open-weights license. |
| **7. Baseline Test** | Pre-training QA | Runs baseline inference before training to document initial model capabilities. |
| **8. QLoRA Config** | PEFT `LoraConfig` | Targets attention & MLP projections (`q, k, v, o, gate, up, down`) with `r=16, alpha=32`. |
| **9. SFT Training Loop** | `TRL SFTTrainer` | Fine-tunes model with real-time VRAM and step loss tracking. |
| **10. Post-Training Test** | Live Adapter Test | Merges adapter and verifies improvements on sentence correction and pedagogy. |
| **11. One-Click Export** | `files.download()` | Zips adapter weights (~37 MB) and triggers immediate browser download. |
| **12. Local Reuse** | Terminal Chat | Instructions for unzipping to local `adapters/` and running `./scripts/chat.sh`. |

---

## ⚠️ Important Cloud Reality & Session Limits

- **Free Compute Quotas:** Free Colab GPUs are subject to dynamic quotas. If GPU capacity is exhausted, Colab may allocate a CPU until quotas reset.
- **Session Timeout:** Sessions disconnect if left idle for ~30–90 minutes or after reaching the maximum runtime (~12 hours).
- **Resuming:** Because checkpoints are saved to your mounted Google Drive (`/content/drive/MyDrive/japanese_ai_tutor_checkpoints/`), running the notebook again automatically resumes from the latest checkpoint without restarting from epoch 0.

---

## 💻 Reusing the Downloaded Adapter Locally

After the notebook downloads `japanese_ai_tutor_colab_adapter.zip`:

```bash
# 1. Extract into your local adapters directory
cd ~/Projects/japanese-ai-tutor
mkdir -p adapters/japanese-ai-tutor-qlora
unzip ~/Downloads/japanese_ai_tutor_colab_adapter.zip -d adapters/japanese-ai-tutor-qlora/

# 2. Launch the terminal chat application
./scripts/chat.sh

# 3. Run the automated test suite
.venv/bin/python tests/test_chat_app.py
```
