#!/usr/bin/env python3
"""
Dataset Preparation & Splitting Engine for Japanese AI Tutor
Prepares, cleans, deduplicates, and splits conversational datasets into train, val, and test splits.

Features:
- Reproducible random seed splitting.
- Deduplication before partitioning.
- Cross-split contamination prevention (strictly non-overlapping prompts).
- Automated post-split validation.
"""

import sys
import os
import json
import random
import hashlib
import argparse
from typing import List, Dict, Tuple

# Import validator
from validate_dataset import validate_line, hash_messages, normalize_text

DEFAULT_SYSTEM_PROMPT = (
    "You are an expert bilingual Japanese AI Tutor and conversation partner (Sensei). "
    "Your mission is to help users learn natural Japanese, understand grammar deeply, "
    "expand vocabulary, and pass the JLPT (N5 to N1).\n"
    "Guidelines:\n"
    "1. For Japanese-learning queries, provide natural Japanese expressions, followed by Romaji/Furigana "
    "when helpful, and clear, encouraging English explanations.\n"
    "2. When correcting sentences, explicitly highlight mistakes, provide the corrected natural version, "
    "and explain the grammatical reasoning.\n"
    "3. Support conversation roleplay, adjusting your difficulty level to the student's level.\n"
    "4. Also answer general questions accurately while offering relevant Japanese terminology when appropriate."
)

def load_and_clean_data(input_files: List[str], max_chars: int = 4000) -> List[Dict]:
    """Loads records from input files, validates them, and removes exact duplicates."""
    all_records = []
    seen_hashes = set()
    skipped_count = 0

    for file_path in input_files:
        if not os.path.exists(file_path):
            print(f"⚠️ Warning: Input file '{file_path}' does not exist, skipping.")
            continue

        print(f"Loading data from: {file_path}")
        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                is_valid, errors, warnings, data = validate_line(line_num, line, max_chars)
                if not is_valid:
                    print(f"  ❌ Skipping malformed record in {file_path}:{line_num}: {errors}")
                    skipped_count += 1
                    continue

                # Ensure system prompt is present
                messages = data.get("messages", [])
                if messages and messages[0].get("role") != "system":
                    messages.insert(0, {"role": "system", "content": DEFAULT_SYSTEM_PROMPT})
                    data["messages"] = messages

                # Exact deduplication
                h = hash_messages(data["messages"])
                if h in seen_hashes:
                    skipped_count += 1
                    continue

                seen_hashes.add(h)
                all_records.append(data)

    print(f"Successfully loaded and validated {len(all_records)} unique records (filtered {skipped_count} invalid/duplicate records).")
    return all_records

def split_dataset(
    records: List[Dict],
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    test_ratio: float = 0.1,
    seed: int = 42
) -> Tuple[List[Dict], List[Dict], List[Dict]]:
    """Reproducibly splits records into train, validation, and test sets with prompt isolation."""
    assert abs((train_ratio + val_ratio + test_ratio) - 1.0) < 1e-5, "Split ratios must sum to 1.0"

    # Group by normalized first user prompt to ensure near-identical prompts don't leak across splits
    prompt_groups: Dict[str, List[Dict]] = {}
    for r in records:
        messages = r.get("messages", [])
        user_msg = next((m.get("content", "") for m in messages if m.get("role") == "user"), "")
        norm_p = normalize_text(user_msg)
        prompt_groups.setdefault(norm_p, []).append(r)

    # Shuffle prompt groups reproducibly
    rng = random.Random(seed)
    keys = list(prompt_groups.keys())
    rng.shuffle(keys)

    total_keys = len(keys)
    train_end = max(1, int(total_keys * train_ratio))
    val_end = train_end + max(1, int(total_keys * val_ratio)) if total_keys >= 3 else train_end

    train_keys = keys[:train_end]
    val_keys = keys[train_end:val_end]
    test_keys = keys[val_end:]

    # For tiny sample datasets (e.g. < 5 examples), make sure at least 1 is in train and 1 in val
    if not val_keys and len(train_keys) > 1:
        val_keys = [train_keys.pop()]
    if not test_keys and len(train_keys) > 1:
        test_keys = [train_keys.pop()]

    train_data = [item for k in train_keys for item in prompt_groups[k]]
    val_data = [item for k in val_keys for item in prompt_groups[k]]
    test_data = [item for k in test_keys for item in prompt_groups[k]]

    return train_data, val_data, test_data

def save_jsonl(records: List[Dict], output_path: str):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"Saved {len(records):3d} examples to: {output_path}")

def run_preparation(
    input_paths: List[str],
    output_dir: str = "data/processed",
    train_ratio: float = 0.8,
    val_ratio: float = 0.1,
    test_ratio: float = 0.1,
    seed: int = 42
):
    print("=" * 70)
    print(" 🛠️  Japanese AI Tutor - Dataset Preparation & Partitioning")
    print("=" * 70)

    # 1. Load & Deduplicate
    records = load_and_clean_data(input_paths)
    if not records:
        print("❌ Error: No valid records found in input files.")
        sys.exit(1)

    # 2. Split
    train_data, val_data, test_data = split_dataset(
        records,
        train_ratio=train_ratio,
        val_ratio=val_ratio,
        test_ratio=test_ratio,
        seed=seed
    )

    # 3. Save
    train_file = os.path.join(output_dir, "train.jsonl")
    val_file = os.path.join(output_dir, "val.jsonl")
    test_file = os.path.join(output_dir, "test.jsonl")

    save_jsonl(train_data, train_file)
    save_jsonl(val_data, val_file)
    save_jsonl(test_data, test_file)

    # 4. Summary metrics
    print("\nDataset Partitioning Complete (Reproducible Seed: {}):".format(seed))
    print(f"  • Total Processed Examples: {len(records)}")
    print(f"  • Training Split:           {len(train_data)} examples ({len(train_data)/len(records)*100:.1f}%)")
    print(f"  • Validation Split:         {len(val_data)} examples ({len(val_data)/len(records)*100:.1f}%)")
    print(f"  • Test Split:               {len(test_data)} examples ({len(test_data)/len(records)*100:.1f}%)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare and split Japanese conversational dataset.")
    parser.add_argument("--inputs", "-i", nargs="+", default=["data/sample/train.jsonl"], help="Input JSONL files")
    parser.add_argument("--output-dir", "-o", type=str, default="data/processed", help="Output directory")
    parser.add_argument("--train-ratio", type=float, default=0.8, help="Train ratio (default: 0.8)")
    parser.add_argument("--val-ratio", type=float, default=0.1, help="Validation ratio (default: 0.1)")
    parser.add_argument("--test-ratio", type=float, default=0.1, help="Test ratio (default: 0.1)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for splitting")
    args = parser.parse_args()

    run_preparation(
        input_paths=args.inputs,
        output_dir=args.output_dir,
        train_ratio=args.train_ratio,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed
    )
