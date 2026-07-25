:: UTF-8 BOM safe comment line
@echo off
chcp 65001 > nul
title Actualizar Estadísticas FIFA FC26
echo ===================================================
echo   Actualizador de Estadísticas FIFA FC26
echo ===================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0actualizar.ps1"
echo.
echo ===================================================
echo Presiona cualquier tecla para salir...
pause > nul
