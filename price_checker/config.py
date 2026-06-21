import os
import sys
from dataclasses import dataclass, field


@dataclass
class AppConfig:
    delay_seconds: float = 3.0
    headless: bool = False
    max_candidates: int = 10
    use_coupang: bool = True
    use_naver: bool = True
    autosave_interval: int = 10  # N개마다 임시 저장


# CSS Selector 중앙 관리 — 사이트 HTML 구조 변경 시 이 dict만 수정
SELECTORS: dict = {
    "coupang": {
        # 검색 결과 목록
        "item_list": "ul.search-product-list li.search-product",
        # 상품명
        "item_name": "div.name",
        # 가격 (원화 단위, 쉼표 포함 숫자)
        "item_price": "strong.price-value",
        # 배송비 텍스트
        "item_shipping": "span.badge.delivery",
        # 상품 링크 (href)
        "item_link": "a.search-product-link",
        # 차단/캡차 감지 텍스트 (포함 여부 확인)
        "block_keywords": ["로봇이 아닙니다", "captcha", "CAPTCHA", "본인인증", "자동입력 방지"],
    },
    "naver": {
        # 검색 결과 아이템
        "item_list": "div.basicList_item__",
        # 상품명
        "item_name": "a.basicList_title__",
        # 가격
        "item_price": "span.price_num__",
        # 배송비
        "item_shipping": "span.basicList_ship__",
        # 판매처명
        "item_mall": "span.basicList_mall_name__",
        # 링크
        "item_link": "a.basicList_title__",
        # 캡차/차단 감지
        "block_keywords": ["자동입력 방지", "captcha", "로그인", "본인확인"],
        # 스마트스토어 URL 패턴
        "smartstore_patterns": ["smartstore.naver.com", "brand.naver.com"],
    },
}

DEFAULT_CONFIG = AppConfig()


def setup_playwright_browsers() -> None:
    """
    PyInstaller로 빌드된 exe 실행 시, 번들에 포함된 Chromium 경로를
    PLAYWRIGHT_BROWSERS_PATH 환경변수로 설정한다.

    빌드 구조:
        dist/JellyPriceChecker/
            JellyPriceChecker.exe
            browsers/
                chromium-XXXX/      ← build_exe.bat이 복사
    """
    if not getattr(sys, "frozen", False):
        return  # 개발 환경 — 이미 설치된 시스템 브라우저 사용

    exe_dir = os.path.dirname(sys.executable)
    bundled = os.path.join(exe_dir, "browsers")
    if os.path.isdir(bundled):
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = bundled
