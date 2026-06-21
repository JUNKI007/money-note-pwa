# Jelly Price Checker — 설계 문서

**날짜:** 2026-06-21  
**상태:** 확정

---

## 1. 목적

사용자가 엑셀 파일(A열=상품코드, B열=상품명)을 입력하면, 상품명 기준으로 쿠팡·네이버 쇼핑·네이버 스마트스토어 최저가를 크롤링하여 결과 엑셀을 생성하는 Windows 실행형 프로그램.

---

## 2. 기술 스택

| 항목 | 선택 |
|---|---|
| 언어 | Python 3.11+ |
| GUI | PySide6 + QSS (젤리 테마: 분홍/흰색/노랑) |
| 엑셀 처리 | pandas + openpyxl |
| 웹 크롤링 | Playwright (Chromium, async) |
| 빌드 | PyInstaller + build_exe.bat |
| API 키 | 없음 (공개 검색 결과만 사용) |

---

## 3. 파일 구조

```
price_checker/
├── main.py              진입점
├── gui.py               PySide6 GUI + QSS 스타일
├── excel_io.py          엑셀 읽기/쓰기
├── matcher.py           상품명 정규화, 용량/향 추출, 유사도
├── models.py            dataclass (ProductInput, Candidate, PriceResult)
├── config.py            기본 설정값, CSS selector 중앙 관리
├── scrapers/
│   ├── __init__.py
│   ├── base.py          BaseScraper 인터페이스 (추후 API 전환 대비)
│   ├── coupang.py       쿠팡 Playwright 크롤러
│   └── naver.py         네이버 쇼핑 Playwright 크롤러
├── requirements.txt
├── build_exe.bat
├── README.md
└── sample/
    ├── sample_input.xlsx
    └── create_samples.py
```

---

## 4. 데이터 모델

### ProductInput
```python
@dataclass
class ProductInput:
    code: str
    name: str
    row_index: int
```

### Candidate
```python
@dataclass
class Candidate:
    source: str           # "coupang" | "naver_smartstore" | "naver_lowest"
    mall_name: str
    title: str
    price: int | None
    shipping_fee: int | None
    total_price: int | None
    link: str
    matched_score: float
    note: str
```

### PriceResult
```python
@dataclass
class PriceResult:
    code: str
    name: str
    coupang_price: int | None
    coupang_shipping: int | None
    coupang_total: int | None
    smartstore_price: int | None
    smartstore_shipping: int | None
    smartstore_total: int | None
    naver_lowest_mall: str
    naver_lowest_price: int | None
    naver_lowest_shipping: int | None
    naver_lowest_total: int | None
    note: str
    coupang_link: str
    smartstore_link: str
    naver_lowest_link: str
```

---

## 5. 검색 및 매칭 로직

### 5.1 상품명 전처리 (matcher.py)
- 용량 토큰 추출: `(\d+(?:\.\d+)?)\s*(ml|l|g|kg|개|매|팩|입)` (대소문자 무시)
- 향/옵션 키워드 추출: 브랜드명 제거 후 나머지 명사 토큰
- 검색 키워드: 상품명 그대로 사용 (상품코드 절대 사용 안 함)

### 5.2 후보 필터링
1. **용량 일치 필수**: 입력 상품명에 용량 토큰이 있으면, 검색 결과에도 동일 용량 있어야 함
2. **세트/묶음 제외**: 입력 상품명에 없는데 결과에 `1+1|2개|세트|기획|리필|샘플|미니|여행용|묶음` 포함 시 제외
3. **향/옵션 확인**: 입력 상품명의 향/옵션 키워드가 결과에 포함되는지 확인 (점수 반영)

### 5.3 유사도 점수
- `difflib.SequenceMatcher` 기본 점수
- 용량 일치: +0.3
- 향/옵션 키워드 일치: +0.1 per keyword
- 최고 점수 후보 선택; 애매하면 비고에 "수동확인필요"

### 5.4 배송비 처리
- 무료배송 → 0
- 배송비 미확인 → 빈칸 + 비고 "배송비 확인불가"
- 합계 = 가격 + 배송비 (배송비 미확인 시 합계도 빈칸)
- 배송비 포함 최저가 비교: 가격+배송비 모두 확인된 후보끼리만 비교

---

## 6. 크롤링 전략

### 공통
- Playwright Chromium, async, 로그인 없음, API 키 없음
- 기본 headless=False (설정에서 변경 가능)
- 기본 딜레이 3초 (설정에서 변경 가능)
- 차단/캡차 감지 시 우회 없이 "확인불가" 처리

