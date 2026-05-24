#!/bin/bash
set -e
cd "$(dirname "$0")"
exec uvicorn app:app --reload --port 8000
