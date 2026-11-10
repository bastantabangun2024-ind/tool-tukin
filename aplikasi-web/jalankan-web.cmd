@echo off
REM Klik dua kali berkas ini untuk menjalankan Tool Tukin di komputer ini.
REM Jendela ini harus tetap terbuka selama aplikasi dipakai.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Pasang dari https://nodejs.org lalu coba lagi.
  pause
  exit /b 1
)

start "" http://localhost:3000/masuk.html
node server.mjs
echo.
echo Server berhenti. Tekan tombol apa saja untuk menutup jendela ini.
pause >nul
