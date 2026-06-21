from dataclasses import dataclass, field


@dataclass
class AppConfig:
    max_candidates: int = 40          # 네이버 API 결과 최대 수집 수 (최대 100)
    use_naver: bool = True
    use_coupang: bool = True          # True여도 검색 링크만 저장 (가격 미조회)
    autosave_interval: int = 10       # N개마다 임시 저장
    requests_timeout: int = 15        # HTTP 요청 타임아웃 (초)
    naver_client_id: str = ""         # 네이버 오픈 API 클라이언트 ID
    naver_client_secret: str = ""     # 네이버 오픈 API 클라이언트 Secret
    show_links: bool = False          # True면 링크 열을 숨김 열로 출력

    def naver_api_configured(self) -> bool:
        return bool(self.naver_client_id.strip() and self.naver_client_secret.strip())


# 네이버 오픈 API 쇼핑 검색 엔드포인트
NAVER_API_URL = "https://openapi.naver.com/v1/search/shop.json"

# 스마트스토어 URL 패턴
SMARTSTORE_PATTERNS: list[str] = [
    "smartstore.naver.com",
    "brand.naver.com",
]
