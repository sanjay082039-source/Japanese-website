#!/usr/bin/env bash
# ==============================================================================
# 🌸 Japanese AI Tutor - Full-Stack Chatbot Server Launcher
# Serves both the FastAPI REST API and the compiled Single Page Application UI
# ==============================================================================

set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# 1. Activate Python virtual environment
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "❌ Error: Virtual environment .venv not found. Run: uv venv --python 3.11 .venv"
    exit 1
fi

# 2. Build frontend if dist/ does not exist
if [ ! -d "frontend/dist" ]; then
    echo "📦 Building frontend assets..."
    cd frontend && npm run build && cd ..
fi

echo "================================================================="
echo " 🌸 LAUNCHING JAPANESE AI TUTOR (SENSEI) FULL-STACK SERVER"
echo " URL:         http://127.0.0.1:8000"
echo " REST API:    http://127.0.0.1:8000/api/v1/chat"
echo " Health:      http://127.0.0.1:8000/health"
echo " Frontend UI: http://127.0.0.1:8000/"
echo "================================================================="

exec python -m app.server --port 8000 "$@"
