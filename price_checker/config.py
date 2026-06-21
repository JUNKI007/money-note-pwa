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
        "block_keywords": ["로봇이 아닙니다", "captcha", "CAPTCHA", "본인인증", "자동입력 방지"],
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
