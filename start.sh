#!/bin/bash

echo "Starting BPS AI Project..."

# Start the Python backend in the background
echo "Starting FastAPI backend on port 8000..."
source venv/bin/activate
uvicorn api:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start the React frontend
echo "Starting React frontend..."
cd ui
npm run dev

# When the user stops the frontend (Ctrl+C), kill the backend too
trap "kill $BACKEND_PID" EXIT
