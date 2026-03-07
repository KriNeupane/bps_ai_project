@echo off
setlocal
echo --- Starting Lead Automation Web UI ---

:: Start Backend in a new window
echo Starting Backend API...
start "Lead Automation API" cmd /c "cd /d %~dp0 && .\venv\Scripts\python.exe api.py"

:: Start Frontend in a new window
echo Starting Frontend UI...
start "Lead Automation UI" cmd /c "cd /d %~dp0\ui && npm run dev"

echo.
echo --- READY ---
echo 1. Backend: http://localhost:8000
echo 2. Frontend: http://localhost:5173
echo.
echo Open your browser to http://localhost:5173 to start!
echo.
pause
