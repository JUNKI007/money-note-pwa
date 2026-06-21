import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Font, Alignment
from openpyxl.utils import get_column_letter

from price_checker.models import ProductInput, PriceResult

# 스타일 컬러 상수
COLOR_HEADER_BG = "FFB6C9"      # 연분홍 헤더
COLOR_PRICE_BG = "FFF4D6"       # 연노랑 가격 열
COLOR_ERROR_BG = "FFE4EC"       # 오류/확인불가 행
COLOR_HEADER_FONT = "333333"
COLOR_HYPERLINK = "0563C1"      # 하이퍼링크 색상

COLUMNS = [
    "상품코드", "상품명",
    "쿠팡가", "쿠팡배송", "쿠팡합계",
    "스스가", "스스배송", "스스합계",
    "네최몰", "네최가", "네배송", "네합계",
    "비고",
    "쿠팡링크", "스스링크", "네최링크",   # N~P (숨김 열)
]

PRICE_COLUMNS = {"쿠팡가", "쿠팡배송", "쿠팡합계", "스스가", "스스배송", "스스합계",
                 "네최가", "네배송", "네합계"}


def read_products(path: str, has_header: bool) -> list[ProductInput]:
    """엑셀 파일에서 ProductInput 리스트를 읽는다."""
    header_row = 0 if has_header else None
    df = pd.read_excel(path, header=header_row, dtype=str)
    df = df.fillna("")

    # row_index: 헤더가 있으면 데이터는 엑셀 2행부터이므로 +1 오프셋
    row_offset = 1 if has_header else 0

    products: list[ProductInput] = []
    for i, row in df.iterrows():
        code = str(row.iloc[0]).strip()
        name = str(row.iloc[1]).strip()
        if not name:
            continue
        products.append(ProductInput(
            code=code,
            name=name,
            row_index=int(i) + row_offset,
        ))
    return products


def _result_to_row(r: PriceResult) -> list:
    return [
        r.code, r.name,
        r.coupang_price, r.coupang_shipping, r.coupang_total,
        r.smartstore_price, r.smartstore_shipping, r.smartstore_total,
        r.naver_lowest_mall, r.naver_lowest_price, r.naver_lowest_shipping, r.naver_lowest_total,
        r.note,
        r.coupang_link, r.smartstore_link, r.naver_lowest_link,
    ]


def save_results(results: list[PriceResult], output_path: str) -> None:
    """결과를 xlsx로 저장하고 스타일을 적용한다."""
    rows = [_result_to_row(r) for r in results]
    df = pd.DataFrame(rows, columns=COLUMNS)
    df.to_excel(output_path, index=False)

    wb = load_workbook(output_path)
    ws = wb.active

    header_fill = PatternFill("solid", fgColor=COLOR_HEADER_BG)
    price_fill = PatternFill("solid", fgColor=COLOR_PRICE_BG)
    error_fill = PatternFill("solid", fgColor=COLOR_ERROR_BG)
    header_font = Font(bold=True, color=COLOR_HEADER_FONT, name="맑은 고딕")
    num_fmt = "#,##0"

    # 헤더 스타일
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    # 데이터 행 스타일
    naver_mall_col = COLUMNS.index("네최몰") + 1
    coupang_price_col = COLUMNS.index("쿠팡가") + 1
    coupang_link_col = COLUMNS.index("쿠팡링크") + 1
    ss_price_col = COLUMNS.index("스스가") + 1
    ss_link_col = COLUMNS.index("스스링크") + 1
    naver_link_col = COLUMNS.index("네최링크") + 1

    for row_idx, result in enumerate(results, start=2):
        note = result.note or ""
        is_error = "확인불가" in note or "실패" in note or "수동확인" in note

        for col_idx in range(1, len(COLUMNS) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            col_name = COLUMNS[col_idx - 1]
            if is_error:
                cell.fill = error_fill
            elif col_name in PRICE_COLUMNS:
                cell.fill = price_fill
            if col_name in PRICE_COLUMNS and cell.value is not None:
                cell.number_format = num_fmt

        # 네최몰 셀에 하이퍼링크
        if result.naver_lowest_link:
            cell_mall = ws.cell(row=row_idx, column=naver_mall_col)
            cell_mall.hyperlink = result.naver_lowest_link
            cell_mall.font = Font(color=COLOR_HYPERLINK, underline="single", name="맑은 고딕")

        # 쿠팡가 셀에 하이퍼링크
        if result.coupang_link:
            cell_cp = ws.cell(row=row_idx, column=coupang_price_col)
            cell_cp.hyperlink = result.coupang_link
            cell_cp.font = Font(color=COLOR_HYPERLINK, underline="single", name="맑은 고딕")
            cell_cp.number_format = num_fmt

        # 스스가 셀에 하이퍼링크
        if result.smartstore_link:
            cell_ss = ws.cell(row=row_idx, column=ss_price_col)
            cell_ss.hyperlink = result.smartstore_link
            cell_ss.font = Font(color=COLOR_HYPERLINK, underline="single", name="맑은 고딕")
            cell_ss.number_format = num_fmt

    # 열 너비 자동 조정 + 숨김 열 처리
    for col_idx, col_name in enumerate(COLUMNS, start=1):
        col_letter = get_column_letter(col_idx)
        if col_name == "비고":
            ws.column_dimensions[col_letter].width = 40
        elif col_name == "상품명":
            ws.column_dimensions[col_letter].width = 30
        elif col_name in ("쿠팡링크", "스스링크", "네최링크"):
            ws.column_dimensions[col_letter].width = 50
            ws.column_dimensions[col_letter].hidden = True
        else:
            ws.column_dimensions[col_letter].width = 14

    # 필터 적용
    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}{ws.max_row}"

    # 폰트 기본 설정 (하이퍼링크 셀 제외한 일반 셀)
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            if cell.font and not cell.font.underline:
                cell.font = Font(name="맑은 고딕", size=10)

    wb.save(output_path)
