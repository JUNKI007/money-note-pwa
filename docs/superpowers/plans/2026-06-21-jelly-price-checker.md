# Jelly Price Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 엑셀 파일의 상품명을 기준으로 쿠팡·네이버 쇼핑 최저가를 Playwright로 수집하여 결과 엑셀을 생성하는 PySide6 Windows 데스크탑 앱을 구현한다.

**Architecture:** GUI(PySide6)는 메인 스레드에서 실행하고, Playwright async 크롤링은 별도 스레드에서 `asyncio.run()`으로 실행한다. 진행 상황은 Qt Signal로 GUI에 전달한다. CSS selector는 `config.py`의 `SELECTORS` dict에서 중앙 관리하여 사이트 구조 변경 시 한 파일만 수정한다.

**Tech Stack:** Python 3.11+, PySide6, pandas, openpyxl, playwright (async), difflib

## Global Constraints

- Python 3.11 이상
- 모든 파일은 `D:/claude/price_checker/` 하위에 생성
- 상품코드는 검색에 절대 사용 불가, 결과 표시만
- API 키·로그인·쿠키 저장 기능 절대 포함 불가
- 캡차/차단 우회 기능 절대 포함 불가
- 차단·캡차 발생 시 "쿠팡 확인불가" / "네이버 확인불가" 처리 후 다음 상품 진행
- 배송비 미확인 시 합계 빈칸, 비고 "배송비 확인불가"
- 배송비 포함 최저가 비교는 가격+배송비 모두 확인된 후보끼리만
- 기본 headless=False, 기본 딜레이 3초
- 결과 파일명: `최저가조회결과_YYYYMMDD_HHMMSS.xlsx`
- 10개마다 임시 저장

---

## File Map

| 파일 | 역할 |
|---|---|
| `price_checker/models.py` | ProductInput, Candidate, PriceResult dataclass |
| `price_checker/config.py` | 기본 설정값, SELECTORS dict |
| `price_checker/matcher.py` | 용량/향 추출, 후보 필터링, 유사도 계산 |
| `price_checker/excel_io.py` | 엑셀 읽기/쓰기, 스타일 적용 |
| `price_checker/scrapers/base.py` | BaseScraper ABC |
| `price_checker/scrapers/coupang.py` | 쿠팡 Playwright 크롤러 |
| `price_checker/scrapers/naver.py` | 네이버 쇼핑 Playwright 크롤러 |
| `price_checker/gui.py` | PySide6 메인 윈도우 + QSS 젤리 테마 |
| `price_checker/main.py` | 진입점, Worker 스레드 조율 |
| `price_checker/requirements.txt` | 패키지 목록 |
| `price_checker/build_exe.bat` | PyInstaller 빌드 스크립트 |
| `price_checker/README.md` | 설치/실행/빌드 안내 |
| `price_checker/sample/create_samples.py` | 샘플 엑셀 생성 스크립트 |
| `tests/test_matcher.py` | matcher 단위 테스트 |
| `tests/test_excel_io.py` | excel_io 단위 테스트 |

---

### Task 1: 프로젝트 스캐폴딩 — models.py + config.py

**Files:**
- Create: `price_checker/__init__.py`
- Create: `price_checker/models.py`
- Create: `price_checker/config.py`
- Create: `price_checker/scrapers/__init__.py`
- Create: `tests/__init__.py`
- Create: `price_checker/requirements.txt`

**Interfaces:**
- Produces:
  - `ProductInput(code, name, row_index)`
  - `Candidate(source, mall_name, title, price, shipping_fee, total_price, link, matched_score, note)`
  - `PriceResult(code, name, coupang_price, coupang_shipping, coupang_total, smartstore_price, smartstore_shipping, smartstore_total, naver_lowest_mall, naver_lowest_price, naver_lowest_shipping, naver_lowest_total, note, coupang_link, smartstore_link, naver_lowest_link)`
  - `AppConfig` dataclass
  - `SELECTORS` dict

- [ ] **Step 1: 디렉토리 구조 생성**

```bash
mkdir -p D:/claude/price_checker/scrapers
mkdir -p D:/claude/tests
touch D:/claude/price_checker/__init__.py
touch D:/claude/price_checker/scrapers/__init__.py
touch D:/claude/tests/__init__.py
```

- [ ] **Step 2: models.py 작성**

`price_checker/models.py`:
```python
from dataclasses import dataclass, field


@dataclass
class ProductInput:
    code: str
    name: str
    row_index: int


@dataclass
class Candidate:
    source: str          # "coupang" | "naver_smartstore" | "naver_lowest"
    mall_name: str
    title: str
    price: int | None
    shipping_fee: int | None
    total_price: int | None
    link: str
    matched_score: float
    note: str = ""


@dataclass
class PriceResult:
    code: str
    name: str
    coupang_price: int | None = None
    coupang_shipping: int | None = None
    coupang_total: int | None = None
    smartstore_price: int | None = None
    smartstore_shipping: int | None = None
    smartstore_total: int | None = None
    naver_lowest_mall: str = ""
    naver_lowest_price: int | None = None
    naver_lowest_shipping: int | None = None
    naver_lowest_total: int | None = None
    note: str = ""
    coupang_link: str = ""
    smartstore_link: str = ""
    naver_lowest_link: str = ""
```

- [ ] **Step 3: config.py 작성**

`price_checker/config.py`:
```python
from dataclasses import dataclass, field


@dataclass
class AppConfig:
    delay_seconds: float = 3.0
    headless: bool = False
    max_candidates: int = 10
    use_coupang: bool = True
    use_naver: bool = True
    autosave_interval: int = 10  # N개마다 임시 저장


# CSS Selector 중앙 관리 — 사이트 HTML 구조 변경 시 이 dict만 수정
SELECTORS: dict = {
    "coupang": {
        # 검색 결과 목록
        "item_list": "ul.search-product-list li.search-product",
        # 상품명
        "item_name": "div.name",
        # 가격 (원화 단위, 쉼표 포함 숫자)
        "item_price": "strong.price-value",
        # 배송비 텍스트
        "item_shipping": "span.badge.delivery",
        # 상품 링크 (href)
        "item_link": "a.search-product-link",
        # 차단/캡차 감지 텍스트 (포함 여부 확인)
        "block_keywords": ["로봇", "captcha", "CAPTCHA", "인증", "차단"],
    },
    "naver": {
        # 검색 결과 아이템
        "item_list": "div.basicList_item__",
        # 상품명
        "item_name": "a.basicList_title__",
        # 가격
        "item_price": "span.price_num__",
        # 배송비
        "item_shipping": "span.basicList_ship__",
        # 판매처명
        "item_mall": "span.basicList_mall_name__",
        # 링크
        "item_link": "a.basicList_title__",
        # 캡차/차단 감지
        "block_keywords": ["자동입력 방지", "captcha", "로그인", "본인확인"],
        # 스마트스토어 URL 패턴
        "smartstore_patterns": ["smartstore.naver.com", "brand.naver.com"],
    },
}

DEFAULT_CONFIG = AppConfig()
```

