@echo off
title Servidor de Desarrollo Local - ABD Eep Web
echo.
echo ========================================================
echo   Iniciando Servidor Web Local para ABD Eep (DeepMind)
echo ========================================================
echo.
echo Presiona Ctrl+C para detener el servidor.
echo.

:: Iniciar un servidor HTTP ligero usando python (instalado por defecto en la mayoría de entornos)
:: en el directorio WebUI en el puerto 8080.
start "" http://localhost:8080/index.html
python -m http.server 8080 --directory d:\desarrollos\ABDSynths\ABDEep\WebUI
