from urllib.parse import quote

from models import Candidate
from config import AppConfig
from scrapers.base import BaseScraper


class CoupangScraper(BaseScraper):
    """쿠팡 검색 링크만 생성한다. 가격은 조회하지 않는다."""

    def __init__(self, config: AppConfig):
        self.config = config

    def search(self, name: str) -> list[Candidate]:
        search_url = f"https://www.coupang.com/np/search?q={quote(name)}&channel=user"
        return [Candidate(
            source="coupang",
            mall_name="쿠팡",
            title="",
            price=None,
            shipping_fee=None,
            total_price=None,
            link=search_url,
            matched_score=1.0,
            note="쿠팡 검색 링크 (가격 직접 확인 필요)",
        )]
