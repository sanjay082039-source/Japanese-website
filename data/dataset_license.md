# Dataset & Model License Audit

This document tracks all external assets, base models, and datasets used in the Japanese AI Tutor project to ensure full legal compliance with open-source licenses.

## 1. Base Model
| Model Name | Source | License | Permitted Uses | Commercial Use? |
| :--- | :--- | :--- | :--- | :--- |
| **Qwen/Qwen2.5-3B-Instruct** | Hugging Face / Alibaba Qwen Team | **Apache 2.0** | Free research, commercial use, modification, distribution | Yes |
| **Qwen/Qwen2.5-1.5B-Instruct** | Hugging Face / Alibaba Qwen Team | **Apache 2.0** | Free research, commercial use, modification, distribution | Yes |
| **Qwen/Qwen2.5-7B-Instruct** (Colab option) | Hugging Face / Alibaba Qwen Team | **Apache 2.0** | Free research, commercial use, modification, distribution | Yes |

---

## 2. Training & Fine-Tuning Datasets (Planned)
| Dataset Name | Source / URL | License | Purpose in Project |
| :--- | :--- | :--- | :--- |
| **Bilingual Japanese-English Instructions** | Open-source instruction tuning datasets (e.g. Dolly-15k-JA / Databricks Dolly translated) | **CC-BY-SA 3.0 / Apache 2.0** | General Q&A and bilingual conversational instruction |
| **JLPT Grammar & QA Pairs** | Curated open-access grammar explanations (N5-N1) & exercises | **CC-BY 4.0 / Public Domain / MIT** | JLPT grammatical nuances, particle usage, and error correction |
| **Everyday Japanese Conversational Scenarios** | Curated natural dialogue scenarios with furigana breakdowns | **Apache 2.0 / MIT** | Interactive roleplay and conversational fluency |

---

## 3. Tooling & Libraries
- **PyTorch:** Modified BSD License
- **Transformers (Hugging Face):** Apache 2.0
- **PEFT / LoRA (Hugging Face):** Apache 2.0
- **Bitsandbytes:** MIT License
- **TRL (Transformer Reinforcement Learning):** Apache 2.0
- **uv:** Apache 2.0 / MIT
