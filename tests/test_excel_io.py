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
