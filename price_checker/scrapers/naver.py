import asyncio
import re
import logging
from urllib.parse import quote

from playwright.async_api import async_playwright, Page, Browser, BrowserContext

from price_checker.models import Candidate
from price_checker.config import AppConfig, SELECTORS
from price_checker.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

_PRICE_RE = re.compile(r"[\d,]+")


def _parse_price(text: str) -> int | None:
    text = text.strip().replace("\xa0", "").replace(" ", "")
    m = _PRICE_RE.search(text)
    if not m:
        return None
    try:
        return int(m.group().replace(",", ""))
    except ValueError:
        return None


def _parse_shipping(text: str) -> int | None:
    text = text.strip()
    if not text:
        return None
    if "무료" in text:
        return 0
    m = _PRICE_RE.search(text)
    if m:
        try:
            return int(m.group().replace(",", ""))
        except ValueError:
            return None
    return None


def _is_smartstore(url: str) -> bool:
    patterns = SELECTORS["naver"]["smartstore_patterns"]
    return any(p in url for p in patterns)


class NaverScraper(BaseScraper):
    def __init__(self, config: AppConfig):
        self.config = config
        self._playwright = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None

    async def _ensure_browser(self):
        if self._browser is None:
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=self.config.headless,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            self._context = await self._browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 900},
            )

    async def search(self, name: str) -> list[Candidate]:
        sel = SELECTORS["naver"]
        await self._ensure_browser()
        page: Page = await self._context.new_page()
        candidates: list[Candidate] = []

        try:
            url = f"https://search.shopping.naver.com/search/all?query={quote(name)}"
            await page.goto(url, timeout=25000, wait_until="networkidle")
            await asyncio.sleep(self.config.delay_seconds)

            # 차단/캡차 감지
            page_text = await page.inner_text("body")
            for kw in sel["block_keywords"]:
                if kw.lower() in page_text.lower():
                    logger.warning(f"네이버 차단 감지: '{kw}' — {name}")
                    return [Candidate(
                        source="naver_shopping", mall_name="",
                        title="", price=None, shipping_fee=None, total_price=None,
                        link="", matched_score=0.0, note="네이버 확인불가"
                    )]

            # 아이템 셀렉터는 부분 클래스명으로 매칭
            items = await page.query_selector_all("[class*='basicList_item']")
            if not items:
                items = await page.query_selector_all("div.product_item")

            for item in items[: self.config.max_candidates]:
                try:
                    name_el = await item.query_selector("[class*='basicList_title']")
                    price_el = await item.query_selector("[class*='price_num']")
                    ship_el = await item.query_selector("[class*='basicList_ship']")
                    mall_el = await item.query_selector("[class*='basicList_mall_name'], [class*='mall_name']")

                    title = (await name_el.inner_text()).strip() if name_el else ""
                    price_text = (await price_el.inner_text()).strip() if price_el else ""
                    ship_text = (await ship_el.inner_text()).strip() if ship_el else ""
                    mall_name = (await mall_el.inner_text()).strip() if mall_el else ""

                    href = ""
                    if name_el:
                        href = await name_el.get_attribute("href") or ""
                    if not href and name_el:
                        link_el = await name_el.query_selector("a")
                        if link_el:
                            href = await link_el.get_attribute("href") or ""

                    price = _parse_price(price_text)
                    shipping = _parse_shipping(ship_text)
                    total = (price + shipping) if (price is not None and shipping is not None) else None
                    note = ""
                    if shipping is None and price is not None:
                        note = "배송비 확인불가"

                    source = "naver_smartstore" if _is_smartstore(href) else "naver_shopping"

                    candidates.append(Candidate(
                        source=source, mall_name=mall_name,
                        title=title, price=price, shipping_fee=shipping,
                        total_price=total, link=href,
                        matched_score=0.0, note=note,
                    ))
                except Exception as e:
                    logger.debug(f"네이버 아이템 파싱 오류: {e}")
                    continue

        except Exception as e:
            logger.error(f"네이버 검색 오류 [{name}]: {e}")
            candidates.append(Candidate(
                source="naver_shopping", mall_name="",
                title="", price=None, shipping_fee=None, total_price=None,
                link="", matched_score=0.0,
                note=f"네이버 확인불가: {type(e).__name__}"
            ))
        finally:
            await page.close()

        return candidates

    async def close(self):
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        self._browser = None
        self._context = None
        self._playwright = None
