@echo off
setlocal
cd /d "%~dp0\.."
where py >nul 2>&1
if errorlevel 1 (
  echo Python 3.12 is required to build. Install it from python.org, then run this again.
  pause
  exit /b 1
)
py -3.12 -m pip install pyinstaller==6.16.0
if errorlevel 1 goto fail
py -3.12 -m unittest discover -s python_caption_editor/tests -v
if errorlevel 1 goto fail
py -3.12 -m PyInstaller --noconfirm --clean --onefile --console --name PersianCaptionEditor --add-data "python_caption_editor/static;static" python_caption_editor/app.py
if errorlevel 1 goto fail
echo.
echo Build complete: dist\PersianCaptionEditor.exe
pause
exit /b 0
:fail
echo Build failed. Please review the error above.
pause
exit /b 1