- [ ] **Step 4: requirements.txt 작성**

`price_checker/requirements.txt`:
```
PySide6>=6.6.0
pandas>=2.1.0
openpyxl>=3.1.2
playwright>=1.40.0
```

- [ ] **Step 5: 임포트 확인**

```bash
cd D:/claude
python -c "from price_checker.models import ProductInput, Candidate, PriceResult; from price_checker.config import AppConfig, SELECTORS, DEFAULT_CONFIG; print('OK')"
```
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
cd D:/claude
git init
git add price_checker/ tests/ 
git commit -m "feat: scaffold project structure, models, config"
```

---

### Task 2: matcher.py — 상품명 정규화·용량 추출·유사도·후보 선택

**Files:**
- Create: `price_checker/matcher.py`
- Create: `tests/test_matcher.py`

**Interfaces:**
- Consumes: `Candidate` from models.py
- Produces:
  - `extract_volume(name: str) -> str | None` — "600g", "50ml" 등
  - `extract_flavor_tokens(name: str) -> list[str]` — 향/옵션 키워드 리스트
  - `is_excluded_product(input_name: str, candidate_title: str) -> bool`
  - `score_candidate(input_name: str, candidate: Candidate) -> float`
  - `pick_best(input_name: str, candidates: list[Candidate]) -> Candidate | None`

- [ ] **Step 1: 테스트 파일 작성**

`tests/test_matcher.py`:
```python
import pytest
from price_checker.matcher import (
    extract_volume,
    extract_flavor_tokens,
    is_excluded_product,
    score_candidate,
    pick_best,
)
from price_checker.models import Candidate


def make_candidate(title: str, price: int = 10000, shipping: int = 0) -> Candidate:
    return Candidate(
        source="test", mall_name="테스트몰", title=title,
        price=price, shipping_fee=shipping,
        total_price=price + shipping, link="", matched_score=0.0
    )


class TestExtractVolume:
    def test_grams(self):
        assert extract_volume("지오마 화이트머스크 600g") == "600g"

    def test_ml(self):
        assert extract_volume("마르마르디 네롤리 핸드크림 50ml") == "50ml"

    def test_liter(self):
        assert extract_volume("바디워시 1L") == "1l"

    def test_none(self):
        assert extract_volume("상품명만 있는 경우") is None

    def test_decimal(self):
        assert extract_volume("오일 1.5L") == "1.5l"


class TestExtractFlavorTokens:
    def test_basic(self):
        tokens = extract_flavor_tokens("지오마 화이트머스크 600g")
        assert "화이트머스크" in tokens

    def test_multiple(self):
        tokens = extract_flavor_tokens("마르마르디 네롤리 핸드크림 50ml")
        assert "네롤리" in tokens


class TestIsExcluded:
    def test_exclude_set(self):
        assert is_excluded_product("지오마 600g", "지오마 600g 세트") is True

    def test_exclude_1plus1(self):
        assert is_excluded_product("지오마 600g", "지오마 600g 1+1") is True

    def test_exclude_sample(self):
        assert is_excluded_product("지오마 600g", "지오마 샘플 30g") is True

    def test_not_exclude_when_input_has_set(self):
        assert is_excluded_product("지오마 600g 세트", "지오마 600g 세트") is False

    def test_exclude_mini(self):
        assert is_excluded_product("핸드크림 50ml", "핸드크림 미니 20ml") is True

    def test_normal_pass(self):
        assert is_excluded_product("지오마 화이트머스크 600g", "지오마 화이트머스크 600g 바디워시") is False


class TestScoreCandidate:
    def test_volume_match_boosts_score(self):
        c_match = make_candidate("지오마 화이트머스크 600g")
        c_mismatch = make_candidate("지오마 화이트머스크 250ml")
        s_match = score_candidate("지오마 화이트머스크 600g", c_match)
        s_mismatch = score_candidate("지오마 화이트머스크 600g", c_mismatch)
        assert s_match > s_mismatch

    def test_volume_mismatch_zero(self):
        c = make_candidate("지오마 화이트머스크 250ml")
        s = score_candidate("지오마 화이트머스크 600g", c)
        assert s == 0.0


class TestPickBest:
    def test_picks_highest_score(self):
        candidates = [
            make_candidate("지오마 화이트머스크 600g"),
            make_candidate("지오마 피치코코 600g"),
        ]
        result = pick_best("지오마 화이트머스크 600g", candidates)
        assert result is not None
        assert "화이트머스크" in result.title

    def test_returns_none_when_empty(self):
        assert pick_best("지오마 600g", []) is None

    def test_returns_none_all_excluded(self):
        candidates = [make_candidate("지오마 600g 1+1")]
        assert pick_best("지오마 600g", candidates) is None
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd D:/claude
python -m pytest tests/test_matcher.py -v 2>&1 | head -20
```
Expected: `ModuleNotFoundError` 또는 `ImportError`

- [ ] **Step 3: matcher.py 구현**

`price_checker/matcher.py`:
```python
import re
import difflib
from price_checker.models import Candidate

# 용량 단위 패턴
_VOLUME_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(ml|l|g|kg|개|매|팩|입)",
    re.IGNORECASE,
)

# 세트/묶음 제외 키워드
_EXCLUDE_KEYWORDS = re.compile(
    r"1\+1|2개|3개|세트|기획|리필|샘플|미니|여행용|묶음",
    re.IGNORECASE,
)

# 브랜드명·일반 단어로 보기 어려운 최소 길이
_MIN_TOKEN_LEN = 2

# 유사도가 이 값 미만이면 "수동확인필요" 처리
SCORE_THRESHOLD = 0.25


def extract_volume(name: str) -> str | None:
    """상품명에서 첫 번째 용량 토큰을 추출. 예: '600g', '50ml', '1l'"""
    m = _VOLUME_RE.search(name)
    if not m:
        return None
    value, unit = m.group(1), m.group(2).lower()
    return f"{value}{unit}"


