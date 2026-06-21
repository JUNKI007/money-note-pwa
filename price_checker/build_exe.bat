@echo off
chcp 65001 > nul
echo [Jelly Price Checker] PyInstaller 빌드 시작...

REM Playwright Chromium 설치 확인
python -m playwright install chromium

REM PyInstaller 빌드
pyinstaller --onefile ^
    --windowed ^
    --name JellyPriceChecker ^
    --add-data ".;." ^
    main.py

echo.
echo 빌드 완료! dist\JellyPriceChecker.exe 를 확인하세요.
echo.
echo [중요] exe 실행 전 Playwright 브라우저가 설치되어 있어야 합니다.
echo playwright install chromium
pause
