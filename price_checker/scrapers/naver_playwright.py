"""
네이버 쇼핑 Playwright 기반 가격 수집기.

접근 방식:
- 검색창 탐색 없이 검색 결과 URL에 직접 접근
  https://search.shopping.naver.com/search/all?query=<인코딩된 상품명>
- 로그인/차단 페이지 감지 시 우회 없이 확인불가 처리
- 실패 시 debug/ 폴더에 스크린샷·URL·타이틀·body 앞 1000자 저장
"""

import logging
import os
import re
import time
from urllib.parse import quote

from playwright.sync_api import (
    sync_playwright, Browser, BrowserContext, Page, Playwright,
)

from models import Candidate
from config import AppConfig, SMARTSTORE_PATTERNS, NAVER_BLOCK_KEYWORDS, NAVER_LOGIN_KEYWORDS
from scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://search.shopping.naver.com/search/all?query={query}"
_PRICE_RE = re.compile(r"\d[\d,]*")

# debug 덤프 저장 폴더 (price_checker/ 하위)
_DEBUG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "debug")


def _parse_price(text: str) -> int | None:
    if not text:
        return None
    m = _PRICE_RE.search(text.replace(" ", "").replace("\xa0", "").replace(",", ""))
    # 다시 콤마 없이 숫자만 찾기
    m = _PRICE_RE.search(text.replace(" ", "").replace("\xa0", ""))
    return int(m.group().replace(",", "")) if m else None


def _is_smartstore(url: str) -> bool:
    return any(p in url for p in SMARTSTORE_PATTERNS)


def _error_candidate(note: str) -> Candidate:
    return Candidate(
        source="naver_shopping", mall_name="", title="",
        price=None, shipping_fee=None, total_price=None,
        link="", matched_score=0.0, note=note,
    )


def _save_debug(page: Page, name: str) -> None:
    """실패 시 스크린샷·URL·타이틀·body 앞 1000자를 debug/ 폴더에 저장."""
    try:
        os.makedirs(_DEBUG_DIR, exist_ok=True)
        safe = re.sub(r'[\\/:*?"<>|]', "_", name)[:40]

        # 스크린샷
        png_path = os.path.join(_DEBUG_DIR, f"{safe}.png")
        page.screenshot(path=png_path, full_page=False)

        # URL + 타이틀 + body 앞 1000자
        current_url = page.url
        title = ""
        body_excerpt = ""
        try:
            title = page.title()
        except Exception:
            pass
        try:
            body_excerpt = page.inner_text("body", timeout=3000)[:1000]
        except Exception:
            pass

        txt_path = os.path.join(_DEBUG_DIR, f"{safe}.txt")
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(f"URL: {current_url}\n")
            f.write(f"Title: {title}\n\n")
            f.write("--- body (첫 1000자) ---\n")
            f.write(body_excerpt)

        logger.debug(f"[debug] 저장: {png_path}, {txt_path}")
    except Exception as e:
        logger.debug(f"[debug] 저장 실패: {e}")


def _classify_page(page: Page) -> str | None:
    """
    현재 페이지가 로그인/차단 페이지인지 판별한다.
    - 로그인 페이지 → "네이버 로그인 페이지로 리다이렉트됨"
    - Access Denied  → "네이버 Access Denied"
    - 정상           → None
    """
    current_url = page.url

    # URL로 로그인 페이지 1차 감지
    if "nid.naver.com" in current_url or "naver.com/nidlogin" in current_url:
        return "네이버 로그인 페이지로 리다이렉트됨"

    try:
        body = page.inner_text("body", timeout=3000)
    except Exception:
        return None

    lower = body.lower()

    for kw in NAVER_LOGIN_KEYWORDS:
        if kw.lower() in lower:
            return "네이버 로그인 페이지로 리다이렉트됨"

    for kw in NAVER_BLOCK_KEYWORDS:
        if kw.lower() in lower:
            return f"네이버 Access Denied"

    return None


