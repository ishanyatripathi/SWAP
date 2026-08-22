@echo off
setlocal
cd /d "%~dp0"

if exist "venv\Scripts\activate.bat" call "venv\Scripts\activate.bat"

start "ClassCover Server" /b cmd /c "uvicorn app.main:app --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8000"
