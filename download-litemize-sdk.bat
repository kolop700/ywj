@echo off
title Litemize SDK Offline Download
echo.
echo Starting download of 18 Litemize SDK aar files...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0download-litemize-sdk.ps1"
echo.
echo ==================================================
echo Finished. Press any key to close this window.
echo ==================================================
pause >nul
