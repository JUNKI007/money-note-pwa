from dataclasses import dataclass


@dataclass
class AppConfig:
    # ── 조회 모드 ──────────────────────────────────────────────────────────────
    use_naver: bool = True             # 네이버 가격비교 조회 사용
    use_coupang: bool = True           # 쿠팡 검색 링크 생성
    use_smartstore: bool = True        # 스마트스토어 후보 확인 (네이버 결과 필터)

    # ── Playwright 설정 ────────────────────────────────────────────────────────
    use_playwright: bool = True        # True = 웹 브라우저 직접조회 / False = 오픈 API
    playwright_headless: bool = False  # True = 브라우저 숨김 / False = 브라우저 표시

    # ── 딜레이 ────────────────────────────────────────────────────────────────
    delay_min: float = 5.0             # 상품 간 최소 대기 (초)
    delay_max: float = 10.0            # 상품 간 최대 대기 (초)

    # ── 네이버 오픈 API (use_playwright=False 시 사용) ─────────────────────────
    naver_client_id: str = ""
    naver_client_secret: str = ""

    # ── 기타 ──────────────────────────────────────────────────────────────────
    max_candidates: int = 40           # 결과 최대 수집 수
    autosave_interval: int = 10
    requests_timeout: int = 15
    show_links: bool = False           # 링크 열 출력 여부

    def naver_api_configured(self) -> bool:
        return bool(self.naver_client_id.strip() and self.naver_client_secret.strip())


# 네이버 오픈 API 엔드포인트
NAVER_API_URL = "https://openapi.naver.com/v1/search/shop.json"

# 스마트스토어 URL 패턴
SMARTSTORE_PATTERNS: list[str] = [
    "smartstore.naver.com",
    "brand.naver.com",
]

# 네이버 차단 감지 키워드
NAVER_BLOCK_KEYWORDS: list[str] = [
    "로봇이 아닙니다",
    "자동입력 방지",
    "captcha",
    "CAPTCHA",
    "본인인증",
    "access denied",
    "서비스 점검",
    "잠시 후 다시 시도",
]
