# 🌸 Japanese AI Tutor - Dataset & Curation Architecture Guide

This guide details the complete data lifecycle for the **Japanese AI Tutor** project: schema specifications, licensing verification, quality filtering, human-in-the-loop review, split isolation, and statistical profiling.

---

## 1. Dataset Schema Specification

Every training record is a single line of UTF-8 JSON (JSONL format) structured for OpenAI/ChatML compatibility and Hugging Face `SFTTrainer`:

```json
{
  "id": "tutor_grammar_wa_ga_001",
  "category": "grammar_and_particles",
  "source_id": "curated_tutor_human",
  "license": "Apache-2.0",
  "provenance": "human_verified",
  "review_status": "approved",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert bilingual Japanese AI Tutor and conversation partner (Sensei)..."
    },
    {
      "role": "user",
      "content": "What is the difference between は (wa) and が (ga) in Japanese?"
    },
    {
      "role": "assistant",
      "content": "Here is the key distinction between は and が:\n\n1. **は (wa) — Topic Marker:** Focuses on what comes *after*...\n2. **が (ga) — Subject Marker:** Focuses on what comes *before*..."
    }
  ]
}
```

### Required Fields & Provenance Tags:
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier used for tracing, deduplication, and error reporting. |
| `category` | `string` | One of the 12 core curriculum competencies (see Section 2). |
| `source_id` | `string` | Identifier matching an entry in `data/dataset_registry.json`. |
| `license` | `string` | Approved open-source license (e.g., `Apache-2.0`, `CC-BY 4.0`, `Public Domain`). |
| `provenance` | `string` | `human_verified` (written/reviewed by human) or `synthetic` (model-generated). |
| `review_status` | `string` | `approved`, `pending_review`, or `edited_and_approved`. |
| `messages` | `list` | Alternating conversation turns: `system` (optional at index 0), followed by alternating `user` and `assistant`. |

---

## 2. Core Curriculum Competencies (12 Categories)

| # | Category Identifier | Pedagogical Goal |
|---|---|---|
| **1** | `translation_en_to_ja` | Natural English-to-Japanese translation with nuance, Romaji, and cultural context. |
| **2** | `translation_ja_to_en` | Japanese-to-English translation breaking down keigo, particles, and register. |
| **3** | `grammar_and_particles` | Structural explanations (e.g., は vs が, に vs で, conditionals 〜たら/〜ば/〜と). |
| **4** | `vocabulary_and_kanji` | Kanji readings (On'yomi / Kun'yomi), radicals, stroke logic, and example sentences. |
| **5** | `polite_and_casual_styles` | Register shifts: Tameguchi (タメ口), Teineigo (丁寧語), Sonkeigo (尊敬語), Kenjougo (謙譲語). |
| **6** | `sentence_correction` | Spotting learner errors, explaining the grammar violation, and providing native alternatives. |
| **7** | `multiturn_dialogue` | Situational roleplay (restaurants, shopping, train stations, asking directions). |
| **8** | `jlpt_practice_n1` to `n5` | Targeted JLPT preparation across all proficiency levels (N5 beginner to N1 advanced). |
| **9** | `context_dependent_questions` | Handling anaphoric context and dialogue memory across multiple conversational turns. |
| **10** | `general_knowledge_and_chat` | General knowledge questions answered accurately while providing relevant Japanese vocabulary. |
| **11** | `clarification_handling` | Disambiguation when words have homophones (e.g., *hashi* = 箸 chopsticks vs 橋 bridge vs 端 edge). |
| **12** | `uncertainty_acknowledgment` | Intellectual humility: transparently stating when slang etymology or dialect grammar is debated. |

---

## 3. Licensing Policy & Quarantine Workflow

To prevent license contamination and legal ambiguity, all incoming datasets are gated against `data/dataset_registry.json`:

1. **Permitted Licenses:**
   - `Apache-2.0`
   - `MIT`
   - `CC-BY 4.0` / `CC-BY 2.0 FR` (with attribution)
   - `Public Domain / CC0` (e.g., Tanaka Corpus)
