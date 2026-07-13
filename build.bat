@echo off
REM =========================================================================
REM  Lens & Light — Build Script
REM  Compiles the C HTTP server using GCC (MinGW)
REM =========================================================================

echo.
echo  ==========================================
echo   Lens ^& Light — Compiling Server...
echo  ==========================================
echo.

REM Add MSYS2 MinGW to PATH (adjust if installed elsewhere)
if exist "C:\msys64\mingw64\bin\gcc.exe" (
    set "PATH=C:\msys64\mingw64\bin;%PATH%"
)

gcc -Wall -Wextra -O2 -o server.exe src\server.c src\router.c src\api.c src\mime.c -lws2_32

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Compilation failed! Check the errors above.
    echo.
    pause
    exit /b 1
)

echo  [OK] Compiled successfully: server.exe
echo.
echo  To start the server, run:
echo     server.exe
echo.
echo  Then open http://localhost:8080 in your browser.
echo.
pause
