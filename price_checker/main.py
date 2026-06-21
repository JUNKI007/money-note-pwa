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

logger = logging.getLogger(__name__)

BULK_WARN_THRESHOLD = 20


def build_result(
    product: ProductInput,
    naver_candidates: list[Candidate],
) -> PriceResult:
    """
    네이버 후보 목록에서 최저가를 선정해 PriceResult를 반환한다.
    가격 컬럼에는 int 또는 None만 허용. URL/문자열 절대 불가.
    """
    result = PriceResult(code=product.code, name=product.name)
    notes: list[str] = []

    # 오류 후보 감지 (title 없고 note 있음)
    naver_error = next(
        (c for c in naver_candidates if not c.title and c.note),
        None,
    )
    if naver_error:
        result.note = naver_error.note
        return result

    # 유효 후보: 가격 있고 제외 상품 아니고 매칭 점수 통과
    matched = [
        c for c in naver_candidates
        if c.price is not None
        and not is_excluded_product(product.name, c.title)
        and score_candidate(product.name, c) >= SCORE_THRESHOLD
    ]

    if matched:
        # 배송비 포함 합계 우선, 없으면 가격만
        with_total = [c for c in matched if c.total_price is not None]
        if with_total:
            lowest = min(with_total, key=lambda c: c.total_price)  # type: ignore[return-value]
            result.naver_lowest_mall = lowest.mall_name
            result.naver_lowest_price = lowest.price
            result.naver_lowest_shipping = lowest.shipping_fee
            result.naver_lowest_total = lowest.total_price
        else:
            lowest = min(matched, key=lambda c: c.price)  # type: ignore[return-value]
            result.naver_lowest_mall = lowest.mall_name
            result.naver_lowest_price = lowest.price
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

        if total > BULK_WARN_THRESHOLD:
            self.log.emit(
                f"[주의] 상품 {total}개 — 웹 조회는 20개 이하를 권장합니다. "
                "대량 조회 시 차단될 수 있습니다.",
                "warn",
            )

        results: list[PriceResult] = []

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(self.output_dir, f"최저가조회결과_{timestamp}.xlsx")
        temp_path = os.path.join(self.output_dir, f"최저가조회결과_임시_{timestamp}.xlsx")

        naver = self._create_naver_scraper()

        try:
            for idx, product in enumerate(products):
                if self._stop_flag:
                    self.log.emit("사용자에 의해 중지되었습니다.", "warn")
                    break

                self.log.emit(f"[{idx+1}/{total}] {product.name}", "info")
                self.progress.emit(idx + 1, total)

                naver_candidates: list[Candidate] = []

                if naver:
                    try:
                        naver_candidates = naver.search(product.name)
                    except Exception as e:
                        self.log.emit(f"네이버 오류 [{product.name}]: {e}", "error")
                        naver_candidates = [Candidate(
                            source="naver_shopping", mall_name="", title="",
                            price=None, shipping_fee=None, total_price=None,
                            link="", matched_score=0.0,
                            note=f"네이버 확인불가 / {type(e).__name__}",
                        )]

                result = build_result(product, naver_candidates)
                results.append(result)

                if result.note:
                    self.log.emit(f"  비고: {result.note}", "warn")

                # 임시 저장
                if (idx + 1) % self.config.autosave_interval == 0:
                    try:
                        save_results(results, temp_path)
                        self.log.emit(f"임시 저장: {temp_path}", "info")
                    except Exception as e:
                        self.log.emit(f"임시 저장 실패: {e}", "warn")

                # 상품 간 딜레이 (마지막 상품 제외)
                if (idx + 1) < total and not self._stop_flag and naver:
                    delay = random.uniform(self.config.delay_min, self.config.delay_max)
                    self.log.emit(f"  다음 상품까지 {delay:.1f}초 대기", "info")
                    time.sleep(delay)

        finally:
            if naver:
                naver.close()

        if results:
            try:
                save_results(results, output_path)
                self.log.emit(f"결과 저장 완료: {output_path}", "info")
                self.finished.emit(output_path)
            except Exception as e:
                alt_path = output_path.replace(".xlsx", "_alt.xlsx")
                try:
                    save_results(results, alt_path)
                    self.log.emit(f"대체 저장: {alt_path}", "warn")
                    self.finished.emit(alt_path)
                except Exception as e2:
                    self.log.emit(f"최종 저장 실패: {e2}", "error")
                    self.finished.emit("")
        else:
            self.finished.emit("")

    def _create_naver_scraper(self):
        if not self.config.use_naver:
            return None
        from scrapers.naver_playwright import NaverPlaywrightScraper
        self.log.emit("네이버 웹 브라우저 조회 모드로 실행합니다.", "info")
        scraper = NaverPlaywrightScraper(self.config)
        scraper.start()
        return scraper


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
