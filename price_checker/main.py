import logging
import os
import random
import sys
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PySide6.QtCore import QThread, Signal
from PySide6.QtWidgets import QApplication

from config import AppConfig
from excel_io import read_products, save_results
from matcher import pick_best, score_candidate, is_excluded_product, SCORE_THRESHOLD
from models import ProductInput, PriceResult, Candidate
from scrapers.coupang import CoupangScraper
from scrapers.naver import NaverScraper

logger = logging.getLogger(__name__)

# 대량 조회 경고 임계값
BULK_WARN_THRESHOLD = 20


def build_result(
    product: ProductInput,
    coupang_candidates: list[Candidate],
    naver_candidates: list[Candidate],
    use_smartstore: bool = True,
) -> PriceResult:
    """
    규칙:
    - 가격 컬럼에는 int 또는 None만. URL 절대 불가.
    - note 구분자: "; "
    - 쿠팡: 링크만 저장, 가격 컬럼 빈칸
    - 스마트스토어: 네이버 결과 중 smartstore URL 필터
    - 네이버 최저가: 배송비 포함 합계 우선, 없으면 가격만
    """
    result = PriceResult(code=product.code, name=product.name)
    notes: list[str] = []

    # ── 쿠팡: 검색 링크만 ──────────────────────────────────────────────────
    if coupang_candidates:
        result.coupang_link = coupang_candidates[0].link
    notes.append("쿠팡 수동확인필요")

    # ── 네이버: 오류/미설정 감지 ──────────────────────────────────────────
    naver_error = next(
        (c for c in naver_candidates if not c.title and c.note),
        None,
    )
    if naver_error:
        notes.append(naver_error.note)
        result.note = "; ".join(dict.fromkeys(notes))
        return result

    # 유효 후보: 가격 있고 매칭 통과
    matched = [
        c for c in naver_candidates
        if c.price is not None
        and not is_excluded_product(product.name, c.title)
        and score_candidate(product.name, c) >= SCORE_THRESHOLD
    ]

    # ── 스마트스토어 ──────────────────────────────────────────────────────
    if use_smartstore:
        ss_candidates = [c for c in matched if c.source == "naver_smartstore"]
        ss_best = pick_best(product.name, ss_candidates) if ss_candidates else None
        if ss_best:
            result.smartstore_price = ss_best.price
            result.smartstore_shipping = ss_best.shipping_fee
            result.smartstore_total = ss_best.total_price
            result.smartstore_link = ss_best.link
            if ss_best.shipping_fee is None:
                notes.append("스스 배송비 확인불가")
        else:
            notes.append("스스 후보 없음")

    # ── 네이버 최저가 ─────────────────────────────────────────────────────
    if matched:
        # 배송비 포함 합계가 있는 것을 우선 비교
        with_total = [c for c in matched if c.total_price is not None]
        if with_total:
            lowest = min(with_total, key=lambda c: c.total_price)  # type: ignore[return-value]
            result.naver_lowest_mall = lowest.mall_name
            result.naver_lowest_price = lowest.price
            result.naver_lowest_shipping = lowest.shipping_fee
            result.naver_lowest_total = lowest.total_price
            result.naver_lowest_link = lowest.link
        else:
            # 가격만 있는 경우
            lowest = min(matched, key=lambda c: c.price)  # type: ignore[return-value]
            result.naver_lowest_mall = lowest.mall_name
            result.naver_lowest_price = lowest.price
            result.naver_lowest_link = lowest.link
            notes.append("배송비 확인불가")
    else:
        notes.append("네이버 일치 상품 없음")

    result.note = "; ".join(dict.fromkeys(notes))
    return result


