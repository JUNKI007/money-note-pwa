from dataclasses import dataclass


@dataclass
class AppConfig:
    use_naver: bool = True              # 네이버 조회 ON/OFF
    playwright_headless: bool = False   # False = 브라우저 화면 표시
    delay_min: float = 5.0              # 상품 간 최소 딜레이 (초)
    delay_max: float = 10.0             # 상품 간 최대 딜레이 (초)

    # 기타
    max_candidates: int = 40            # 검색 결과 최대 수집 수
    autosave_interval: int = 10         # N개마다 임시 저장


# 스마트스토어 URL 패턴 (매칭용, 링크 출력 안 함)
SMARTSTORE_PATTERNS: list[str] = [
    "smartstore.naver.com",
    "brand.naver.com",
]

# 차단/로그인/캡차 감지 키워드
NAVER_BLOCK_KEYWORDS: list[str] = [
    "로봇이 아닙니다",
    "자동입력 방지",
    "captcha",
    "CAPTCHA",
    "본인인증",
    "access denied",
    "로그인이 필요",
    "다시 시도",
]

# 로그인 창 감지 키워드 (별도 메시지 표시용)
NAVER_LOGIN_KEYWORDS: list[str] = [
    "로그인",
    "네이버 아이디",
    "id로 로그인",
    "sign in",
]
