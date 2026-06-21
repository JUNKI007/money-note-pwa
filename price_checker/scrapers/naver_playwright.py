"""
네이버 쇼핑 Playwright 기반 가격 수집기.

- headful 모드 (headless=False) 기본값
- 실제 검색창에 상품명 타이핑 후 Enter
- Access Denied / 캡차 / 로그인 감지 시 우회 없이 확인불가 처리
- 배송비가 화면에 보이면 수집, 없으면 None 처리
"""

import logging
import re
import time

from playwright.sync_api import (
    sync_playwright, Browser, BrowserContext, Page, Playwright,
)

from models import Candidate
from config import AppConfig, SMARTSTORE_PATTERNS, NAVER_BLOCK_KEYWORDS
from scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

_NAVER_SHOPPING_HOME = "https://search.shopping.naver.com/"
_PRICE_RE = re.compile(r"\d[\d,]*")


def _parse_price(text: str) -> int | None:
    if not text:
        return None
    m = _PRICE_RE.search(text.replace(" ", ""))
    return int(m.group().replace(",", "")) if m else None


def _is_smartstore(url: str) -> bool:
    return any(p in url for p in SMARTSTORE_PATTERNS)


def _error_candidate(note: str) -> Candidate:
    return Candidate(
        source="naver_shopping", mall_name="", title="",
        price=None, shipping_fee=None, total_price=None,
        link="", matched_score=0.0, note=note,
    )


def _check_block(page: Page) -> str | None:
    """차단/캡차/로그인 감지. 감지되면 사유 문자열, 없으면 None."""
    try:
        body = page.inner_text("body", timeout=3000)
    except Exception:
        return None
    lower = body.lower()
    for kw in NAVER_BLOCK_KEYWORDS:
        if kw.lower() in lower:
            return kw
    return None


class NaverPlaywrightScraper(BaseScraper):
    """
    sync_playwright를 사용해 headful Chromium으로 네이버 쇼핑을 탐색한다.
    start() / close() 로 브라우저 생명주기를 명시적으로 관리한다.
    """

    def __init__(self, config: AppConfig):
        self.config = config
        self._pw: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None

    def start(self) -> None:
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=self.config.playwright_headless,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
        )
        self._context = self._browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
            locale="ko-KR",
        )

    def search(self, name: str) -> list[Candidate]:
        if self._context is None:
            self.start()

        page: Page = self._context.new_page()
        candidates: list[Candidate] = []

        try:
            # ── 1. 네이버 쇼핑 홈 이동 ──────────────────────────────────────
            page.goto(_NAVER_SHOPPING_HOME, timeout=20000, wait_until="domcontentloaded")

            # ── 2. 차단 선제 감지 ──────────────────────────────────────────
            block_kw = _check_block(page)
            if block_kw:
                logger.warning(f"[{name}] 네이버 초기 차단: {block_kw}")
                return [_error_candidate(f"네이버 Access Denied ({block_kw})")]

            # ── 3. 검색창 탐색 ─────────────────────────────────────────────
            search_box = None
            for sel in [
                "input[name='query']",
                "input[placeholder*='검색']",
                "input[type='search']",
            ]:
                try:
                    search_box = page.wait_for_selector(sel, timeout=5000)
                    if search_box:
                        break
                except Exception:
                    continue

            if not search_box:
                logger.error(f"[{name}] 네이버 검색창을 찾을 수 없습니다.")
                return [_error_candidate("네이버 확인불가 (검색창 없음)")]

            # ── 4. 검색어 입력 (사람처럼 타이핑) ──────────────────────────
            search_box.triple_click()
            search_box.type(name, delay=60)
            page.keyboard.press("Enter")

            # ── 5. 검색 결과 로딩 대기 ─────────────────────────────────────
            result_sel = (
                "[class*='basicList_item__'], "
                "[class*='product_item'], "
                "li.adProduct_item__"
            )
            try:
                page.wait_for_selector(result_sel, timeout=18000)
            except Exception:
                block_kw = _check_block(page)
                if block_kw:
                    logger.warning(f"[{name}] 검색 후 차단: {block_kw}")
                    return [_error_candidate(f"네이버 Access Denied ({block_kw})")]
                logger.warning(f"[{name}] 검색 결과 없음 (타임아웃)")
                return [_error_candidate("네이버 검색 결과 없음")]

            # ── 6. 결과 화면 차단 재확인 ──────────────────────────────────
            block_kw = _check_block(page)
            if block_kw:
                logger.warning(f"[{name}] 결과 화면 차단: {block_kw}")
                return [_error_candidate(f"네이버 Access Denied ({block_kw})")]

            # ── 7. 상품 목록 파싱 ──────────────────────────────────────────
            items = page.query_selector_all("[class*='basicList_item__']")
            if not items:
                items = page.query_selector_all("div.product_item")

            for item in items[: self.config.max_candidates]:
                try:
                    cand = _parse_item(item)
                    if cand:
                        candidates.append(cand)
                except Exception as e:
                    logger.debug(f"아이템 파싱 오류: {e}")
                    continue

        except Exception as e:
            logger.error(f"[{name}] Playwright 오류: {e}")
            candidates = [_error_candidate(f"네이버 확인불가; {type(e).__name__}")]
        finally:
            page.close()

        return candidates or [_error_candidate("네이버 검색 결과 없음")]

    def close(self) -> None:
        try:
            if self._context:
                self._context.close()
            if self._browser:
                self._browser.close()
            if self._pw:
                self._pw.stop()
        except Exception as e:
            logger.debug(f"Playwright 종료 오류: {e}")
        finally:
            self._context = None
            self._browser = None
            self._pw = None