def _normalize_volume(v: str) -> str:
    """1000ml ↔ 1l 등 정규화는 생략하고 소문자 통일만"""
    return v.lower().replace(" ", "")


def extract_flavor_tokens(name: str) -> list[str]:
    """
    상품명에서 향/옵션 키워드 추출.
    숫자+단위, 2글자 미만 토큰, 흔한 품목명(바디워시, 핸드크림 등)은 제외.
    """
    COMMON_WORDS = {
        "바디워시", "핸드크림", "샴푸", "컨디셔너", "로션", "크림",
        "에센스", "오일", "미스트", "토너", "세럼", "클렌저",
    }
    # 용량 제거
    cleaned = _VOLUME_RE.sub("", name)
    # 특수문자를 공백으로
    cleaned = re.sub(r"[^\w가-힣]", " ", cleaned)
    tokens = [t for t in cleaned.split() if len(t) >= _MIN_TOKEN_LEN]
    return [t for t in tokens if t not in COMMON_WORDS]


def is_excluded_product(input_name: str, candidate_title: str) -> bool:
    """
    입력 상품명에 없는 세트/묶음 키워드가 후보 제목에 있으면 True.
    입력 상품명 자체에 세트 키워드가 있으면 제외하지 않음.
    """
    input_has_exclude = bool(_EXCLUDE_KEYWORDS.search(input_name))
    candidate_has_exclude = bool(_EXCLUDE_KEYWORDS.search(candidate_title))
    if input_has_exclude:
        return False  # 입력 자체가 세트→ 제외 안 함
    return candidate_has_exclude


def score_candidate(input_name: str, candidate: Candidate) -> float:
    """
    후보의 매칭 점수를 0.0~1.0+ 범위로 반환.
    용량 불일치 시 0.0 반환 (강제 제외).
    """
    input_vol = extract_volume(input_name)
    cand_vol = extract_volume(candidate.title)

    # 입력에 용량이 있는데 후보 용량이 다르면 0점
    if input_vol is not None:
        if cand_vol is None:
            return 0.0
        if _normalize_volume(input_vol) != _normalize_volume(cand_vol):
            return 0.0

    # 기본 문자열 유사도
    base_score = difflib.SequenceMatcher(
        None, input_name.lower(), candidate.title.lower()
    ).ratio()

    # 용량 일치 보너스
    if input_vol and cand_vol and _normalize_volume(input_vol) == _normalize_volume(cand_vol):
        base_score += 0.3

    # 향/옵션 키워드 보너스
    flavor_tokens = extract_flavor_tokens(input_name)
    for tok in flavor_tokens:
        if tok.lower() in candidate.title.lower():
            base_score += 0.1

    return base_score


def pick_best(input_name: str, candidates: list[Candidate]) -> Candidate | None:
    """
    후보 중 제외 필터를 통과하고 점수가 가장 높은 항목 반환.
    점수가 SCORE_THRESHOLD 미만이면 None 반환.
    """
    scored: list[tuple[float, Candidate]] = []
    for c in candidates:
        if is_excluded_product(input_name, c.title):
            continue
        s = score_candidate(input_name, c)
        if s > 0.0:
            scored.append((s, c))

    if not scored:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]

    if best_score < SCORE_THRESHOLD:
        return None

    best.matched_score = best_score
    return best
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd D:/claude
python -m pytest tests/test_matcher.py -v
```
Expected: 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
cd D:/claude
git add price_checker/matcher.py tests/test_matcher.py
git commit -m "feat: add matcher with volume extraction, exclusion filter, scoring"
```

---

### Task 3: excel_io.py — 엑셀 읽기·쓰기·스타일

**Files:**
- Create: `price_checker/excel_io.py`
- Create: `tests/test_excel_io.py`

**Interfaces:**
- Consumes: `ProductInput`, `PriceResult` from models.py
- Produces:
  - `read_products(path: str, has_header: bool) -> list[ProductInput]`
  - `save_results(results: list[PriceResult], output_path: str) -> None`

- [ ] **Step 1: 테스트 파일 작성**

`tests/test_excel_io.py`:
```python
import os
import pytest
import pandas as pd
from price_checker.excel_io import read_products, save_results
from price_checker.models import ProductInput, PriceResult


@pytest.fixture
def tmp_input_xlsx(tmp_path):
    path = tmp_path / "input.xlsx"
    df = pd.DataFrame({
        "상품코드": ["A001", "A002", ""],
        "상품명": ["지오마 화이트머스크 600g", "마르마르디 네롤리 핸드크림 50ml", ""],
    })
    df.to_excel(path, index=False)
    return str(path)


@pytest.fixture
def tmp_input_no_header(tmp_path):
    path = tmp_path / "input_no_header.xlsx"
    df = pd.DataFrame({
        0: ["A001", "A002"],
        1: ["지오마 화이트머스크 600g", "마르마르디 네롤리 50ml"],
    })
    df.to_excel(path, index=False, header=False)
    return str(path)


def test_read_with_header(tmp_input_xlsx):
    products = read_products(tmp_input_xlsx, has_header=True)
    assert len(products) == 2
    assert products[0].code == "A001"
    assert products[0].name == "지오마 화이트머스크 600g"
    assert products[0].row_index == 1


def test_read_skip_empty_name(tmp_input_xlsx):
    products = read_products(tmp_input_xlsx, has_header=True)
    assert all(p.name != "" for p in products)


def test_read_no_header(tmp_input_no_header):
    products = read_products(tmp_input_no_header, has_header=False)
    assert len(products) == 2
    assert products[0].code == "A001"


def test_save_results_creates_file(tmp_path):
    results = [
        PriceResult(
            code="A001", name="지오마 화이트머스크 600g",
            coupang_price=18900, coupang_shipping=0, coupang_total=18900,
            smartstore_price=19000, smartstore_shipping=3000, smartstore_total=22000,
            naver_lowest_mall="올리브영", naver_lowest_price=17900,
            naver_lowest_shipping=0, naver_lowest_total=17900,
            note="",
            coupang_link="https://coupang.com/test",
            smartstore_link="https://smartstore.naver.com/test",
            naver_lowest_link="https://oliveyoung.co.kr/test",
        )
    ]
    out = str(tmp_path / "result.xlsx")
    save_results(results, out)
    assert os.path.exists(out)
    df = pd.read_excel(out)
    assert "상품코드" in df.columns
    assert "쿠팡가" in df.columns
    assert df.iloc[0]["쿠팡가"] == 18900
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd D:/claude
python -m pytest tests/test_excel_io.py -v 2>&1 | head -10
```
Expected: `ImportError`

