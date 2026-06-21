@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo =====================================================
echo   Jelly Price Checker - Windows 배포 빌드
echo =====================================================
echo.

REM ── 1. Playwright Chromium 설치 (빌드 PC 기준) ──────────────────────────────
echo [1/4] Playwright Chromium 설치 중...
python -m playwright install chromium
if errorlevel 1 (
    echo [오류] Playwright Chromium 설치 실패. 인터넷 연결을 확인하세요.
    pause & exit /b 1
)
echo.

REM ── 2. PyInstaller 빌드 (--onedir 폴더 배포 방식) ───────────────────────────
echo [2/4] PyInstaller 빌드 중...
pyinstaller --onedir ^
    --windowed ^
    --name JellyPriceChecker ^
    --distpath dist ^
    --workpath build ^
    --noconfirm ^
    main.py
if errorlevel 1 (
    echo [오류] PyInstaller �uild 실패.
    pause & exit /b 1
)
echo.

REM ── 3. Playwright Chromium 브라우저를 dist 폴더에 복사 ──────────────────────
echo [3/4] Chromium 브라우저를 dist 폴더에 복사 중...

REM Playwright 브라우저 기본 경로 (Windows: %LOCALAPPDATA%\ms-playwright)
SET "BROWSERS_SRC=%LOCALAPPDATA%\ms-playwright"

REM 환경변수로 재정의된 경우 우선 사용
IF DEFINED PLAYWRIGHT_BROWSERS_PATH (
    SET "BROWSERS_SRC=%PLAYWRIGHT_BROWSERS_PATH%"
)

REM chromium-* 폴더 탐색
SET "CHROMIUM_SRC="
FOR /D %%D IN ("%BROWSERS_SRC%\chromium-*") DO (
    SET "CHROMIUM_SRC=%%D"
)

IF NOT DEFINED CHROMIUM_SRC (
    echo [경고] Chromium 폴더를 자동으로 찾지 못했습니다.
    echo        아래 경로를 확인하고 수동으로 복사해주세요:
    echo        원본: %BROWSERS_SRC%\chromium-XXXX
    echo        대상: dist\JellyPriceChecker\browsers\chromium-XXXX
    echo.
) ELSE (
    SET "DEST=dist\JellyPriceChecker\browsers"
    IF NOT EXIST "!DEST!" mkdir "!DEST!"
    FOR %%F IN ("!CHROMIUM_SRC!") DO SET "CHROMIUM_FOLDER=%%~nxF"
    xcopy "!CHROMIUM_SRC!" "!DEST!\!CHROMIUM_FOLDER!\" /E /I /Y /Q
    echo Chromium 복사 완료: !DEST!\!CHROMIUM_FOLDER!
    echo.
)

REM ── 4. 완료 안내 ─────────────────────────────────────────────────────────────
echo [4/4] 빌드 완료!
echo.
echo =====================================================
echo   배포 방법
echo =====================================================
echo   dist\JellyPriceChecker\ 폴더 전체를 대상 PC에 복사하세요.
echo   대상 PC에서 JellyPriceChecker.exe 를 실행하면 됩니다.
echo   (별도 Python / Playwright 설치 불필요)
echo.
echo   폴더 구조:
echo   dist\JellyPriceChecker\
echo       JellyPriceChecker.exe
echo       browsers\
echo           chromium-XXXX\   (Chromium 브라우저 포함)
echo       ...기타 라이브러리...
echo =====================================================
echo.
pause
