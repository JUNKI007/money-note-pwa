from dataclasses import dataclass


@dataclass
class ProductInput:
    code: str
    name: str
    row_index: int


@dataclass
class Candidate:
    source: str
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
    naver_lowest_mall: str = ""
    naver_lowest_price: int | None = None
    naver_lowest_shipping: int | None = None
    naver_lowest_total: int | None = None
    note: str = ""
