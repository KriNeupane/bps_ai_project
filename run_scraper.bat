@echo off
setlocal
echo --- Activating Virtual Environment ---
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] Could not find virtual environment. Ensure 'venv' folder exists.
    pause
    exit /b 1
)

echo --- Running Scraper ---
echo This might take a moment to start...
python main.py %*

if errorlevel 1 (
    echo [ERROR] Script crashed. See error above.
)
echo.
echo Closing in 10 seconds...
timeout /t 10
endlocal
