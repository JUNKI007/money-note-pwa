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
