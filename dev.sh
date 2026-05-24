#!/bin/bash
# Launches both the FastAPI backend (port 8000) and the Next.js frontend (port 3000).
set -e
cd "$(dirname "$0")"

trap "kill 0" SIGINT SIGTERM EXIT

echo "→ Starting FastAPI on http://localhost:8000"
.venv/bin/uvicorn app:app --port 8000 --log-level warning &

echo "→ Starting Next.js on http://localhost:3000"
cd web && npm run dev &

wait