- [ ] **Step 3: excel_io.py 구현**

`price_checker/excel_io.py`:
```python
import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Font, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string
from openpyxl.worksheet.hyperlink import Hyperlink

from price_checker.models import ProductInput, PriceResult

# 스타일 컬러 상수
COLOR_HEADER_BG = "FFB6C9"      # 연분홍 헤더
COLOR_PRICE_BG = "FFF4D6"       # 연노랑 가격 열
COLOR_ERROR_BG = "FFE4EC"       # 오류/확인불가 행
COLOR_HEADER_FONT = "333333"

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
PRICE_COL_INDICES = [COLUMNS.index(c) + 1 for c in PRICE_COLUMNS]


def read_products(path: str, has_header: bool) -> list[ProductInput]:
    """엑셀 파일에서 ProductInput 리스트를 읽는다."""
    header_row = 0 if has_header else None
    df = pd.read_excel(path, header=header_row, dtype=str)
    df = df.fillna("")

    products: list[ProductInput] = []
    for i, row in df.iterrows():
        code = str(row.iloc[0]).strip()
        name = str(row.iloc[1]).strip()
        if not name:
            continue
        products.append(ProductInput(
            code=code,
            name=name,
            row_index=int(i),
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
    naver_link_col = COLUMNS.index("네최링크") + 1
    coupang_price_col = COLUMNS.index("쿠팡가") + 1
    coupang_link_col = COLUMNS.index("쿠팡링크") + 1
    ss_price_col = COLUMNS.index("스스가") + 1
    ss_link_col = COLUMNS.index("스스링크") + 1
    note_col = COLUMNS.index("비고") + 1

    for row_idx, result in enumerate(results, start=2):
        note = result.note or ""
        is_error = "확인불가" in note or "실패" in note or "수동확인" in note

        for col_idx, cell in enumerate(ws[row_idx], start=1):
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
            cell_mall.font = Font(color="0563C1", underline="single", name="맑은 고딕")

        # 쿠팡가 셀에 하이퍼링크
        if result.coupang_link:
            cell_cp = ws.cell(row=row_idx, column=coupang_price_col)
            cell_cp.hyperlink = result.coupang_link
            cell_cp.font = Font(color="0563C1", underline="single", name="맑은 고딕")

        # 스스가 셀에 하이퍼링크
        if result.smartstore_link:
            cell_ss = ws.cell(row=row_idx, column=ss_price_col)
            cell_ss.hyperlink = result.smartstore_link
            cell_ss.font = Font(color="0563C1", underline="single", name="맑은 고딕")

    # 열 너비 자동 조정
    for col_idx, col_name in enumerate(COLUMNS, start=1):
        col_letter = get_column_letter(col_idx)
        if col_name == "비고":
            ws.column_dimensions[col_letter].width = 40
        elif col_name in ("상품명",):
            ws.column_dimensions[col_letter].width = 30
        elif col_name in ("쿠팡링크", "스스링크", "네최링크"):
            ws.column_dimensions[col_letter].width = 50
            ws.column_dimensions[col_letter].hidden = True
        else:
            ws.column_dimensions[col_letter].width = 14

    # 필터 적용
    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}{ws.max_row}"

    # 폰트 기본 설정
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            if cell.font and not cell.font.underline:
                cell.font = Font(name="맑은 고딕", size=10)

    wb.save(output_path)
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd D:/claude
python -m pytest tests/test_excel_io.py -v
```
Expected: 모든 테스트 PASS

- [ ] **Step 5: Commit**

```bash
cd D:/claude
git add price_checker/excel_io.py tests/test_excel_io.py
git commit -m "feat: add excel read/write with jelly theme styling"
```

---

### Task 4: scrapers/base.py + scrapers/coupang.py

**Files:**
- Create: `price_checker/scrapers/base.py`
- Create: `price_checker/scrapers/coupang.py`

**Interfaces:**
- Consumes: `Candidate`, `AppConfig`, `SELECTORS`
- Produces:
  - `BaseScraper` ABC with `async def search(name: str) -> list[Candidate]`
  - `CoupangScraper(config: AppConfig)` — `async def search(name: str) -> list[Candidate]`

- [ ] **Step 1: base.py 작성**

`price_checker/scrapers/base.py`:
```python
from abc import ABC, abstractmethod
from price_checker.models import Candidate


class BaseScraper(ABC):
    """추후 API 방식으로 교체할 수 있도록 인터페이스 분리."""

    @abstractmethod
    async def search(self, name: str) -> list[Candidate]:
        """상품명으로 검색하여 Candidate 리스트 반환."""
        ...

    @abstractmethod
    async def close(self) -> None:
        """브라우저 등 리소스 해제."""
        ...
```

- [ ] **Step 2: coupang.py 작성**

`price_checker/scrapers/coupang.py`:
```python
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
```

- [ ] **Step 3: 임포트 확인**

```bash
cd D:/claude
python -c "from price_checker.scrapers.coupang import CoupangScraper; from price_checker.scrapers.base import BaseScraper; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd D:/claude
git add price_checker/scrapers/base.py price_checker/scrapers/coupang.py
git commit -m "feat: add BaseScraper interface and CoupangScraper with Playwright"
```

---

### Task 5: scrapers/naver.py

**Files:**
- Create: `price_checker/scrapers/naver.py`

**Interfaces:**
- Consumes: `Candidate`, `AppConfig`, `SELECTORS`
- Produces:
  - `NaverScraper(config: AppConfig)`
  - `async def search(name: str) -> list[Candidate]` — 스마트스토어+일반 후보 혼합 반환
  - `source` 필드: 스마트스토어면 `"naver_smartstore"`, 아니면 `"naver_shopping"`

- [ ] **Step 1: naver.py 작성**

`price_checker/scrapers/naver.py`:
```python
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
            items = await page.query_selector_all(f"[class*='basicList_item']")
            if not items:
                # 대안 셀렉터 시도
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
                        parent = await name_el.query_selector("a")
                        if parent:
                            href = await parent.get_attribute("href") or ""

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
```

- [ ] **Step 2: 임포트 확인**

```bash
cd D:/claude
python -c "from price_checker.scrapers.naver import NaverScraper; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd D:/claude
git add price_checker/scrapers/naver.py
git commit -m "feat: add NaverScraper with smartstore detection and block handling"
```

