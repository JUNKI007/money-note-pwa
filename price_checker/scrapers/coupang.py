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
    text = text.strip()
    m = _PRICE_RE.search(text)
    if not m:
        return None
    try:
        return int(m.group().replace(",", ""))
    except ValueError:
        return None


def _parse_shipping(text: str) -> int | None:
    text = text.strip()
    if "무료" in text or "무료배송" in text:
        return 0
    m = _PRICE_RE.search(text)
    if m:
        try:
            return int(m.group().replace(",", ""))
        except ValueError:
            return None
    return None


class CoupangScraper(BaseScraper):
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
                viewport={"width": 1280, "height": 800},
            )

    async def search(self, name: str) -> list[Candidate]:
        sel = SELECTORS["coupang"]
        await self._ensure_browser()
        page: Page = await self._context.new_page()
        candidates: list[Candidate] = []

        try:
            url = f"https://www.coupang.com/np/search?q={quote(name)}&channel=user"
            await page.goto(url, timeout=20000, wait_until="domcontentloaded")
            await asyncio.sleep(self.config.delay_seconds)

            # 차단/캡차 감지
            page_text = await page.inner_text("body")
            for kw in sel["block_keywords"]:
                if kw.lower() in page_text.lower():
                    logger.warning(f"쿠팡 차단 감지: '{kw}' — {name}")
                    return [Candidate(
                        source="coupang", mall_name="쿠팡",
                        title="", price=None, shipping_fee=None, total_price=None,
                        link="", matched_score=0.0, note="쿠팡 확인불가"
                    )]

            items = await page.query_selector_all(sel["item_list"])
            for item in items[: self.config.max_candidates]:
                try:
                    name_el = await item.query_selector(sel["item_name"])
                    price_el = await item.query_selector(sel["item_price"])
                    ship_el = await item.query_selector(sel["item_shipping"])
                    link_el = await item.query_selector(sel["item_link"])

                    title = (await name_el.inner_text()).strip() if name_el else ""
                    price_text = (await price_el.inner_text()).strip() if price_el else ""
                    ship_text = (await ship_el.inner_text()).strip() if ship_el else ""
                    href = await link_el.get_attribute("href") if link_el else ""
                    if href and not href.startswith("http"):
                        href = "https://www.coupang.com" + href

                    price = _parse_price(price_text)
                    shipping = _parse_shipping(ship_text)
                    total = (price + shipping) if (price is not None and shipping is not None) else None
                    note = ""
                    if shipping is None:
                        note = "배송비 확인불가"

                    candidates.append(Candidate(
                        source="coupang", mall_name="쿠팡",
                        title=title, price=price, shipping_fee=shipping,
                        total_price=total, link=href,
                        matched_score=0.0, note=note,
                    ))
                except Exception as e:
                    logger.debug(f"쿠팡 아이템 파싱 오류: {e}")
                    continue

        except Exception as e:
            logger.error(f"쿠팡 검색 오류 [{name}]: {e}")
            candidates.append(Candidate(
                source="coupang", mall_name="쿠팡",
                title="", price=None, shipping_fee=None, total_price=None,
                link="", matched_score=0.0, note=f"쿠팡 확인불가: {type(e).__name__}"
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
