#!/usr/bin/env python3
"""
Duplicate and Data Leakage Checker for Japanese AI Tutor
Detects:
1. Exact duplicate examples (identical message content hash).
2. Near-duplicate prompts (ignoring casing, whitespace, and punctuation).
3. Cross-split data leakage (preventing train examples from leaking into validation/test splits).
"""

import sys
import os
import json
import hashlib
import re
import argparse
from typing import Dict, List, Tuple

def normalize_text(text: str) -> str:
    """Normalizes string for fuzzy/semantic duplicate detection."""
    # Remove punctuation, whitespace, and lowercase
    cleaned = re.sub(r"[^\w\s\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]", "", text.lower())
    return "".join(cleaned.split())

def hash_example(messages: List[Dict[str, str]]) -> str:
    """Generates unique SHA-256 hash for entire message sequence."""
    payload = json.dumps([{"r": m.get("role", ""), "c": m.get("content", "").strip()} for m in messages], sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

def extract_prompts(messages: List[Dict[str, str]]) -> List[str]:
    """Extracts all user turns in the conversation."""
    return [m.get("content", "").strip() for m in messages if m.get("role") == "user"]

def load_and_index(file_path: str) -> Tuple[List[Dict], Dict[str, List[int]], Dict[str, List[int]]]:
    """Loads a JSONL file and creates exact-hash and prompt-hash indices."""
    records = []
    exact_index = {}
    prompt_index = {}

    if not os.path.exists(file_path):
        return records, exact_index, prompt_index

    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line_str = line.strip()
            if not line_str:
                continue
            try:
                data = json.loads(line_str)
                messages = data.get("messages", [])
                records.append({"line": line_num, "data": data})

                # Exact hash
                e_hash = hash_example(messages)
                exact_index.setdefault(e_hash, []).append(line_num)

                # Prompt index (first user prompt)
                user_prompts = extract_prompts(messages)
                if user_prompts:
                    norm_p = normalize_text(user_prompts[0])
                    prompt_index.setdefault(norm_p, []).append(line_num)
            except Exception:
                continue

    return records, exact_index, prompt_index

def check_duplicates(train_file: str, val_file: str = None, test_file: str = None, single_file: str = None) -> bool:
    print("=" * 70)
    print(" 🔎 Japanese AI Tutor - Duplicate & Cross-Split Leakage Checker")
    print("=" * 70)

    has_issues = False

    if single_file:
        files_to_check = [("Single File", single_file)]
    else:
        files_to_check = [("Train", train_file)]
        if val_file and os.path.exists(val_file):
            files_to_check.append(("Validation", val_file))
        if test_file and os.path.exists(test_file):
            files_to_check.append(("Test", test_file))

    # Phase 1: Within-file duplicates
    loaded_data = {}
    print("\n[Phase 1] Checking internal duplicates within each file...")
    for label, path in files_to_check:
        if not os.path.exists(path):
            print(f"  ⚠️ Warning: {label} file not found at '{path}'")
            continue

        records, exact_idx, prompt_idx = load_and_index(path)
        loaded_data[label] = {"path": path, "records": records, "exact": exact_idx, "prompts": prompt_idx}

        # Check internal exact duplicates
        internal_exact_dupes = {k: v for k, v in exact_idx.items() if len(v) > 1}
        if internal_exact_dupes:
            has_issues = True
            print(f"  ❌ {label} ({path}) has {len(internal_exact_dupes)} EXACT duplicate examples:")
            for h, lines in internal_exact_dupes.items():
                print(f"     • Lines {lines} are completely identical.")
        else:
            print(f"  ✅ {label} ({len(records)} examples): No exact duplicate records found.")

        # Check internal near-duplicate prompts
        internal_prompt_dupes = {k: v for k, v in prompt_idx.items() if len(v) > 1}
        if internal_prompt_dupes:
            print(f"  ⚠️ {label} ({path}) has {len(internal_prompt_dupes)} near-identical user prompts:")
            for p, lines in list(internal_prompt_dupes.items())[:5]:
                print(f"     • Lines {lines} share normalized prompt: '{p[:40]}...'")

    # Phase 2: Cross-split leakage
    if len(loaded_data) > 1 and "Train" in loaded_data:
        print("\n[Phase 2] Checking cross-split data leakage (Train vs Eval splits)...")
        train_exact = loaded_data["Train"]["exact"]
        train_prompts = loaded_data["Train"]["prompts"]

        for eval_label in ["Validation", "Test"]:
            if eval_label in loaded_data:
                eval_info = loaded_data[eval_label]
                eval_records = eval_info["records"]

                exact_leakage = []
                prompt_leakage = []

                for item in eval_records:
                    line_num = item["line"]
                    messages = item["data"].get("messages", [])
                    e_hash = hash_example(messages)
                    if e_hash in train_exact:
                        exact_leakage.append((line_num, train_exact[e_hash]))

                    prompts = extract_prompts(messages)
                    if prompts:
                        norm_p = normalize_text(prompts[0])
                        if norm_p in train_prompts:
                            prompt_leakage.append((line_num, train_prompts[norm_p]))

                if exact_leakage:
                    has_issues = True
                    print(f"  ❌ CRITICAL: Cross-split exact leakage found in {eval_label} ({len(exact_leakage)} examples):")
                    for eval_line, train_lines in exact_leakage:
                        print(f"     • {eval_label} line {eval_line} is identical to Train line(s) {train_lines}")
                else:
                    print(f"  ✅ No exact cross-split leakage into {eval_label}.")

                if prompt_leakage and not exact_leakage:
                    print(f"  ⚠️ Warning: {len(prompt_leakage)} prompts in {eval_label} are near-identical to Train prompts.")
                    for eval_line, train_lines in prompt_leakage[:3]:
                        print(f"     • {eval_label} line {eval_line} shares prompt with Train line(s) {train_lines}")

    print("\n" + "=" * 70)
    if has_issues:
        print(" ❌ DUPLICATE CHECK FAILED: Please resolve duplicate or leaked records.")
    else:
        print(" ✅ DUPLICATE CHECK PASSED: Clean dataset with zero exact duplicates or data leakage!")
    print("=" * 70)

    return not has_issues

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check JSONL datasets for duplicates and split contamination.")
    parser.add_argument("--file", "-f", type=str, default=None, help="Check single file for internal duplicates")
    parser.add_argument("--train", type=str, default="data/processed/train.jsonl", help="Path to train split")
    parser.add_argument("--val", type=str, default="data/processed/val.jsonl", help="Path to validation split")
    parser.add_argument("--test", type=str, default="data/processed/test.jsonl", help="Path to test split")
    args = parser.parse_args()

    clean = check_duplicates(train_file=args.train, val_file=args.val, test_file=args.test, single_file=args.file)
    sys.exit(0 if clean else 1)