---

### Task 6: main.py — Worker 스레드 + 가격 취합 로직

**Files:**
- Create: `price_checker/main.py`

**Interfaces:**
- Consumes: 모든 앞선 모듈
- Produces:
  - `SearchWorker(QThread)` — `progress`, `log`, `result_ready`, `finished` Signal
  - `run_search(products, config, output_dir) -> str` (결과 파일 경로 반환)
  - `build_result(product, coupang_candidates, naver_candidates) -> PriceResult`

- [ ] **Step 1: main.py 작성**

`price_checker/main.py`:
```python
import asyncio
import logging
import os
import sys
from datetime import datetime
from typing import Callable

from PySide6.QtCore import QThread, Signal
from PySide6.QtWidgets import QApplication

from price_checker.config import AppConfig
from price_checker.excel_io import read_products, save_results
from price_checker.matcher import pick_best, score_candidate
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
        matched = [c for c in all_naver if pick_best(product.name, [c]) is not None]

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
    from price_checker.gui import MainWindow
    app = QApplication(sys.argv)
    app.setApplicationName("Jelly Price Checker")
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 임포트 확인**

```bash
cd D:/claude
python -c "from price_checker.main import build_result, SearchWorker; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: build_result 단위 검증**

```bash
cd D:/claude
python -c "
from price_checker.main import build_result
from price_checker.models import ProductInput, Candidate
p = ProductInput('A001', '지오마 화이트머스크 600g', 0)
cp = [Candidate('coupang','쿠팡','지오마 화이트머스크 600g 바디워시',18900,0,18900,'https://c.com',0.0,'')]
nv = [Candidate('naver_smartstore','ABC스토어','지오마 화이트머스크 600g',19000,3000,22000,'https://smartstore.naver.com/abc',0.0,'')]
r = build_result(p, cp, nv)
print('쿠팡가:', r.coupang_price, '스스가:', r.smartstore_price)
assert r.coupang_price == 18900
assert r.smartstore_price == 19000
print('OK')
"
```
Expected: `쿠팡가: 18900 스스가: 19000` → `OK`

- [ ] **Step 4: Commit**

```bash
cd D:/claude
git add price_checker/main.py
git commit -m "feat: add SearchWorker thread and build_result aggregation logic"
```

---

### Task 7: gui.py — PySide6 젤리 테마 메인 윈도우

**Files:**
- Create: `price_checker/gui.py`

**Interfaces:**
- Consumes: `SearchWorker`, `AppConfig` from main.py / config.py
- Produces: `MainWindow(QMainWindow)` — 실행 가능한 GUI

- [ ] **Step 1: gui.py 작성**

