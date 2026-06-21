from dataclasses import dataclass


@dataclass
class AppConfig:
    max_candidates: int = 40      # 네이버 검색 결과 최대 수집 수
    use_naver: bool = True
    use_coupang: bool = True       # True여도 검색 링크만 생성 (가격 미조회)
    autosave_interval: int = 10   # N개마다 임시 저장
    requests_timeout: int = 15    # HTTP 요청 타임아웃 (초)


# 네이버 쇼핑 검색 요청 헤더
NAVER_HEADERS: dict = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://search.shopping.naver.com/",
}

# 스마트스토어 URL 패턴
SMARTSTORE_PATTERNS: list[str] = [
    "smartstore.naver.com",
    "brand.naver.com",
]
