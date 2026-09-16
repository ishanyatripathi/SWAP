@echo off
setlocal
cd /d "%~dp0"

echo Building the React frontend...
pushd ..\frontend
call npm run build
if errorlevel 1 exit /b 1
popd

if not exist ".build-venv\Scripts\python.exe" (
	echo Creating an isolated build environment...
	python -m venv .build-venv
	if errorlevel 1 exit /b 1
)

echo Installing/verifying the backend build dependency...
.build-venv\Scripts\python.exe -m pip install -r requirements.txt pyinstaller
if errorlevel 1 exit /b 1

echo Building SWAP.exe...
.build-venv\Scripts\python.exe -m PyInstaller --clean --noconfirm SWAP.spec --distpath ..\release --workpath ..\build\pyinstaller
if errorlevel 1 exit /b 1

echo.
echo Build complete: ..\release\SWAP.exe