`price_checker/gui.py`:
```python
import os
import subprocess
import sys
from datetime import datetime

from PySide6.QtCore import Qt, QThread
from PySide6.QtGui import QFont, QColor
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QLineEdit, QCheckBox, QSpinBox,
    QDoubleSpinBox, QProgressBar, QTextEdit, QFileDialog,
    QGroupBox, QScrollArea, QFrame, QSizePolicy,
)

from price_checker.config import AppConfig
from price_checker.main import SearchWorker

# ── QSS 스타일시트 ─────────────────────────────────────────────────────────────
QSS = """
QMainWindow, QWidget#centralWidget {
    background-color: #FFF9FB;
}

/* 헤더 */
QWidget#header {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #FFB6C9, stop:1 #FFD6E4);
    border-radius: 0px;
}
QLabel#appTitle {
    color: #333333;
    font-size: 22px;
    font-weight: bold;
    font-family: '맑은 고딕';
}
QLabel#appSubtitle {
    color: #555555;
    font-size: 11px;
    font-family: '맑은 고딕';
}

/* 카드 */
QGroupBox {
    background-color: #FFFFFF;
    border: 1.5px solid #F3DDE5;
    border-radius: 12px;
    margin-top: 8px;
    font-size: 12px;
    font-weight: bold;
    font-family: '맑은 고딕';
    color: #444444;
    padding: 8px;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 4px;
    color: #FF7FA3;
}

/* 일반 라벨 */
QLabel {
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 11px;
}

/* 입력창 */
QLineEdit {
    border: 1.5px solid #F3DDE5;
    border-radius: 8px;
    padding: 5px 10px;
    background: #FFFFFF;
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 11px;
}
QLineEdit:focus {
    border-color: #FFB6C9;
}

/* 숫자 입력 */
QDoubleSpinBox, QSpinBox {
    border: 1.5px solid #F3DDE5;
    border-radius: 8px;
    padding: 4px 8px;
    background: #FFFFFF;
    color: #333333;
    font-family: '맑은 고딕';
}
QDoubleSpinBox:focus, QSpinBox:focus {
    border-color: #FFB6C9;
}

/* 체크박스 */
QCheckBox {
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 11px;
    spacing: 6px;
}
QCheckBox::indicator {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid #F3DDE5;
    background: #FFFFFF;
}
QCheckBox::indicator:checked {
    background: #FFB6C9;
    border-color: #FF7FA3;
}

/* 분홍 젤리 버튼 */
QPushButton#btnPink {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FFB6C9, stop:1 #FF9AB8);
    color: #333333;
    border: none;
    border-radius: 10px;
    padding: 7px 16px;
    font-family: '맑은 고딕';
    font-size: 11px;
    font-weight: bold;
}
QPushButton#btnPink:hover {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FFC8D6, stop:1 #FFB0CA);
}
QPushButton#btnPink:pressed {
    background: #FF7FA3;
}

/* 노랑 젤리 버튼 */
QPushButton#btnYellow {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FFE79A, stop:1 #FFDA70);
    color: #333333;
    border: none;
    border-radius: 10px;
    padding: 7px 16px;
    font-family: '맑은 고딕';
    font-size: 11px;
    font-weight: bold;
}
QPushButton#btnYellow:hover {
    background: #FFECA0;
}
QPushButton#btnYellow:pressed {
    background: #FFC940;
}

/* 시작 버튼 (크고 진한 분홍) */
QPushButton#btnStart {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FF7FA3, stop:1 #FF5C8A);
    color: #FFFFFF;
    border: none;
    border-radius: 12px;
    padding: 10px 28px;
    font-family: '맑은 고딕';
    font-size: 13px;
    font-weight: bold;
    min-width: 120px;
}
QPushButton#btnStart:hover {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FF9AB8, stop:1 #FF7FA3);
}
QPushButton#btnStart:disabled {
    background: #DDDDDD;
    color: #AAAAAA;
}

/* 중지 버튼 */
QPushButton#btnStop {
    background: #F0F0F0;
    color: #777777;
    border: 1.5px solid #DDDDDD;
    border-radius: 12px;
    padding: 10px 20px;
    font-family: '맑은 고딕';
    font-size: 12px;
}
QPushButton#btnStop:hover {
    background: #FFE79A;
    border-color: #FFDA70;
    color: #333333;
}
QPushButton#btnStop:disabled {
    background: #F5F5F5;
    color: #CCCCCC;
    border-color: #EEEEEE;
}

/* 결과 열기 버튼 */
QPushButton#btnOpen {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
        stop:0 #FFB6C9, stop:1 #FF9AB8);
    color: #333333;
    border: none;
    border-radius: 10px;
    padding: 8px 20px;
    font-family: '맑은 고딕';
    font-size: 12px;
    font-weight: bold;
}
QPushButton#btnOpen:disabled {
    background: #EEEEEE;
    color: #BBBBBB;
}

/* 진행률 바 */
QProgressBar {
    border: none;
    border-radius: 8px;
    background: #F3DDE5;
    height: 14px;
    text-align: center;
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 10px;
}
QProgressBar::chunk {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
        stop:0 #FFB6C9, stop:1 #FF7FA3);
    border-radius: 8px;
}

/* 로그창 */
QTextEdit#logBox {
    background: #FFFFFF;
    border: 1.5px solid #F3DDE5;
    border-radius: 10px;
    color: #333333;
    font-family: '맑은 고딕';
    font-size: 10px;
    padding: 6px;
}

/* 현재 상품 라벨 */
QLabel#currentItem {
    color: #FF7FA3;
    font-family: '맑은 고딕';
    font-size: 11px;
    font-weight: bold;
}
"""


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Jelly Price Checker")
        self.setMinimumSize(900, 650)
        self.resize(950, 700)

        self._worker: SearchWorker | None = None
        self._result_path: str = ""
        self._config = AppConfig()

        self._setup_ui()
        self.setStyleSheet(QSS)

    def _setup_ui(self):
        central = QWidget()
        central.setObjectName("centralWidget")
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        # 헤더
        root.addWidget(self._make_header())

        # 스크롤 영역 (본문)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setStyleSheet("QScrollArea { background: #FFF9FB; border: none; }")
        body = QWidget()
        body.setStyleSheet("background: #FFF9FB;")
        body_layout = QVBoxLayout(body)
        body_layout.setContentsMargins(20, 16, 20, 16)
        body_layout.setSpacing(12)

        body_layout.addWidget(self._make_file_card())
        body_layout.addWidget(self._make_settings_card())
        body_layout.addWidget(self._make_run_card())
        body_layout.addWidget(self._make_log_card())
        body_layout.addStretch()

        scroll.setWidget(body)
        root.addWidget(scroll)

    def _make_header(self) -> QWidget:
        header = QWidget()
        header.setObjectName("header")
        header.setFixedHeight(80)
        layout = QVBoxLayout(header)
        layout.setContentsMargins(24, 12, 24, 12)
        layout.setSpacing(2)

        title = QLabel("🍬 Jelly Price Checker")
        title.setObjectName("appTitle")
        subtitle = QLabel("상품명 기준으로 쿠팡/네이버 최저가를 한번에 정리해요")
        subtitle.setObjectName("appSubtitle")

        layout.addWidget(title)
        layout.addWidget(subtitle)
        return header

    def _make_file_card(self) -> QGroupBox:
        box = QGroupBox("📂 파일 선택")
        layout = QVBoxLayout(box)
        layout.setSpacing(10)

        # 입력 엑셀
        row1 = QHBoxLayout()
        self.inputPathEdit = QLineEdit()
        self.inputPathEdit.setPlaceholderText("입력 엑셀 파일을 선택하세요 (.xlsx / .xls)")
        self.inputPathEdit.setReadOnly(True)
        btn_input = QPushButton("엑셀 선택")
        btn_input.setObjectName("btnPink")
        btn_input.clicked.connect(self._select_input)
        row1.addWidget(QLabel("입력 파일:"))
        row1.addWidget(self.inputPathEdit, 1)
        row1.addWidget(btn_input)
        layout.addLayout(row1)

        # 저장 위치
        row2 = QHBoxLayout()
        self.outputDirEdit = QLineEdit()
        self.outputDirEdit.setPlaceholderText("결과 파일 저장 위치 (기본: 입력 파일과 동일)")
        self.outputDirEdit.setReadOnly(True)
        btn_output = QPushButton("폴더 선택")
        btn_output.setObjectName("btnYellow")
        btn_output.clicked.connect(self._select_output_dir)
        row2.addWidget(QLabel("저장 위치:"))
        row2.addWidget(self.outputDirEdit, 1)
        row2.addWidget(btn_output)
        layout.addLayout(row2)

        # 옵션
        self.headerCheck = QCheckBox("첫 행을 헤더로 사용")
        self.headerCheck.setChecked(True)
        layout.addWidget(self.headerCheck)
        return box

    def _make_settings_card(self) -> QGroupBox:
        box = QGroupBox("⚙️ 검색 설정")
        layout = QHBoxLayout(box)
        layout.setSpacing(20)

        # 딜레이
        col1 = QVBoxLayout()
        col1.addWidget(QLabel("요청 딜레이 (초)"))
        self.delaySpin = QDoubleSpinBox()
        self.delaySpin.setRange(1.0, 30.0)
        self.delaySpin.setValue(3.0)
        self.delaySpin.setSingleStep(0.5)
        col1.addWidget(self.delaySpin)
        layout.addLayout(col1)

        # 최대 후보 수
        col2 = QVBoxLayout()
        col2.addWidget(QLabel("최대 후보 수"))
        self.maxCandSpin = QSpinBox()
        self.maxCandSpin.setRange(3, 30)
        self.maxCandSpin.setValue(10)
        col2.addWidget(self.maxCandSpin)
        layout.addLayout(col2)

        # 체크박스
        col3 = QVBoxLayout()
        self.headlessCheck = QCheckBox("브라우저 숨기기 (headless)")
        self.headlessCheck.setChecked(False)
        self.coupangCheck = QCheckBox("쿠팡 검색 사용")
        self.coupangCheck.setChecked(True)
        self.naverCheck = QCheckBox("네이버 검색 사용")
        self.naverCheck.setChecked(True)
        col3.addWidget(self.headlessCheck)
        col3.addWidget(self.coupangCheck)
        col3.addWidget(self.naverCheck)
        layout.addLayout(col3)

        layout.addStretch()
        return box

    def _make_run_card(self) -> QGroupBox:
        box = QGroupBox("🚀 실행")
        layout = QVBoxLayout(box)
        layout.setSpacing(10)

        # 버튼 행
        btn_row = QHBoxLayout()
        self.btnStart = QPushButton("검색 시작")
        self.btnStart.setObjectName("btnStart")
        self.btnStart.clicked.connect(self._start_search)

        self.btnStop = QPushButton("중지")
        self.btnStop.setObjectName("btnStop")
        self.btnStop.setEnabled(False)
        self.btnStop.clicked.connect(self._stop_search)

        self.btnOpen = QPushButton("결과 엑셀 열기 🍬")
        self.btnOpen.setObjectName("btnOpen")
        self.btnOpen.setEnabled(False)
        self.btnOpen.clicked.connect(self._open_result)

        btn_row.addWidget(self.btnStart)
        btn_row.addWidget(self.btnStop)
        btn_row.addSpacing(20)
        btn_row.addWidget(self.btnOpen)
        btn_row.addStretch()
        layout.addLayout(btn_row)

        # 진행률
        self.progressBar = QProgressBar()
        self.progressBar.setValue(0)
        layout.addWidget(self.progressBar)

        # 현재 상품
        self.currentItemLabel = QLabel("대기 중...")
        self.currentItemLabel.setObjectName("currentItem")
        layout.addWidget(self.currentItemLabel)

        return box

    def _make_log_card(self) -> QGroupBox:
        box = QGroupBox("📋 로그")
        layout = QVBoxLayout(box)
        self.logBox = QTextEdit()
        self.logBox.setObjectName("logBox")
        self.logBox.setReadOnly(True)
        self.logBox.setMinimumHeight(180)
        layout.addWidget(self.logBox)
        return box

    # ── 슬롯 ──────────────────────────────────────────────────────────────────

    def _select_input(self):
        path, _ = QFileDialog.getOpenFileName(
            self, "입력 엑셀 선택", "", "Excel Files (*.xlsx *.xls)"
        )
        if path:
            self.inputPathEdit.setText(path)
            if not self.outputDirEdit.text():
                self.outputDirEdit.setText(os.path.dirname(path))

    def _select_output_dir(self):
        path = QFileDialog.getExistingDirectory(self, "저장 위치 선택")
        if path:
            self.outputDirEdit.setText(path)

    def _start_search(self):
        input_path = self.inputPathEdit.text()
        if not input_path or not os.path.exists(input_path):
            self._log("입력 엑셀 파일을 먼저 선택해주세요.", "error")
            return
        output_dir = self.outputDirEdit.text() or os.path.dirname(input_path)

        config = AppConfig(
            delay_seconds=self.delaySpin.value(),
            headless=self.headlessCheck.isChecked(),
            max_candidates=self.maxCandSpin.value(),
            use_coupang=self.coupangCheck.isChecked(),
            use_naver=self.naverCheck.isChecked(),
        )

        self._worker = SearchWorker(
            input_path=input_path,
            output_dir=output_dir,
            has_header=self.headerCheck.isChecked(),
            config=config,
        )
        self._worker.progress.connect(self._on_progress)
        self._worker.log.connect(self._on_log)
        self._worker.finished.connect(self._on_finished)

        self.btnStart.setEnabled(False)
        self.btnStop.setEnabled(True)
        self.btnOpen.setEnabled(False)
        self.progressBar.setValue(0)
        self.logBox.clear()
        self._log("검색을 시작합니다...", "info")
        self._worker.start()

    def _stop_search(self):
        if self._worker:
            self._worker.stop()
        self.btnStop.setEnabled(False)

    def _on_progress(self, current: int, total: int):
        self.progressBar.setMaximum(total)
        self.progressBar.setValue(current)
        self.currentItemLabel.setText(f"처리 중: {current} / {total}")

    def _on_log(self, message: str, level: str):
        self._log(message, level)

    def _on_finished(self, path: str):
        self._result_path = path
        self.btnStart.setEnabled(True)
        self.btnStop.setEnabled(False)
        if path:
            self.btnOpen.setEnabled(True)
            self._log(f"✅ 조회가 완료되었어요 🍬 — {path}", "info")
            self.currentItemLabel.setText("조회 완료 🍬")
        else:
            self._log("⚠️ 완료되었으나 저장 파일이 없습니다.", "warn")
            self.currentItemLabel.setText("완료 (저장 실패)")

    def _open_result(self):
        if self._result_path and os.path.exists(self._result_path):
            os.startfile(self._result_path)

    def _log(self, message: str, level: str = "info"):
        colors = {"info": "#333333", "warn": "#E08000", "error": "#CC2244"}
        color = colors.get(level, "#333333")
        self.logBox.append(
            f'<span style="color:{color}; font-family:맑은 고딕; font-size:10pt;">'
            f'{message}</span>'
        )
        # 스크롤 맨 아래로
        sb = self.logBox.verticalScrollBar()
        sb.setValue(sb.maximum())
```

