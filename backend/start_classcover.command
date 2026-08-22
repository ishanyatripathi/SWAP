#!/bin/bash
cd "$(dirname "$0")"

if [ -f "venv/bin/activate" ]; then
  source "venv/bin/activate"
fi

uvicorn app.main:app --host 127.0.0.1 --port 8000 &
SERVER_PID=$!
trap 'kill "$SERVER_PID"' EXIT
sleep 3
open "http://127.0.0.1:8000"
wait "$SERVER_PID"