class NaverPlaywrightScraper(BaseScraper):
    """
    headful Chromium으로 네이버 쇼핑 검색 결과 URL에 직접 접근해 가격을 수집한다.
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
            # ── 1. 검색 결과 URL 직접 접근 ─────────────────────────────────
            url = _SEARCH_URL.format(query=quote(name))
            logger.debug(f"[{name}] 접근 URL: {url}")
            page.goto(url, timeout=25000, wait_until="domcontentloaded")

            # ── 2. 로딩 대기 (3~5초) ──────────────────────────────────────
            time.sleep(3)

            # ── 3. 현재 URL 확인 — 로그인/차단 감지 ───────────────────────
            block_msg = _classify_page(page)
            if block_msg:
                logger.warning(f"[{name}] {block_msg} (URL: {page.url})")
                _save_debug(page, name)
                return [_error_candidate(f"{block_msg} / 수동확인필요")]

            # ── 4. HTTP 418 등 비정상 상태코드 감지 ───────────────────────
            # (Playwright는 status를 직접 제공하지 않으므로 title로 감지)
            try:
                page_title = page.title()
                if "418" in page_title or "access denied" in page_title.lower():
                    _save_debug(page, name)
                    return [_error_candidate("네이버 확인불가 (HTTP 418 또는 Access Denied)")]
            except Exception:
                pass

            # ── 5. 상품 카드 존재 확인 ─────────────────────────────────────
            # 여러 selector를 시도, 타임아웃은 짧게
            item_sel = None
            for sel in [
                "li.basicList_item__",   # 네이버 쇼핑 22년~ 클래스
                "[class*='basicList_item__']",
                "div.product_item",
                "li[class*='product_item']",
                "div[class*='ProductCard']",
            ]:
                try:
                    page.wait_for_selector(sel, timeout=8000)
                    item_sel = sel
                    break
                except Exception:
                    continue

            if item_sel is None:
                _save_debug(page, name)
                # 결과가 없는 것인지 selector 불일치인지 구별
                try:
                    body_text = page.inner_text("body", timeout=2000)
                    if "검색 결과가 없습니다" in body_text or "결과없음" in body_text:
                        return [_error_candidate("네이버 검색결과 없음")]
                except Exception:
                    pass
                return [_error_candidate("네이버 결과 selector 확인필요")]

            # ── 6. 상품 목록 파싱 ──────────────────────────────────────────
            items = page.query_selector_all(item_sel)
            # selector가 일반 클래스 prefix인 경우에도 재시도
            if not items:
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

            if not candidates:
                _save_debug(page, name)
                return [_error_candidate("네이버 결과 selector 확인필요")]

        except Exception as e:
            logger.error(f"[{name}] Playwright 오류: {e}")
            try:
                _save_debug(page, name)
            except Exception:
                pass
            candidates = [_error_candidate(f"네이버 확인불가 / {type(e).__name__}")]
        finally:
            page.close()

        return candidates

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


def _parse_item(item) -> Candidate | None:
    """단일 상품 카드에서 Candidate를 생성한다. 가격 없으면 None."""

    # ── 상품명 + 링크 ────────────────────────────────────────────────────
    title = ""
    href = ""
    for sel in [
        "[class*='basicList_title__'] a",
        "[class*='product_title'] a",
        "a[class*='ProductCard_link']",
        "a[href*='search.shopping.naver']",
        "a[href*='shopping.naver']",
    ]:
        el = item.query_selector(sel)
        if el:
            title = el.inner_text().strip()
            href = el.get_attribute("href") or ""
            break

    if not title:
        # 마지막 수단: item 내 첫 번째 <a> 텍스트
        el = item.query_selector("a")
        if el:
            title = el.inner_text().strip()
            href = el.get_attribute("href") or ""

    if not title:
        return None

    # ── 가격 ────────────────────────────────────────────────────────────
    price = None
    for sel in [
        "[class*='price_num__']",
        "[class*='ProductCard_price']",
        "[class*='price_'] strong",
        "[class*='price_'] em",
        "strong[class*='price']",
        "em[class*='num']",
    ]:
        el = item.query_selector(sel)
        if el:
            price = _parse_price(el.inner_text())
            if price is not None:
                break

    if price is None:
        return None

    # ── 판매처(몰)명 ────────────────────────────────────────────────────
    mall_name = ""
    for sel in [
        "[class*='basicList_mall_name__']",
        "[class*='mall_name__']",
        "[class*='ProductCard_mall']",
        "[class*='product_mall']",
    ]:
        el = item.query_selector(sel)
        if el:
            mall_name = el.inner_text().strip()
            break

    # ── 배송비 ──────────────────────────────────────────────────────────
    shipping: int | None = None
    note = ""
    for sel in [
        "[class*='basicList_ship__']",
        "[class*='ProductCard_delivery']",
        "[class*='delivery_']",
        "[class*='shipping_']",
        "[class*='ship_']",
    ]:
        el = item.query_selector(sel)
        if el:
            ship_text = el.inner_text().strip()
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
