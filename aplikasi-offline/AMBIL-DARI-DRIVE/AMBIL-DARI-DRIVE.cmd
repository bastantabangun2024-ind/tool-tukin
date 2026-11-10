@echo off
chcp 65001 >nul
title Pengambil Presensi dari Google Drive
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js belum terpasang di komputer ini.
  echo   Fitur "Ambil dari Drive" memerlukan Node.js ^(gratis, unduh di https://nodejs.org^).
  echo   Tanpa Node.js, tool tetap bisa dipakai seperti biasa ^(pilih file presensi manual^).
  echo.
  pause
  exit /b 1
)
node alat-drive.js
echo.
echo   Jendela pengambil Drive sudah ditutup.
pause
