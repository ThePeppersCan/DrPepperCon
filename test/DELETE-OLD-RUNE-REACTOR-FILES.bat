@echo off
setlocal
cd /d "%~dp0"
echo Removing obsolete Rune Reactor website files...
for %%F in ("rune-reactor.js" "rune-reactor.css" "rune-reactor.sql" "RUNE-REACTOR-SETUP.txt") do (
  if exist "%%~F" (
    del /q "%%~F"
    echo Removed %%~F
  ) else (
    echo Already absent: %%~F
  )
)
echo.
echo Rune Reactor website files have been removed.
pause
