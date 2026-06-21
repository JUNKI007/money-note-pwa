@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ==========================================
echo  Jelly Price Checker 빌드 시작
echo ==========================================
echo.

echo [1/5] Python 설치 확인 중...
python --version >nul 2>&1
if errorlevel 1 (
    echo [오류] Python을 찾을 수 없습니다. Python 3.11 이상을 설치하세요.
    pause
    exit /b 1
)

echo [2/5] requirements 설치 중...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [오류] requirements 설치에 실패했습니다.
    pause
    exit /b 1
)

echo [3/5] Playwright Chromium 설치 중...
python -m playwright install chromium
if errorlevel 1 (
    echo [오류] Playwright Chromium 설치에 실패했습니다.
    pause
    exit /b 1
)

echo [4/5] PyInstaller 빌드 시작...
python -m PyInstaller --onedir --windowed --name JellyPriceChecker --distpath dist --workpath build --noconfirm --collect-all playwright main.py
if errorlevel 1 (
    echo [오류] PyInstaller 빌드에 실패했습니다.
    pause
    exit /b 1
)

echo [5/5] Chromium 브라우저를 dist 폴더에 복사 중...

SET "BROWSERS_SRC=%LOCALAPPDATA%\ms-playwright"
IF DEFINED PLAYWRIGHT_BROWSERS_PATH SET "BROWSERS_SRC=%PLAYWRIGHT_BROWSERS_PATH%"

SET "CHROMIUM_SRC="
FOR /D %%D IN ("%BROWSERS_SRC%\chromium-*") DO SET "CHROMIUM_SRC=%%D"

IF "%CHROMIUM_SRC%"=="" (
    echo [경고] Chromium 폴더를 찾지 못했습니다.
    echo        원본 예상 위치: %BROWSERS_SRC%\chromium-XXXX
    echo        대상 위치: dist\JellyPriceChecker\browsers\chromium-XXXX
    pause
    exit /b 1
) ELSE (
    IF NOT EXIST "dist\JellyPriceChecker\browsers" mkdir "dist\JellyPriceChecker\browsers"
    FOR %%F IN ("%CHROMIUM_SRC%") DO SET "CHROMIUM_FOLDER=%%~nxF"
    xcopy "%CHROMIUM_SRC%" "dist\JellyPriceChecker\browsers\%CHROMIUM_FOLDER%\" /E /I /Y /Q
    if errorlevel 1 (
        echo [오류] Chromium 복사에 실패했습니다.
        pause
        exit /b 1
    )
    echo Chromium 복사 완료: %CHROMIUM_FOLDER%
)

echo.
echo ==========================================
echo  빌드 완료
echo.
echo  배포 폴더:
echo  dist\JellyPriceChecker\
echo.
echo  중요:
echo  JellyPriceChecker.exe만 복사하지 말고
echo  dist\JellyPriceChecker 폴더 전체를 복사하세요.
echo.
echo  실행:
echo  dist\JellyPriceChecker\JellyPriceChecker.exe
echo ==========================================
echo.
pause
