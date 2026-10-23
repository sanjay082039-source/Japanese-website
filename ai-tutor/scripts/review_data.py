#!/usr/bin/env python3
"""
Human Review & Audit CLI Workflow for Japanese AI Tutor
Enables reviewers to inspect, approve, edit, flag, or quarantine dataset examples.

Review Actions:
[a] Approve  -> Saved to data/reviewed/human_approved.jsonl (tagged 'human_verified')
[r] Reject   -> Moved to data/quarantine/quarantined_records.jsonl
[e] Edit     -> Correct the assistant's Japanese or English explanation
[s] Skip     -> Defer decision
[q] Quit     -> Save progress and exit
"""

import os
import sys
import json
import argparse
from typing import Dict, List, Optional

def review_interactive(
    input_file: str,
    approved_file: str = "data/reviewed/human_approved.jsonl",
    quarantine_file: str = "data/quarantine/quarantined_records.jsonl"
):
    print("=" * 70)
    print(" 🔎 JAPANESE AI TUTOR - HUMAN REVIEW WORKFLOW")
    print(f" Source: {input_file}")
    print(f" Approved Destination: {approved_file}")
    print("=" * 70)

    if not os.path.exists(input_file):
        print(f"❌ Error: Input file '{input_file}' not found.")
        return

    os.makedirs(os.path.dirname(approved_file), exist_ok=True)
    os.makedirs(os.path.dirname(quarantine_file), exist_ok=True)

    records = []
    with open(input_file, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if line_str:
                try:
                    records.append(json.loads(line_str))
                except Exception:
                    pass

    total = len(records)
    print(f"Found {total} records to review.\n")

    approved_count = 0
    rejected_count = 0
    edited_count = 0

    for idx, item in enumerate(records, 1):
        rec_id = item.get("id", f"sample_{idx}")
        category = item.get("category", "unspecified")
        messages = item.get("messages", [])

        user_text = next((m.get("content") for m in messages if m.get("role") == "user"), "")
        assistant_text = next((m.get("content") for m in reversed(messages) if m.get("role") == "assistant"), "")

        print(f"--- Example [{idx}/{total}] | ID: {rec_id} | Category: {category} ---")
        print(f"🧑 User:\n  {user_text}\n")
        print(f"🤖 Assistant:\n  {assistant_text}\n")

        while True:
            choice = input("Action [a]pprove / [r]eject / [e]dit / [s]kip / [q]uit: ").strip().lower()

            if choice == "a":
                item["review_status"] = "approved"
                item["provenance"] = "human_verified"
                with open(approved_file, "a", encoding="utf-8") as out_f:
                    out_f.write(json.dumps(item, ensure_ascii=False) + "\n")
                approved_count += 1
                print("  ✅ Approved & saved.")
                break

            elif choice == "r":
                reason = input("  Reason for rejection (e.g. unnatural Japanese, typo): ").strip() or "rejected_by_reviewer"
                quarantine_entry = {
                    "quarantine_reason": f"human_review_rejected: {reason}",
                    "record": item
                }
                with open(quarantine_file, "a", encoding="utf-8") as q_f:
                    q_f.write(json.dumps(quarantine_entry, ensure_ascii=False) + "\n")
                rejected_count += 1
                print("  ❌ Moved to quarantine.")
                break

            elif choice == "e":
                print("  Enter corrected assistant response (type END on a single line when done):")
                lines = []
                while True:
                    line = input()
                    if line.strip() == "END":
                        break
                    lines.append(line)
                new_text = "\n".join(lines).strip()
                if new_text:
                    for m in reversed(item["messages"]):
                        if m.get("role") == "assistant":
                            m["content"] = new_text
                            break
                    item["review_status"] = "edited_and_approved"
                    item["provenance"] = "human_verified"
                    with open(approved_file, "a", encoding="utf-8") as out_f:
                        out_f.write(json.dumps(item, ensure_ascii=False) + "\n")
                    edited_count += 1
                    print("  ✏️ Saved edited response.")
                break

            elif choice == "s":
                print("  ⏩ Skipped.")
                break

            elif choice == "q":
                print("\nReview session ended.")
                print(f"Summary: {approved_count} approved, {edited_count} edited, {rejected_count} rejected.")
                return

            else:
                print("  Invalid choice. Please select 'a', 'r', 'e', 's', or 'q'.")

    print("\n🎉 All records reviewed!")
    print(f"Summary: {approved_count} approved, {edited_count} edited, {rejected_count} rejected.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Human review CLI for dataset auditing")
    parser.add_argument("--input", "-i", type=str, default="data/sample/train.jsonl", help="Input file to review")
    parser.add_argument("--approved", "-a", type=str, default="data/reviewed/human_approved.jsonl")
    parser.add_argument("--quarantine", "-q", type=str, default="data/quarantine/quarantined_records.jsonl")
    args = parser.parse_args()

    review_interactive(args.input, args.approved, args.quarantine)
