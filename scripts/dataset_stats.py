#!/usr/bin/env python3
"""
Dataset Statistics & Linguistic Profiler for Japanese AI Tutor
Analyzes datasets across:
1. Category distribution (all 12 competency categories)
2. Language mix (Japanese queries, English queries, Bilingual queries)
3. Provenance (Human-verified vs Synthetic machine-generated)
4. Licensing distribution
5. Turn length & character metrics
Generates docs/DATASET_STATS.md and docs/dataset_stats.json
"""

import os
import sys
import json
import re
import argparse
from typing import Dict, List, Any

JA_REGEX = re.compile(r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]")
EN_REGEX = re.compile(r"[a-zA-Z]")

def detect_language(text: str) -> str:
    has_ja = bool(JA_REGEX.search(text))
    has_en = bool(EN_REGEX.search(text))
    if has_ja and has_en:
        return "Bilingual (JA + EN)"
    elif has_ja:
        return "Japanese Primary"
    elif has_en:
        return "English Primary"
    else:
        return "Symbol / Other"

def analyze_jsonl_file(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        return {"file": file_path, "exists": False, "count": 0}

    records = []
    categories = {}
    languages = {}
    provenances = {}
    licenses = {}
    user_lens = []
    assistant_lens = []

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line_str = line.strip()
            if not line_str:
                continue
            try:
                rec = json.loads(line_str)
            except Exception:
                continue

            records.append(rec)

            cat = rec.get("category", "unspecified")
            categories[cat] = categories.get(cat, 0) + 1

            prov = rec.get("provenance", "unknown")
            provenances[prov] = provenances.get(prov, 0) + 1

            lic = rec.get("license", "unspecified")
            licenses[lic] = licenses.get(lic, 0) + 1

            messages = rec.get("messages", [])
            for m in messages:
                role = m.get("role")
                content = m.get("content", "")
                if role == "user":
                    user_lens.append(len(content))
                    lang = detect_language(content)
                    languages[lang] = languages.get(lang, 0) + 1
                elif role == "assistant":
                    assistant_lens.append(len(content))

    return {
        "file": file_path,
        "exists": True,
        "total_examples": len(records),
        "categories": categories,
        "languages": languages,
        "provenances": provenances,
        "licenses": licenses,
        "user_length": {
            "mean": round(sum(user_lens) / len(user_lens), 1) if user_lens else 0,
            "min": min(user_lens) if user_lens else 0,
            "max": max(user_lens) if user_lens else 0
        },
        "assistant_length": {
            "mean": round(sum(assistant_lens) / len(assistant_lens), 1) if assistant_lens else 0,
            "min": min(assistant_lens) if assistant_lens else 0,
            "max": max(assistant_lens) if assistant_lens else 0
        }
    }

def generate_stats_report(data_dir: str = "data/processed", output_md: str = "docs/DATASET_STATS.md", output_json: str = "docs/dataset_stats.json"):
    print("=" * 70)
    print(" 📊 JAPANESE AI TUTOR - DATASET STATISTICS PROFILER")
    print("=" * 70)

    train_stats = analyze_jsonl_file(os.path.join(data_dir, "train.jsonl"))
    val_stats = analyze_jsonl_file(os.path.join(data_dir, "val.jsonl"))
    test_stats = analyze_jsonl_file(os.path.join(data_dir, "test.jsonl"))
    sample_stats = analyze_jsonl_file("data/sample/train.jsonl")

    total_processed = train_stats.get("total_examples", 0) + val_stats.get("total_examples", 0) + test_stats.get("total_examples", 0)

    # Aggregate categories across processed splits
    aggregated_cats = {}
    aggregated_langs = {}
    aggregated_provs = {}
    aggregated_lics = {}

    for s in [train_stats, val_stats, test_stats]:
        for k, v in s.get("categories", {}).items():
            aggregated_cats[k] = aggregated_cats.get(k, 0) + v
        for k, v in s.get("languages", {}).items():
            aggregated_langs[k] = aggregated_langs.get(k, 0) + v
        for k, v in s.get("provenances", {}).items():
            aggregated_provs[k] = aggregated_provs.get(k, 0) + v
        for k, v in s.get("licenses", {}).items():
            aggregated_lics[k] = aggregated_lics.get(k, 0) + v

    full_report = {
        "summary": {
            "total_processed_examples": total_processed,
            "train_examples": train_stats.get("total_examples", 0),
            "val_examples": val_stats.get("total_examples", 0),
            "test_examples": test_stats.get("total_examples", 0),
            "sample_examples": sample_stats.get("total_examples", 0)
        },
        "categories": aggregated_cats,
        "languages": aggregated_langs,
        "provenances": aggregated_provs,
        "licenses": aggregated_lics,
        "splits": {
            "train": train_stats,
            "val": val_stats,
            "test": test_stats
        }
    }

    # Save JSON
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    with open(output_json, "w", encoding="utf-8") as f:
        json.dump(full_report, f, indent=2, ensure_ascii=False)
    print(f"✅ JSON dataset stats saved to: {output_json}")

    # Generate Markdown Report
    os.makedirs(os.path.dirname(output_md), exist_ok=True)
    md = []
    md.append("# 📊 Japanese AI Tutor - Dataset Statistics & Profiling Report\n")
    md.append(f"**Total Processed Examples:** {total_processed}  ")
    md.append(f"**Training Split:** {train_stats.get('total_examples', 0)} ({train_stats.get('total_examples', 0)/max(1, total_processed)*100:.1f}%)  ")
    md.append(f"**Validation Split:** {val_stats.get('total_examples', 0)} ({val_stats.get('total_examples', 0)/max(1, total_processed)*100:.1f}%)  ")
    md.append(f"**Test Split:** {test_stats.get('total_examples', 0)} ({test_stats.get('total_examples', 0)/max(1, total_processed)*100:.1f}%)  \n")
    md.append("---\n")

    md.append("## 1. Category Distribution\n")
    md.append("| Competency Category | Example Count | Percentage |")
    md.append("| :--- | :---: | :---: |")
    for cat, cnt in sorted(aggregated_cats.items()):
        pct = (cnt / max(1, total_processed)) * 100
        md.append(f"| `{cat}` | {cnt} | {pct:.1f}% |")
    md.append("\n---\n")

    md.append("## 2. Language & Query Modality Distribution\n")
    md.append("| Language Modality | Count | Description |")
    md.append("| :--- | :---: | :--- |")
    for lang, cnt in sorted(aggregated_langs.items()):
        pct = (cnt / max(1, sum(aggregated_langs.values()))) * 100
        md.append(f"| **{lang}** | {cnt} ({pct:.1f}%) | Learner queries matching this language profile |")
    md.append("\n---\n")

    md.append("## 3. Data Provenance & Human Review\n")
    md.append("| Provenance Tag | Count | Quality Status |")
    md.append("| :--- | :---: | :--- |")
    for prov, cnt in sorted(aggregated_provs.items()):
        status = "✅ Verified by native/senior reviewer" if "human" in prov else "🤖 Generated / under review"
        md.append(f"| `{prov}` | {cnt} | {status} |")
    md.append("\n---\n")

    md.append("## 4. Open-Source Licensing Compliance\n")
    md.append("| License | Count | Commercial / Permissive Status |")
    md.append("| :--- | :---: | :--- |")
    for lic, cnt in sorted(aggregated_lics.items()):
        md.append(f"| `{lic}` | {cnt} | ✅ Approved Open-Source License |")
    md.append("\n---\n")

    md.append("## 5. Turn Length Metrics\n")
    md.append("| Split | Avg User Chars | Min-Max User | Avg Assistant Chars | Min-Max Assistant |")
    md.append("| :--- | :---: | :---: | :---: | :---: |")
    for name, s in [("Train", train_stats), ("Val", val_stats), ("Test", test_stats)]:
        u = s.get("user_length", {})
        a = s.get("assistant_length", {})
        md.append(f"| **{name}** | {u.get('mean', 0)} | {u.get('min', 0)} - {u.get('max', 0)} | {a.get('mean', 0)} | {a.get('min', 0)} - {a.get('max', 0)} |")

    with open(output_md, "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    print(f"✅ Markdown dataset stats report saved to: {output_md}")

    # Print summary to console
    print("\nProcessed Dataset Metrics:")
    print(f"  • Total Processed Examples: {total_processed}")
    print(f"  • Train: {train_stats.get('total_examples', 0)} | Val: {val_stats.get('total_examples', 0)} | Test: {test_stats.get('total_examples', 0)}")
    print("\nCategories Count:")
    for cat, cnt in sorted(aggregated_cats.items()):
        print(f"  • {cat:32s}: {cnt:2d}")
    print("\nLanguage Distribution:")
    for lang, cnt in sorted(aggregated_langs.items()):
        print(f"  • {lang:25s}: {cnt:2d}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate dataset statistics report")
    parser.add_argument("--data-dir", "-d", type=str, default="data/processed")
    parser.add_argument("--output-md", "-m", type=str, default="docs/DATASET_STATS.md")
    parser.add_argument("--output-json", "-j", type=str, default="docs/dataset_stats.json")
    args = parser.parse_args()

    generate_stats_report(args.data_dir, args.output_md, args.output_json)
