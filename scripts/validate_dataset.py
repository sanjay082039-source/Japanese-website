#!/usr/bin/env python3
"""
Dataset Validation Script for Japanese AI Tutor
Validates JSONL conversational datasets for Hugging Face compatibility.

Checks performed:
1. Valid JSON syntax per line.
2. Structure: must be an object containing a 'messages' list.
3. Message structure: valid 'role' (system, user, assistant) and non-empty 'content'.
4. Turn alternation: system (optional, first only), user/assistant alternating, ends on assistant.
5. No empty/whitespace-only messages.
6. Detection of duplicate examples (exact hash) and duplicate initial prompts.
7. Length bounds: detects excessively long conversations or single turns.
8. Category tagging and schema metadata.
"""

import sys
import os
import json
import hashlib
import argparse
from typing import Dict, List, Any, Tuple

ALLOWED_ROLES = {"system", "user", "assistant"}

def hash_messages(messages: List[Dict[str, str]]) -> str:
    """Computes SHA-256 hash of message sequence for duplicate detection."""
    serialized = json.dumps([{"role": m.get("role", ""), "content": m.get("content", "").strip()} for m in messages], sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

def normalize_text(text: str) -> str:
    """Normalizes text for fuzzy duplicate detection."""
    return "".join(text.lower().split())

def validate_line(line_num: int, line_str: str, max_chars: int) -> Tuple[bool, List[str], List[str], Dict[str, Any]]:
    errors = []
    warnings = []
    parsed_data = {}

    line_str = line_str.strip()
    if not line_str:
        return False, ["Empty line detected"], [], {}

    # 1. JSON parsing
    try:
        data = json.loads(line_str)
    except json.JSONDecodeError as e:
        return False, [f"Invalid JSON: {e}"], [], {}

    if not isinstance(data, dict):
        return False, [f"Root structure must be a JSON object, got {type(data).__name__}"], [], {}

    parsed_data = data

    # 2. Check messages field
    messages = data.get("messages")
    if messages is None:
        errors.append("Missing required field 'messages'")
        return False, errors, warnings, parsed_data

    if not isinstance(messages, list):
        errors.append(f"'messages' must be a list, got {type(messages).__name__}")
        return False, errors, warnings, parsed_data

    if len(messages) == 0:
        errors.append("'messages' list cannot be empty")
        return False, errors, warnings, parsed_data

    # 3. Message validation and turn structure
    system_count = 0
    total_chars = 0
    roles_sequence = []

    for idx, msg in enumerate(messages):
        if not isinstance(msg, dict):
            errors.append(f"Message index {idx} is not an object ({type(msg).__name__})")
            continue

        role = msg.get("role")
        content = msg.get("content")

        if not role:
            errors.append(f"Message index {idx} is missing 'role'")
        elif role not in ALLOWED_ROLES:
            errors.append(f"Message index {idx} has invalid role '{role}'. Allowed: {ALLOWED_ROLES}")
        else:
            roles_sequence.append(role)

        if content is None:
            errors.append(f"Message index {idx} is missing 'content'")
        elif not isinstance(content, str):
            errors.append(f"Message index {idx} 'content' must be string, got {type(content).__name__}")
        elif not content.strip():
            errors.append(f"Message index {idx} ({role}) has empty or whitespace-only content")
        else:
            char_len = len(content)
            total_chars += char_len
            if char_len > (max_chars // 2):
                warnings.append(f"Message index {idx} ({role}) is very long ({char_len} chars)")

        if role == "system":
            system_count += 1
            if idx != 0:
                errors.append(f"System message must be at index 0, found at index {idx}")

    if system_count > 1:
        errors.append(f"Multiple system messages found ({system_count}). Maximum 1 allowed.")

    # 4. Turn alternation checks
    dialogue_roles = [r for r in roles_sequence if r != "system"]
    if not dialogue_roles:
        errors.append("Conversation has no user/assistant dialogue turns")
    else:
        if dialogue_roles[0] != "user":
            errors.append(f"First dialogue turn must be 'user', got '{dialogue_roles[0]}'")
        if dialogue_roles[-1] != "assistant":
            errors.append(f"Last turn in training example must be 'assistant', got '{dialogue_roles[-1]}'")

        for i in range(len(dialogue_roles) - 1):
            if dialogue_roles[i] == dialogue_roles[i + 1]:
                errors.append(f"Consecutive turns with same role detected: '{dialogue_roles[i]}' followed by '{dialogue_roles[i+1]}'")

    # 5. Length check
    if total_chars > max_chars:
        warnings.append(f"Total conversation length ({total_chars} chars) exceeds suggested max ({max_chars} chars)")

    # 6. Metadata check
    category = data.get("category")
    if not category:
        warnings.append("Missing recommended 'category' metadata tag")

    is_valid = len(errors) == 0
    return is_valid, errors, warnings, parsed_data

def validate_dataset(file_path: str, max_chars: int = 4000, strict: bool = False) -> bool:
    print("=" * 70)
    print(f" 🔍 Japanese AI Tutor - Dataset Validator")
    print(f" Validating: {file_path}")
    print("=" * 70)

    if not os.path.exists(file_path):
        print(f"❌ Error: File not found at '{file_path}'")
        return False

    seen_hashes = {}
    seen_prompts = {}
    categories_count = {}
    turn_counts = {}

    total_lines = 0
    valid_lines = 0
    total_errors = 0
    total_warnings = 0

    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            total_lines += 1
            is_valid, errors, warnings, data = validate_line(line_num, line, max_chars)

            if is_valid:
                valid_lines += 1
                messages = data.get("messages", [])
                
                # Duplicate example check (exact hash)
                msg_hash = hash_messages(messages)
                if msg_hash in seen_hashes:
                    errors.append(f"Duplicate example detected! Identical to line {seen_hashes[msg_hash]}")
                    is_valid = False
                    valid_lines -= 1
                else:
                    seen_hashes[msg_hash] = line_num

                # Duplicate user prompt check
                first_user_msg = next((m.get("content", "") for m in messages if m.get("role") == "user"), None)
                if first_user_msg:
                    norm_prompt = normalize_text(first_user_msg)
                    if norm_prompt in seen_prompts:
                        warnings.append(f"Prompt is identical/near-identical to line {seen_prompts[norm_prompt]}")
                    else:
                        seen_prompts[norm_prompt] = line_num

                # Track metrics
                cat = data.get("category", "unspecified")
                categories_count[cat] = categories_count.get(cat, 0) + 1

                dialogue_turns = len([m for m in messages if m.get("role") in ("user", "assistant")])
                turn_counts[dialogue_turns] = turn_counts.get(dialogue_turns, 0) + 1

            if errors:
                total_errors += len(errors)
                print(f"  ❌ Line {line_num}:")
                for err in errors:
                    print(f"     • {err}")

            if warnings:
                total_warnings += len(warnings)
                if not strict:
                    for warn in warnings:
                        print(f"  ⚠️  Line {line_num} Warning: {warn}")

    print("\n" + "-" * 70)
    print(f" Summary for: {file_path}")
    print(f"  • Total Lines Processed: {total_lines}")
    print(f"  • Valid Examples:       {valid_lines}")
    print(f"  • Total Errors:         {total_errors}")
    print(f"  • Total Warnings:       {total_warnings}")

    if categories_count:
        print("\n Category Distribution:")
        for cat, cnt in sorted(categories_count.items()):
            print(f"  • {cat:35s}: {cnt:3d} examples")

    if turn_counts:
        print("\n Turn Count Distribution (User + Assistant turns):")
        for turns, cnt in sorted(turn_counts.items()):
            print(f"  • {turns} turns: {cnt} examples")

    passed = (total_errors == 0) and (not strict or total_warnings == 0)
    if passed:
        print("\n✅ DATASET VALIDATION PASSED: All records adhere to standard format!")
    else:
        print("\n❌ DATASET VALIDATION FAILED: Please fix errors listed above.")

    print("=" * 70)
    return passed

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validate JSONL conversational datasets.")
    parser.add_argument("--input", "-i", type=str, required=True, help="Path to JSONL dataset file")
    parser.add_argument("--max-chars", type=int, default=4000, help="Maximum allowed conversation characters")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as errors")
    args = parser.parse_args()

    success = validate_dataset(args.input, args.max_chars, args.strict)
    sys.exit(0 if success else 1)
