#!/usr/bin/env bash
# Quick launcher for Japanese AI Tutor terminal chat

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

if [ ! -d ".venv" ]; then
    echo "❌ Error: Virtual environment .venv not found. Run uv venv first."
    exit 1
fi

# Run with fine-tuned adapter by default
.venv/bin/python app/cli_tutor.py \
    --model "Qwen/Qwen2.5-1.5B-Instruct" \
    --adapter "adapters/japanese-ai-tutor-qlora" \
    --quant "4bit" \
    "$@"