- [ ] **Step 2: 임포트 확인 (GUI 없이)**

```bash
cd D:/claude
python -c "import price_checker.gui; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd D:/claude
git add price_checker/gui.py
git commit -m "feat: add PySide6 jelly theme GUI with progress, log, file selection"
```

---

### Task 8: 샘플 파일 + README + build_exe.bat

**Files:**
- Create: `price_checker/sample/create_samples.py`
- Create: `price_checker/README.md`
- Create: `price_checker/build_exe.bat`

- [ ] **Step 1: create_samples.py 작성**

`price_checker/sample/create_samples.py`:
```python
"""샘플 입력 엑셀 생성 스크립트. python -m price_checker.sample.create_samples"""
import os
import pandas as pd

def create_sample_input():
    data = {
        "상품코드": ["A001", "A002", "A003", "A004", "A005"],
        "상품명": [
            "지오마 화이트머스크 600g",
            "지오마 피치코코 600g",
            "마르마르디 네롤리 핸드크림 50ml",
            "마르마르디 바닐라머스크 핸드크림 50ml",
            "라운드어라운드 그린티 수분크림 80ml",
        ],
    }
    out = os.path.join(os.path.dirname(__file__), "sample_input.xlsx")
    pd.DataFrame(data).to_excel(out, index=False)
    print(f"샘플 입력 파일 생성: {out}")

if __name__ == "__main__":
    create_sample_input()
```

