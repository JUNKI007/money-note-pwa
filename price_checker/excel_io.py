import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from models import ProductInput, PriceResult

# ── 색상 ───────────────────────────────────────────────────────────────────────
COLOR_HEADER_BG = "2563EB"
COLOR_HEADER_FG = "FFFFFF"
COLOR_PRICE_BG  = "EFF6FF"
COLOR_WARN_BG   = "FEF3C7"
COLOR_ERROR_BG  = "FEE2E2"
COLOR_BORDER    = "D1D5DB"

# ── 컬럼 정의 (7개 고정) ───────────────────────────────────────────────────────
COLUMNS = [
    "상품코드",
    "상품명",
    "네최몰",
    "네최가",
    "네배송",
    "네합계",
    "비고",
]

PRICE_COLUMNS = {"네최가", "네배송", "네합계"}


def _validate_price_value(col: str, val) -> None:
    """가격 컬럼에 URL·텍스트 오류메시지가 들어가지 않도록 검증한다."""
    if col not in PRICE_COLUMNS:
        return
    if val is None:
        return
    if not isinstance(val, (int, float)):
        raise ValueError(
            f"가격 컬럼 '{col}'에 숫자 이외의 값이 들어왔습니다: {repr(val)}"
        )


def read_products(path: str, has_header: bool) -> list[ProductInput]:
    header_row = 0 if has_header else None
    df = pd.read_excel(path, header=header_row, dtype=str)
    df = df.fillna("")

    row_offset = 1 if has_header else 0
    products: list[ProductInput] = []
    for i, row in df.iterrows():
        code = str(row.iloc[0]).strip()
        name = str(row.iloc[1]).strip()
        if not name:
            continue
        products.append(ProductInput(
            code=code, name=name, row_index=int(i) + row_offset,
        ))
    return products


def _result_to_row(r: PriceResult) -> list:
    return [
        r.code,
        r.name,
        r.naver_lowest_mall,
        r.naver_lowest_price,
        r.naver_lowest_shipping,
        r.naver_lowest_total,
        r.note,
    ]


def save_results(results: list[PriceResult], output_path: str) -> None:
    """가격 컬럼 검증 후 xlsx 저장. 링크·하이퍼링크 없음."""

    # 저장 전 검증
    for r in results:
        row = _result_to_row(r)
        for col, val in zip(COLUMNS, row):
            _validate_price_value(col, val)

    rows = [_result_to_row(r) for r in results]
    df = pd.DataFrame(rows, columns=COLUMNS)
    df.to_excel(output_path, index=False)

    wb = load_workbook(output_path)
    ws = wb.active

    header_fill = PatternFill("solid", fgColor=COLOR_HEADER_BG)
    price_fill  = PatternFill("solid", fgColor=COLOR_PRICE_BG)
    warn_fill   = PatternFill("solid", fgColor=COLOR_WARN_BG)
    error_fill  = PatternFill("solid", fgColor=COLOR_ERROR_BG)

    header_font = Font(bold=True, color=COLOR_HEADER_FG, name="맑은 고딕", size=10)
    normal_font = Font(name="맑은 고딕", size=10)

    thin = Side(style="thin", color=COLOR_BORDER)
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    num_fmt = "#,##0"

    # 헤더
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border

    # 데이터 행
    for row_idx, result in enumerate(results, start=2):
        note = result.note or ""
        is_error = "확인불가" in note or "실패" in note
        is_warn  = "수동확인" in note or "확인불가" in note

        for col_idx, col_name in enumerate(COLUMNS, start=1):
            cell = ws.cell(row=row_idx, column=col_idx)

            if is_error:
                cell.fill = error_fill
            elif is_warn:
                cell.fill = warn_fill
            elif col_name in PRICE_COLUMNS:
                cell.fill = price_fill

            if col_name in PRICE_COLUMNS and isinstance(cell.value, (int, float)):
                cell.number_format = num_fmt
                cell.alignment = Alignment(horizontal="right")

            cell.font = normal_font
            cell.border = border

    # 열 너비
    col_widths = {
        "상품코드": 14,
        "상품명": 34,
        "네최몰": 20,
        "네최가": 13,
        "네배송": 12,
        "네합계": 13,
        "비고": 40,
    }
    for col_idx, col_name in enumerate(COLUMNS, start=1):
        letter = get_column_letter(col_idx)
        ws.column_dimensions[letter].width = col_widths.get(col_name, 14)

    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}{ws.max_row}"
    ws.freeze_panes = "A2"

    wb.save(output_path)
