import asyncio
import logging
import os
import sys
from datetime import datetime

from PySide6.QtCore import QThread, Signal
from PySide6.QtWidgets import QApplication

from price_checker.config import AppConfig
from price_checker.excel_io import read_products, save_results
from price_checker.matcher import pick_best, score_candidate, is_excluded_product, SCORE_THRESHOLD
from price_checker.models import ProductInput, PriceResult, Candidate
from price_checker.scrapers.coupang import CoupangScraper
from price_checker.scrapers.naver import NaverScraper

logger = logging.getLogger(__name__)


def build_result(
    product: ProductInput,
    coupang_candidates: list[Candidate],
    naver_candidates: list[Candidate],
) -> PriceResult:
    """후보 리스트에서 최적 후보를 선택하여 PriceResult를 생성한다."""
    result = PriceResult(code=product.code, name=product.name)
    notes: list[str] = []

    # --- 쿠팡 ---
    cp_error = next((c for c in coupang_candidates if "확인불가" in c.note), None)
    if cp_error:
        # 가격은 기록하되 배송비/합계는 None으로 유지
        result.coupang_price = cp_error.price
        result.coupang_link = cp_error.link
        notes.append(cp_error.note)
    else:
        cp_best = pick_best(product.name, coupang_candidates)
        if cp_best:
            result.coupang_price = cp_best.price
            result.coupang_shipping = cp_best.shipping_fee
            result.coupang_total = cp_best.total_price
            result.coupang_link = cp_best.link
            if cp_best.note:
                notes.append(cp_best.note)
        else:
            if coupang_candidates:
                notes.append("쿠팡 후보 없음")

    # --- 네이버 스마트스토어 ---
    naver_error = next((c for c in naver_candidates if "확인불가" in c.note), None)
    if naver_error:
        notes.append(naver_error.note)
    else:
        ss_candidates = [c for c in naver_candidates if c.source == "naver_smartstore"]
        ss_best = pick_best(product.name, ss_candidates) if ss_candidates else None
        if ss_best:
            result.smartstore_price = ss_best.price
            result.smartstore_shipping = ss_best.shipping_fee
            result.smartstore_total = ss_best.total_price
            result.smartstore_link = ss_best.link
            if ss_best.note:
                notes.append(ss_best.note)
        else:
            notes.append("스스 후보 없음")

        # --- 네이버 최저가 (배송비 포함 기준, 확인된 것끼리만 비교) ---
        all_naver = [c for c in naver_candidates if "확인불가" not in c.note]
        matched = [
            c for c in all_naver
            if not is_excluded_product(product.name, c.title)
            and score_candidate(product.name, c) >= SCORE_THRESHOLD
        ]

        # 배송비+가격 모두 확인된 것만 총액 비교
        with_total = [c for c in matched if c.total_price is not None]
        if with_total:
            lowest = min(with_total, key=lambda c: c.total_price)
            result.naver_lowest_mall = lowest.mall_name
            result.naver_lowest_price = lowest.price
            result.naver_lowest_shipping = lowest.shipping_fee
            result.naver_lowest_total = lowest.total_price
            result.naver_lowest_link = lowest.link
        elif matched:
            # 가격만 있는 최저가
            price_only = min(matched, key=lambda c: c.price or 999999999)
            result.naver_lowest_mall = price_only.mall_name
            result.naver_lowest_price = price_only.price
            result.naver_lowest_link = price_only.link
            notes.append("배송비 확인불가")

    result.note = " / ".join(dict.fromkeys(notes))  # 중복 제거
    return result


class SearchWorker(QThread):
    progress = Signal(int, int)       # (current, total)
    log = Signal(str, str)            # (message, level: "info"|"warn"|"error")
    finished = Signal(str)            # 결과 파일 경로

    def __init__(self, input_path: str, output_dir: str, has_header: bool, config: AppConfig):
        super().__init__()
        self.input_path = input_path
        self.output_dir = output_dir
        self.has_header = has_header
        self.config = config
        self._stop_flag = False

    def stop(self):
        self._stop_flag = True

    def run(self):
        asyncio.run(self._run_async())

    async def _run_async(self):
        try:
            products = read_products(self.input_path, self.has_header)
        except Exception as e:
            self.log.emit(f"엑셀 읽기 실패: {e}", "error")
            self.finished.emit("")
            return

        self.log.emit(f"총 {len(products)}개 상품 로드 완료", "info")
        total = len(products)
        results: list[PriceResult] = []

        coupang = CoupangScraper(self.config) if self.config.use_coupang else None
        naver = NaverScraper(self.config) if self.config.use_naver else None

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(
            self.output_dir, f"최저가조회결과_{timestamp}.xlsx"
        )
        temp_path = os.path.join(
            self.output_dir, f"최저가조회결과_임시_{timestamp}.xlsx"
        )

        try:
            for idx, product in enumerate(products):
                if self._stop_flag:
                    self.log.emit("사용자에 의해 중지되었습니다.", "warn")
                    break

                self.log.emit(f"[{idx+1}/{total}] {product.name} 검색 중...", "info")
                self.progress.emit(idx + 1, total)

                coupang_candidates: list[Candidate] = []
                naver_candidates: list[Candidate] = []

                if coupang:
                    try:
                        coupang_candidates = await coupang.search(product.name)
                    except Exception as e:
                        self.log.emit(f"쿠팡 오류 [{product.name}]: {e}", "error")
                        coupang_candidates = [Candidate(
                            source="coupang", mall_name="쿠팡", title="",
                            price=None, shipping_fee=None, total_price=None,
                            link="", matched_score=0.0, note=f"쿠팡 확인불가: {type(e).__name__}"
                        )]

                if naver:
                    try:
                        naver_candidates = await naver.search(product.name)
                    except Exception as e:
                        self.log.emit(f"네이버 오류 [{product.name}]: {e}", "error")
                        naver_candidates = [Candidate(
                            source="naver_shopping", mall_name="", title="",
                            price=None, shipping_fee=None, total_price=None,
                            link="", matched_score=0.0, note=f"네이버 확인불가: {type(e).__name__}"
                        )]

                result = build_result(product, coupang_candidates, naver_candidates)
                results.append(result)

                if result.note:
                    self.log.emit(f"  → 비고: {result.note}", "warn")

                # 임시 저장
                if (idx + 1) % self.config.autosave_interval == 0:
                    try:
                        save_results(results, temp_path)
                        self.log.emit(f"임시 저장: {temp_path}", "info")
                    except Exception as e:
                        self.log.emit(f"임시 저장 실패: {e}", "warn")

        finally:
            if coupang:
                await coupang.close()
            if naver:
                await naver.close()

        if results:
            try:
                save_results(results, output_path)
                self.log.emit(f"결과 저장 완료: {output_path}", "info")
                self.finished.emit(output_path)
            except Exception as e:
                # 파일이 열려 있으면 다른 이름으로 저장
                alt_path = output_path.replace(".xlsx", "_alt.xlsx")
                try:
                    save_results(results, alt_path)
                    self.log.emit(f"파일 저장 오류, 대체 저장: {alt_path}", "warn")
                    self.finished.emit(alt_path)
                except Exception as e2:
                    self.log.emit(f"최종 저장 실패: {e2}", "error")
                    self.finished.emit("")
        else:
            self.finished.emit("")


def main():
    from price_checker.config import setup_playwright_browsers
    setup_playwright_browsers()  # exe 실행 시 번들 Chromium 경로 설정

    from price_checker.gui import MainWindow
    app = QApplication(sys.argv)
    app.setApplicationName("Jelly Price Checker")
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
