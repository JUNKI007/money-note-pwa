import json
import logging
import re
from urllib.parse import quote

import requests

from models import Candidate
from config import AppConfig, NAVER_HEADERS, SMARTSTORE_PATTERNS
from scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

# 네이버 쇼핑 검색 URL (가격 오름차순)
_SEARCH_URL = (
    "https://search.shopping.naver.com/search/all"
    "?query={query}&sort=price_asc&pagingSize={size}"
)

# 페이지 내 __NEXT_DATA__ JSON 추출 패턴
_NEXT_DATA_RE = re.compile(
    r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
    re.DOTALL,
)

_PRICE_RE = re.compile(r"[\d,]+")


def _parse_price(val) -> int | None:
    if val is None:
        return None
    text = str(val).replace(",", "").strip()
    if text.isdigit():
        return int(text)
    m = _PRICE_RE.search(text)
    return int(m.group().replace(",", "")) if m else None


def _is_smartstore(url: str) -> bool:
    return any(p in url for p in SMARTSTORE_PATTERNS)


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "")


def _extract_products(html: str) -> list[dict]:
    """__NEXT_DATA__ JSON에서 상품 목록을 추출한다."""
    m = _NEXT_DATA_RE.search(html)
    if not m:
        return []
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        return []

    # 기본 경로
    try:
        return data["props"]["pageProps"]["initialState"]["products"]["list"]
    except (KeyError, TypeError):
        pass

    # 대안: lprice 키가 있는 리스트를 재귀 탐색 (구조 변경 대비)
    def _find(obj, depth=0):
        if depth > 8:
            return None
        if isinstance(obj, list) and obj and isinstance(obj[0], dict) and "lprice" in obj[0]:
            return obj
        if isinstance(obj, dict):
            for v in obj.values():
                r = _find(v, depth + 1)
                if r is not None:
                    return r
        return None

    return _find(data) or []


def _error_candidate(note: str) -> Candidate:
    return Candidate(
        source="naver_shopping", mall_name="", title="",
        price=None, shipping_fee=None, total_price=None,
        link="", matched_score=0.0, note=note,
    )


class NaverScraper(BaseScraper):
    def __init__(self, config: AppConfig):
        self.config = config
        self._session = requests.Session()
        self._session.headers.update(NAVER_HEADERS)

    def search(self, name: str) -> list[Candidate]:
        url = _SEARCH_URL.format(
            query=quote(name),
            size=min(self.config.max_candidates, 40),
        )
        try:
            resp = self._session.get(url, timeout=self.config.requests_timeout)
        except requests.RequestException as e:
            logger.error(f"네이버 요청 실패 [{name}]: {e}")
            return [_error_candidate(f"네이버 확인불가: {type(e).__name__}")]

        if resp.status_code != 200:
            logger.warning(f"네이버 HTTP {resp.status_code} [{name}]")
            return [_error_candidate(f"네이버 확인불가 (HTTP {resp.status_code})")]

        products = _extract_products(resp.text)
        if not products:
            logger.warning(f"네이버 상품 파싱 실패 [{name}] — 구조 변경 가능성")
            return [_error_candidate("네이버 확인불가 (파싱 실패)")]

        candidates: list[Candidate] = []
        for p in products[: self.config.max_candidates]:
            link = p.get("link") or ""
            title = _strip_html(p.get("title") or "")
            mall_name = p.get("mallName") or ""
            price = _parse_price(p.get("lprice"))
            source = "naver_smartstore" if _is_smartstore(link) else "naver_shopping"

            candidates.append(Candidate(
                source=source,
                mall_name=mall_name,
                title=title,
                price=price,
                shipping_fee=None,
                total_price=None,
                link=link,
                matched_score=0.0,
                note="배송비 확인불가",
            ))

        return candidates

    def close(self):
        self._session.close()