# ── 개별 상품 카드 파싱 ────────────────────────────────────────────────────────

def _parse_item(item) -> Candidate | None:
    """단일 상품 카드에서 Candidate를 생성한다. 가격 없으면 None."""

    # 상품명 + 링크
    title = ""
    href = ""
    for title_sel in [
        "[class*='basicList_title__'] a",
        "a[class*='product_title_']",
        "a[href*='search.shopping.naver']",
    ]:
        title_el = item.query_selector(title_sel)
        if title_el:
            title = title_el.inner_text().strip()
            href = title_el.get_attribute("href") or ""
            break

    if not title:
        return None

    # 가격
    price = None
    for price_sel in [
        "[class*='price_num__']",
        "[class*='product_price__'] strong",
        "[class*='price_'] em",
    ]:
        price_el = item.query_selector(price_sel)
        if price_el:
            price = _parse_price(price_el.inner_text())
            if price is not None:
                break

    if price is None:
        return None  # 가격 없는 카드는 제외

    # 몰명
    mall_name = ""
    for mall_sel in [
        "[class*='basicList_mall_name__']",
        "[class*='mall_name__']",
        "[class*='product_mall_']",
    ]:
        mall_el = item.query_selector(mall_sel)
        if mall_el:
            mall_name = mall_el.inner_text().strip()
            break

    # 배송비
    shipping: int | None = None
    note = ""
    for ship_sel in [
        "[class*='basicList_ship__']",
        "[class*='delivery_']",
        "[class*='shipping_']",
    ]:
        ship_el = item.query_selector(ship_sel)
        if ship_el:
            ship_text = ship_el.inner_text().strip()
            if "무료" in ship_text:
                shipping = 0
            else:
                shipping = _parse_price(ship_text)
            break

    if shipping is None:
        note = "배송비 확인불가"

    total = (price + shipping) if (price is not None and shipping is not None) else None
    source = "naver_smartstore" if _is_smartstore(href) else "naver_shopping"

    return Candidate(
        source=source,
        mall_name=mall_name,
        title=title,
        price=price,
        shipping_fee=shipping,
        total_price=total,
        link=href,
        matched_score=0.0,
        note=note,
    )
