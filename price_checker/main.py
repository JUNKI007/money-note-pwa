import logging
import os
import sys
from datetime import datetime

# py main.py 직접 실행 시 이 파일이 있는 폴더를 sys.path에 추가
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


def build_result(
    product: ProductInput,
    coupang_candidates: list[Candidate],
    naver_candidates: list[Candidate],
) -> PriceResult:
    """
    네이버 가격비교 최저가 + 스마트스토어 후보 + 쿠팡 검색 링크를 조합한다.
    배송비는 항상 None (미수집). 합계도 None.
    """
    result = PriceResult(code=product.code, name=product.name)
    notes: list[str] = []

    # ── 쿠팡: 링크만 저장, 가격 없음 ──────────────────────────────────────
    if coupang_candidates:
        result.coupang_link = coupang_candidates[0].link

    # ── 네이버 전체 후보: 확인불가 판별 ────────────────────────────────────
    naver_error = next(
        (c for c in naver_candidates if "확인불가" in c.note and not c.title),
        None,
    )
    if naver_error:
        notes.append(naver_error.note)
        result.note = " / ".join(dict.fromkeys(notes))
        return result

    # 매칭 필터: 제외어 없고 유사도 기준 통과
    matched = [
        c for c in naver_candidates
        if c.price is not None
        and not is_excluded_product(product.name, c.title)
        and score_candidate(product.name, c) >= SCORE_THRESHOLD
    ]

    # ── 스마트스토어: 매칭 후보 중 smartstore URL 필터 ──────────────────
    ss_candidates = [c for c in matched if c.source == "naver_smartstore"]
    ss_best = pick_best(product.name, ss_candidates) if ss_candidates else None
    if ss_best:
        result.smartstore_price = ss_best.price
        # 배송비/합계 미수집 → None 유지
        result.smartstore_link = ss_best.link
        notes.append("스스 배송비 확인불가")
    else:
        if naver_candidates and not naver_error:
            notes.append("스스 후보 없음")

    # ── 네이버 최저가: 매칭 후보 중 가격 기준 최저 ─────────────────────
    if matched:
        lowest = min(matched, key=lambda c: c.price)  # type: ignore[return-value]
        result.naver_lowest_mall = lowest.mall_name
        result.naver_lowest_price = lowest.price
        result.naver_lowest_link = lowest.link
        notes.append("네이버 배송비 확인불가")
    else:
        if naver_candidates and not naver_error:
            notes.append("네이버 일치 상품 없음")

    result.note = " / ".join(dict.fromkeys(notes))
    return result


class SearchWorker(QThread):
    progress = Signal(int, int)   # (current, total)
    log = Signal(str, str)        # (message, level: "info"|"warn"|"error")
    finished = Signal(str)        # 결과 파일 경로

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
        output_path = os.path.join(self.output_dir, f"최저가조회결과_{timestamp}.xlsx")
        temp_path = os.path.join(self.output_dir, f"최저가조회결과_임시_{timestamp}.xlsx")

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
                        coupang_candidates = coupang.search(product.name)
                    except Exception as e:
                        self.log.emit(f"쿠팡 링크 생성 오류 [{product.name}]: {e}", "error")

                if naver:
                    try:
                        naver_candidates = naver.search(product.name)
                    except Exception as e:
                        self.log.emit(f"네이버 오류 [{product.name}]: {e}", "error")
                        naver_candidates = [Candidate(
                            source="naver_shopping", mall_name="", title="",
                            price=None, shipping_fee=None, total_price=None,
                            link="", matched_score=0.0,
                            note=f"네이버 확인불가: {type(e).__name__}",
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
                    self.log.emit(f"파일 저장 오류, 대체 저장: {alt_path}", "warn")
                    self.finished.emit(alt_path)
                except Exception as e2:
                    self.log.emit(f"최종 저장 실패: {e2}", "error")
                    self.finished.emit("")
        else:
            self.finished.emit("")


def main():
    from gui import MainWindow
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    app.setApplicationName("Jelly Price Checker")
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
