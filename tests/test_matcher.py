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