- [ ] **Step 2: 샘플 파일 생성**

```bash
cd D:/claude
python -m price_checker.sample.create_samples
```
Expected: `샘플 입력 파일 생성: ...sample_input.xlsx`

- [ ] **Step 3: build_exe.bat 작성**

`price_checker/build_exe.bat`:
```bat
@echo off
chcp 65001 > nul
echo [Jelly Price Checker] PyInstaller 빌드 시작...

REM Playwright Chromium 설치 확인
python -m playwright install chromium

REM PyInstaller 빌드
pyinstaller --onefile ^
    --windowed ^
    --name JellyPriceChecker ^
    --add-data ".;." ^
    main.py

echo.
echo 빌드 완료! dist\JellyPriceChecker.exe 를 확인하세요.
echo.
echo [중요] exe 실행 전 Playwright 브라우저가 설치되어 있어야 합니다.
echo playwright install chromium
pause
```

- [ ] **Step 4: README.md 작성**

`price_checker/README.md`:
```markdown
# 🍬 Jelly Price Checker

상품명 기준으로 쿠팡·네이버 최저가를 자동 수집하는 Windows 데스크탑 프로그램.

---

## 설치 방법

```bash
pip install -r requirements.txt
playwright install chromium
```

## 실행 방법

```bash
python main.py
```

## 엑셀 입력 양식

| A열 (상품코드) | B열 (상품명) |
|---|---|
| A001 | 지오마 화이트머스크 600g |
| A002 | 마르마르디 네롤리 핸드크림 50ml |

- 1행은 헤더일 수도 있고 아닐 수도 있음 (GUI에서 선택)
- 빈 상품명 행은 자동으로 건너뜀
- 상품코드는 결과에 그대로 표시만 하며 검색에는 사용하지 않음

## 결과 엑셀 컬럼 설명

| 열 | 설명 |
|---|---|
| 상품코드 | 입력 상품코드 그대로 |
| 상품명 | 입력 상품명 그대로 |
| 쿠팡가 | 쿠팡 검색 최적 상품 판매가 |
| 쿠팡배송 | 쿠팡 배송비 (무료=0) |
| 쿠팡합계 | 쿠팡가+배송비 |
| 스스가 | 네이버 스마트스토어 판매가 |
| 스스배송 | 스마트스토어 배송비 |
| 스스합계 | 스스가+배송비 |
| 네최몰 | 네이버 최저가 판매처 |
| 네최가 | 해당 판매처 가격 |
| 네배송 | 해당 배송비 |
| 네합계 | 네최가+배송비 |
| 비고 | 확인불가/배송비확인불가/수동확인필요 등 |
| 쿠팡링크 (숨김) | 쿠팡 상품 링크 |
| 스스링크 (숨김) | 스마트스토어 링크 |
| 네최링크 (숨김) | 네이버 최저가 링크 |

## exe 빌드 방법

```bash
build_exe.bat
```

빌드 후 `dist/JellyPriceChecker.exe` 실행. exe 실행 PC에도 Playwright Chromium이 설치되어 있어야 합니다.

## 주의사항

- 쿠팡·네이버가 봇 탐지 또는 캡차를 표시하면 해당 상품은 "확인불가"로 처리됩니다.
- 캡차·로그인·차단은 우회하지 않습니다.
- 배송비가 화면에서 확인되지 않으면 배송비/합계는 빈칸이 됩니다.
- 사이트 HTML 구조가 바뀌면 `config.py`의 `SELECTORS`를 업데이트해야 합니다.
```

- [ ] **Step 5: Commit**

```bash
cd D:/claude
git add price_checker/sample/ price_checker/README.md price_checker/build_exe.bat
git commit -m "feat: add sample files, README, build script"
```

---

### Task 9: 통합 실행 검증

**Files:** (없음 — 기존 파일 검증)

- [ ] **Step 1: 전체 임포트 체인 확인**

```bash
cd D:/claude
python -c "
from price_checker.main import main, SearchWorker, build_result
from price_checker.gui import MainWindow
from price_checker.excel_io import read_products, save_results
from price_checker.matcher import pick_best
from price_checker.scrapers.coupang import CoupangScraper
from price_checker.scrapers.naver import NaverScraper
print('모든 모듈 임포트 OK')
"
```
Expected: `모든 모듈 임포트 OK`

- [ ] **Step 2: 단위 테스트 전체 실행**

```bash
cd D:/claude
python -m pytest tests/ -v
```
Expected: 모든 테스트 PASS

- [ ] **Step 3: 샘플 엑셀 읽기 확인**

```bash
cd D:/claude
python -c "
from price_checker.excel_io import read_products
products = read_products('price_checker/sample/sample_input.xlsx', has_header=True)
for p in products:
    print(p.code, p.name)
print(f'총 {len(products)}개')
"
```
Expected: 5개 상품 출력

- [ ] **Step 4: build_result 더미 검증**

```bash
cd D:/claude
python -c "
from price_checker.main import build_result
from price_checker.models import ProductInput, Candidate

p = ProductInput('A001', '지오마 화이트머스크 600g', 0)
cp = [Candidate('coupang','쿠팡','지오마 화이트머스크 600g 바디워시',18900,0,18900,'https://c.com',0.0,'')]
nv = [
    Candidate('naver_smartstore','ABC스토어','지오마 화이트머스크 600g',19000,3000,22000,'https://smartstore.naver.com/abc',0.0,''),
    Candidate('naver_shopping','올리브영','지오마 화이트머스크 600g',17900,0,17900,'https://oliveyoung.co.kr',0.0,''),
]
r = build_result(p, cp, nv)
assert r.coupang_price == 18900
assert r.smartstore_price == 19000
assert r.naver_lowest_mall == '올리브영'
assert r.naver_lowest_total == 17900
print('build_result 검증 OK')
print('네최몰:', r.naver_lowest_mall, '네합계:', r.naver_lowest_total)
"
```
Expected: `build_result 검증 OK` / `네최몰: 올리브영 네합계: 17900`

- [ ] **Step 5: GUI 실행 확인 (수동)**

```bash
cd D:/claude
python price_checker/main.py
```
Expected: "Jelly Price Checker" 윈도우가 열리고 젤리 테마 UI가 표시됨

- [ ] **Step 6: 최종 Commit**

```bash
cd D:/claude
git add -A
git commit -m "feat: complete Jelly Price Checker — all modules integrated"
```