class SearchWorker(QThread):
    progress = Signal(int, int)
    log = Signal(str, str)
    finished = Signal(str)

    def __init__(
        self,
        input_path: str,
        output_dir: str,
        has_header: bool,
        config: AppConfig,
    ):
        super().__init__()
        self.input_path = input_path
        self.output_dir = output_dir
        self.has_header = has_header
        self.config = config
        self._stop_flag = False

    def stop(self):
        self._stop_flag = True

    def run(self):
        try:
            products = read_products(self.input_path, self.has_header)
        except Exception as e:
            self.log.emit(f"엑셀 읽기 실패: {e}", "error")
            self.finished.emit("")
            return

        total = len(products)
        self.log.emit(f"총 {total}개 상품 로드 완료", "info")

        # ── 대량 조회 경고 ──────────────────────────────────────────────────
        if self.config.use_naver and self.config.use_playwright and total > BULK_WARN_THRESHOLD:
            self.log.emit(
                f"[주의] 상품이 {total}개입니다. 웹 브라우저 직접조회는 20개 이하를 권장합니다. "
                f"대량 조회 시 차단될 수 있습니다.",
                "warn",
            )

        results: list[PriceResult] = []

        # ── 스크래퍼 초기화 ────────────────────────────────────────────────
        coupang = CoupangScraper(self.config) if self.config.use_coupang else None
        naver = self._create_naver_scraper()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(self.output_dir, f"가격조회결과_{timestamp}.xlsx")
        temp_path = os.path.join(self.output_dir, f"가격조회결과_임시_{timestamp}.xlsx")

        try:
            for idx, product in enumerate(products):
                if self._stop_flag:
                    self.log.emit("사용자에 의해 중지되었습니다.", "warn")
                    break

                self.log.emit(f"[{idx+1}/{total}] {product.name}", "info")
                self.progress.emit(idx + 1, total)

                coupang_candidates: list[Candidate] = []
                naver_candidates: list[Candidate] = []

                if coupang:
                    try:
                        coupang_candidates = coupang.search(product.name)
                    except Exception as e:
                        self.log.emit(f"쿠팡 링크 오류: {e}", "error")

                if naver:
                    try:
                        naver_candidates = naver.search(product.name)
                    except Exception as e:
                        self.log.emit(f"네이버 오류 [{product.name}]: {e}", "error")
                        naver_candidates = [Candidate(
                            source="naver_shopping", mall_name="", title="",
                            price=None, shipping_fee=None, total_price=None,
                            link="", matched_score=0.0,
                            note=f"네이버 확인불가; {type(e).__name__}",
                        )]

                result = build_result(
                    product,
                    coupang_candidates,
                    naver_candidates,
                    use_smartstore=self.config.use_smartstore,
                )
                results.append(result)

                if result.note:
                    self.log.emit(f"  비고: {result.note}", "warn")

                # 임시 저장
                if (idx + 1) % self.config.autosave_interval == 0:
                    try:
                        save_results(results, temp_path, show_links=self.config.show_links)
                        self.log.emit(f"임시 저장: {temp_path}", "info")
                    except Exception as e:
                        self.log.emit(f"임시 저장 실패: {e}", "warn")

                # ── 상품 간 딜레이 (마지막 상품 제외) ───────────────────────
                if (idx + 1) < total and not self._stop_flag:
                    if self.config.use_naver and self.config.use_playwright:
                        delay = random.uniform(self.config.delay_min, self.config.delay_max)
                        self.log.emit(f"  다음 상품까지 {delay:.1f}초 대기", "info")
                        time.sleep(delay)

        finally:
            if naver:
                naver.close()

        # ── 최종 저장 ──────────────────────────────────────────────────────
        if results:
            try:
                save_results(results, output_path, show_links=self.config.show_links)
                self.log.emit(f"결과 저장 완료: {output_path}", "info")
                self.finished.emit(output_path)
            except Exception as e:
                alt_path = output_path.replace(".xlsx", "_alt.xlsx")
                try:
                    save_results(results, alt_path, show_links=self.config.show_links)
                    self.log.emit(f"대체 저장: {alt_path}", "warn")
                    self.finished.emit(alt_path)
                except Exception as e2:
                    self.log.emit(f"최종 저장 실패: {e2}", "error")
                    self.finished.emit("")
        else:
            self.finished.emit("")

    def _create_naver_scraper(self):
        """설정에 따라 적절한 네이버 스크래퍼를 반환한다."""
        if not self.config.use_naver:
            return None

        if self.config.use_playwright:
            from scrapers.naver_playwright import NaverPlaywrightScraper
            self.log.emit("네이버 웹 브라우저 직접조회 모드로 실행합니다.", "info")
            scraper = NaverPlaywrightScraper(self.config)
            scraper.start()
            return scraper
        elif self.config.naver_api_configured():
            self.log.emit("네이버 오픈 API 모드로 실행합니다.", "info")
            return NaverScraper(self.config)
        else:
            self.log.emit(
                "네이버 API 키 미설정 + 웹조회 비활성화 → 네이버 조회를 건너뜁니다.",
                "warn",
            )
            return None


def main():
    from gui import MainWindow
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setApplicationName("Price Checker")
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