### 쿠팡 (scrapers/coupang.py)
- URL: `https://www.coupang.com/np/search?q={상품명}`
- 차단 감지: "로봇" 텍스트, CAPTCHA 키워드, HTTP 403/429
- 수집: 상품명, 가격, 배송비, 상품 링크
- selector는 config.py `SELECTORS["coupang"]` 에서 관리

### 네이버 (scrapers/naver.py)
- URL: `https://search.shopping.naver.com/search/all?query={상품명}`
- 스마트스토어 판별: URL에 `smartstore.naver.com` 포함 여부
- 차단 감지: 캡차 URL 패턴, 로그인 리다이렉트
- 수집: 상품명, 판매처명, 가격, 배송비, 링크
- 네최 선택: 매칭 통과 후보 중 (가격+배송비) 최솟값
- selector는 config.py `SELECTORS["naver"]` 에서 관리

---

## 7. GUI 구성 (gui.py)

### 테마
- 배경: `#FFF9FB`
- 메인 분홍: `#FFB6C9`
- 포인트 분홍: `#FF7FA3`
- 연노랑: `#FFE79A`
- 크림: `#FFF4D6`
- 텍스트: `#333333`
- 보조 텍스트: `#777777`
- 테두리: `#F3DDE5`

### 레이아웃 (900×650, 최소 크기 고정)
1. **상단 헤더**: "Jelly Price Checker" + 설명 문구, 연분홍 배경
2. **파일 선택 카드**: 입력 엑셀(분홍 버튼), 저장 위치(노랑 버튼), 첫 행 헤더 체크박스
3. **설정 카드**: 딜레이 초, headless 체크박스, 최대 후보 수, 쿠팡/네이버 사용 여부
4. **실행 영역**: 검색 시작(진한 분홍), 중지(연노랑), 진행률 바(분홍)
5. **현재 상품 표시 레이블**
6. **로그창**: 성공=진회색, 경고=주황, 오류=붉은 분홍
7. **결과 열기 버튼**: 완료 후 활성화

---

## 8. 출력 엑셀 (excel_io.py)

### 기본 열 (A~M, 13개)
| 열 | 이름 | 비고 |
|---|---|---|
| A | 상품코드 | |
| B | 상품명 | |
| C | 쿠팡가 | #,##0 |
| D | 쿠팡배송 | #,##0 |
| E | 쿠팡합계 | #,##0 |
| F | 스스가 | #,##0 |
| G | 스스배송 | #,##0 |
| H | 스스합계 | #,##0 |
| I | 네최몰 | 하이퍼링크 |
| J | 네최가 | #,##0 |
| K | 네배송 | #,##0 |
| L | 네합계 | #,##0 |
| M | 비고 | 넓게 |

### 숨김 열 (N~P)
| 열 | 이름 |
|---|---|
| N | 쿠팡링크 |
| O | 스스링크 |
| P | 네최링크 |

### 스타일
- 헤더 행: 볼드, 배경 `#FFB6C9`
- 가격 열(C~L): 배경 `#FFF4D6`, 숫자 형식 `#,##0`
- 오류/확인불가 행: 배경 `#FFE4EC`
- 필터 적용, 열 너비 자동 조정
- 가격 셀 또는 몰명 셀에 하이퍼링크

### 파일명
- 최종: `최저가조회결과_YYYYMMDD_HHMMSS.xlsx`
- 임시: `최저가조회결과_임시_YYYYMMDD_HHMMSS.xlsx` (10개마다)

---

## 9. 예외 처리 원칙

- 모든 크롤링 오류 → 해당 상품 비고에 기록 후 다음 상품 진행 (프로그램 종료 없음)
- 차단/캡차 → "쿠팡 확인불가" / "네이버 확인불가"
- 가격 파싱 실패 → 빈칸 + 비고 기록
- 배송비 미확인 → 빈칸 + "배송비 확인불가"
- 엑셀 저장 실패(파일 열림 등) → 파일명 변경 후 재시도, 실패 시 로그
- 인터넷 연결 오류 → 비고에 "연결 오류"

---

## 10. 빌드

```bat
pyinstaller --onefile --windowed --name JellyPriceChecker main.py
playwright install chromium
```

PyInstaller 빌드 시 Playwright 브라우저(~100MB) 별도 포함 필요. README에 안내.
