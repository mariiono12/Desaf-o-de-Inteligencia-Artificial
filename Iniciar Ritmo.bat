@echo off
title Ritmo - servidor local
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-ritmo.ps1"
if errorlevel 1 pause