2. **Strict Quarantine:**
   - Any dataset without a confirmed entry in `data/dataset_registry.json` or with `license_status: "quarantined"` / `"unclear"` is rejected immediately.
   - Quarantined items are stored in `data/quarantine/quarantined_records.jsonl` along with the exact rejection timestamp and reason.
   - Quarantined records never enter `data/processed/train.jsonl`.

---

## 4. Normalization & Quality Filters

The ingestion engine in `scripts/ingest_data.py` performs rigorous quality filtering:

- **Japanese Character & Punctuation Preservation:**
  - Preserves Hiragana (`\u3040-\u309F`), Katakana (`\u30A0-\u30FF`), Kanji (`\u4E00-\u9FFF`), and Japanese punctuation (`「」『』。、・〜！？`).
  - Normalizes Unicode to NFC (Canonical Decomposition followed by Canonical Composition).
- **Repetitive Boilerplate Detection:**
  - Calculates 4-gram repetition counts. Assistant turns looping the same phrases are automatically rejected.
- **Length Bounds & Translation Ratios:**
  - User prompt minimum: 5 characters; maximum: 2000 characters.
  - Assistant response minimum: 10 characters; maximum: 4000 characters.
  - Length ratio bounds: flags extreme discrepancies between prompt and response lengths.
- **Zero Train/Test Leakage:**
  - Splits data deterministically using SHA-256 prompt hashing, guaranteeing that prompt texts in `val.jsonl` and `test.jsonl` never leak into `train.jsonl`.

---

## 5. Human Review Workflow

For ambiguous, machine-generated, or flagged examples, use the interactive human review CLI:

```bash
.venv/bin/python scripts/review_data.py --input data/sample/train.jsonl
```

### Review Commands:
- `[a] Approve:` Tags provenance as `human_verified`, sets `review_status: "approved"`, and appends to `data/reviewed/human_approved.jsonl`.
- `[r] Reject:` Prompts for a rejection reason and moves the record to `data/quarantine/quarantined_records.jsonl`.
- `[e] Edit:` Allows the human reviewer to directly edit the assistant's Japanese or English response in the terminal.
- `[s] Skip:` Defers decision to later.
- `[q] Quit:` Saves progress and outputs session statistics.

---

## 6. How to Add New Data & Run Pipeline Checks

### Step 1: Register the Source
Add source details to `data/dataset_registry.json`:
```json
{
  "my_new_dataset": {
    "name": "My Japanese Dataset",
    "source_url": "https://...",
    "license": "CC-BY 4.0",
    "license_status": "approved",
    "commercial_use_allowed": true,
    "attribution_required": true,
    "attribution_text": "Attribution to author...",
    "language_pair": "ja-en",
    "provenance": "human_verified",
    "preprocessing": ["nfc_normalization", "deduplication"]
  }
}
```

### Step 2: Configure Dataset Limits (No Code Changes Needed!)
In `configs/dataset_config.yaml`, configure sample caps and split ratios:
```yaml
dataset_limits:
  max_total_samples: 500        # null for unlimited
  max_samples_per_category: 40  # null for unlimited

partition:
  train_ratio: 0.8
  val_ratio: 0.1
  test_ratio: 0.1
  seed: 42
```

### Step 3: Run Ingestion & Pipeline Checks
```bash
# 1. Ingest raw datasets (supports both conversational JSONL and raw sentence pairs)
.venv/bin/python scripts/ingest_data.py \
  --inputs data/sample/train.jsonl data/raw/*.jsonl \
  --output-dir data/processed

# 2. Check for duplicate records and cross-split leakage
.venv/bin/python scripts/check_duplicates.py \
  --train data/processed/train.jsonl \
  --val data/processed/val.jsonl \
  --test data/processed/test.jsonl

# 3. Validate syntax, roles, and character limits
.venv/bin/python scripts/validate_dataset.py --input data/processed/train.jsonl
.venv/bin/python scripts/validate_dataset.py --input data/processed/val.jsonl
.venv/bin/python scripts/validate_dataset.py --input data/processed/test.jsonl

# 4. Generate dataset profiling statistics
.venv/bin/python scripts/dataset_stats.py
```
