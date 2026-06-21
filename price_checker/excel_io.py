import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from models import ProductInput, PriceResult

# ── 업무용 스타일 색상 ──────────────────────────────────────────────────────────
COLOR_HEADER_BG = "2563EB"     # 파란색 헤더 배경
COLOR_HEADER_FG = "FFFFFF"     # 헤더 흰 글자
COLOR_PRICE_BG = "EFF6FF"      # 연한 파란 가격 열
COLOR_WARN_BG = "FEF3C7"       # 주의 행 (수동확인 등)
COLOR_ERROR_BG = "FEE2E2"      # 오류/확인불가 행
COLOR_LINK = "1D4ED8"          # 하이퍼링크 색상
COLOR_BORDER = "D1D5DB"        # 셀 테두리

# ── 기본 표시 컬럼 (가격/텍스트만, URL 없음) ──────────────────────────────────
BASE_COLUMNS = [
    "상품코드", "상품명",
    "쿠팡가", "쿠팡배송", "쿠팡합계",
    "스스가", "스스배송", "스스합계",
    "네최몰", "네최가", "네배송", "네합계",
    "비고",
]

# 링크 전용 숨김 열 (show_links=True일 때만 출력)
LINK_COLUMNS = ["쿠팡링크", "스스링크", "네최링크"]

PRICE_COLUMNS = {
    "쿠팡가", "쿠팡배송", "쿠팡합계",
    "스스가", "스스배송", "스스합계",
    "네최가", "네배송", "네합계",
}


def _validate_price_value(col_name: str, value) -> None:
    """가격 컬럼에 URL이 들어가지 않도록 검증한다."""
    if col_name in PRICE_COLUMNS and isinstance(value, str):
        if value.startswith("http://") or value.startswith("https://"):
            raise ValueError(
                f"가격 컬럼 '{col_name}'에 URL이 포함될 수 없습니다: {value[:60]}"
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
            code=code,
            name=name,
            row_index=int(i) + row_offset,
        ))
    return products


def _result_to_row(r: PriceResult, show_links: bool) -> list:
    base = [
        r.code, r.name,
        r.coupang_price, r.coupang_shipping, r.coupang_total,
        r.smartstore_price, r.smartstore_shipping, r.smartstore_total,
        r.naver_lowest_mall, r.naver_lowest_price, r.naver_lowest_shipping, r.naver_lowest_total,
        r.note,
    ]
    if show_links:
        base += [r.coupang_link, r.smartstore_link, r.naver_lowest_link]
    return base


def save_results(
    results: list[PriceResult],
    output_path: str,
    show_links: bool = False,
) -> None:
    columns = BASE_COLUMNS + (LINK_COLUMNS if show_links else [])

    # 가격 컬럼 URL 검증
    for r in results:
        for col, val in zip(BASE_COLUMNS, _result_to_row(r, show_links=False)):
            _validate_price_value(col, val)

    rows = [_result_to_row(r, show_links) for r in results]
    df = pd.DataFrame(rows, columns=columns)
    df.to_excel(output_path, index=False)

    wb = load_workbook(output_path)
    ws = wb.active

    # 스타일 준비
    header_fill = PatternFill("solid", fgColor=COLOR_HEADER_BG)
    price_fill = PatternFill("solid", fgColor=COLOR_PRICE_BG)
    warn_fill = PatternFill("solid", fgColor=COLOR_WARN_BG)
    error_fill = PatternFill("solid", fgColor=COLOR_ERROR_BG)
    header_font = Font(bold=True, color=COLOR_HEADER_FG, name="맑은 고딕", size=10)
    normal_font = Font(name="맑은 고딕", size=10)
    link_font = Font(color=COLOR_LINK, underline="single", name="맑은 고딕", size=10)
    thin = Side(style="thin", color=COLOR_BORDER)
    cell_border = Border(left=thin, right=thin, top=thin, bottom=thin)
    num_fmt = "#,##0"

    # ── 헤더 행 ──
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = cell_border

    # ── 데이터 행 ──
    naver_mall_col = columns.index("네최몰") + 1

    for row_idx, result in enumerate(results, start=2):
        note = result.note or ""
        is_error = "확인불가" in note or "실패" in note
        is_warn = "수동확인" in note or "후보 없음" in note or "미설정" in note

        for col_idx, col_name in enumerate(columns, start=1):
            cell = ws.cell(row=row_idx, column=col_idx)

            # 행 배경색
            if is_error:
                cell.fill = error_fill
            elif is_warn:
                cell.fill = warn_fill
            elif col_name in PRICE_COLUMNS:
                cell.fill = price_fill

            # 숫자 포맷
            if col_name in PRICE_COLUMNS and isinstance(cell.value, (int, float)):
                cell.number_format = num_fmt
                cell.alignment = Alignment(horizontal="right")

            # 기본 폰트
            cell.font = normal_font
            cell.border = cell_border

        # 네최몰 셀 하이퍼링크 (링크가 있고 mall_name이 있을 때)
        if result.naver_lowest_link and result.naver_lowest_mall:
            cell_mall = ws.cell(row=row_idx, column=naver_mall_col)
            cell_mall.hyperlink = result.naver_lowest_link
            cell_mall.font = link_font

    # ── 열 너비 + 숨김 처리 ──
    col_widths = {
        "상품코드": 14, "상품명": 32, "비고": 45,
        "네최몰": 18,
        **{c: 13 for c in PRICE_COLUMNS},
    }
    for col_idx, col_name in enumerate(columns, start=1):
        letter = get_column_letter(col_idx)
        if col_name in LINK_COLUMNS:
            ws.column_dimensions[letter].width = 60
            ws.column_dimensions[letter].hidden = True
        else:
            ws.column_dimensions[letter].width = col_widths.get(col_name, 14)

    # ── 자동 필터 ──
    ws.auto_filter.ref = f"A1:{get_column_letter(len(columns))}{ws.max_row}"

    # ── 행 고정 (헤더 고정) ──
    ws.freeze_panes = "A2"

    wb.save(output_path)
