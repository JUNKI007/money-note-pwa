import logging
import re
from urllib.parse import urlencode

import requests

from models import Candidate
from config import AppConfig, NAVER_API_URL, SMARTSTORE_PATTERNS
from scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

_PRICE_RE = re.compile(r"\d+")


def _parse_price(val) -> int | None:
    if val is None:
        return None
    text = str(val).replace(",", "").strip()
    m = _PRICE_RE.fullmatch(text)
    return int(text) if m else None


def _is_smartstore(url: str) -> bool:
    return any(p in url for p in SMARTSTORE_PATTERNS)


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "")


def _error_candidate(note: str) -> Candidate:
    return Candidate(
        source="naver_shopping", mall_name="", title="",
        price=None, shipping_fee=None, total_price=None,
        link="", matched_score=0.0, note=note,
    )


class NaverScraper(BaseScraper):
    """
    네이버 쇼핑 검색 오픈 API를 사용해 가격 후보를 수집한다.
    API 키(client_id + client_secret)가 설정되어 있어야 동작한다.
    """

    def __init__(self, config: AppConfig):
        self.config = config
        self._session = requests.Session()
        self._session.headers.update({
            "X-Naver-Client-Id": config.naver_client_id,
            "X-Naver-Client-Secret": config.naver_client_secret,
            "User-Agent": "Mozilla/5.0 (compatible; PriceChecker/1.0)",
        })

    def search(self, name: str) -> list[Candidate]:
        if not self.config.naver_api_configured():
            return [_error_candidate("네이버 API 미설정; 수동확인필요")]

        params = {
            "query": name,
            "display": min(self.config.max_candidates, 100),
            "start": 1,
            "sort": "asc",   # 가격 오름차순
        }
        try:
            resp = self._session.get(
                NAVER_API_URL,
                params=params,
                timeout=self.config.requests_timeout,
            )
        except requests.RequestException as e:
            logger.error(f"네이버 API 요청 실패 [{name}]: {e}")
            return [_error_candidate(f"네이버 확인불가; {type(e).__name__}")]

        if resp.status_code == 401:
            logger.error("네이버 API 인증 실패: 클라이언트 ID/Secret 확인 필요")
            return [_error_candidate("네이버 API 인증 실패; API 키를 확인하세요")]
        if resp.status_code != 200:
            logger.warning(f"네이버 API HTTP {resp.status_code} [{name}]")
            return [_error_candidate(f"네이버 확인불가 (HTTP {resp.status_code})")]

        try:
            data = resp.json()
        except Exception:
            return [_error_candidate("네이버 확인불가 (응답 파싱 실패)")]

        items = data.get("items", [])
        if not items:
            return [_error_candidate("네이버 검색 결과 없음")]

        candidates: list[Candidate] = []
        for item in items[: self.config.max_candidates]:
            link = item.get("link") or ""
            title = _strip_html(item.get("title") or "")
            mall_name = item.get("mallName") or ""
            price = _parse_price(item.get("lprice"))
            source = "naver_smartstore" if _is_smartstore(link) else "naver_shopping"

            candidates.append(Candidate(
                source=source,
                mall_name=mall_name,
                title=title,
                price=price,
                shipping_fee=None,    # API에서 배송비 미제공
                total_price=None,
                link=link,
                matched_score=0.0,
                note="",              # 정상 후보는 note 없음
            ))

        return candidates

    def close(self):
        self._session.close()
