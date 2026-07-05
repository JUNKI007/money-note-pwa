import re
import difflib
from models import Candidate

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
    """소문자 통일"""
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
