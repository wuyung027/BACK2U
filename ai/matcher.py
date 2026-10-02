import math
import re
from difflib import SequenceMatcher

from ai.provider import embed_texts, is_mock_mode
from ai.schemas import ItemFeatures


WEIGHTS = {
    "category": 0.25,
    "features": 0.30,
    "color": 0.10,
    "ocr": 0.15,
    "location": 0.10,
    "time": 0.10,
}

# text-embedding-3-small 한국어 단문 기준 관측치:
# 무관한 물건 쌍 cos ≈ 0.1~0.25, 같은 물건 쌍 ≈ 0.25~0.5.
# 이 구간을 0~100으로 선형 변환한다 (구간 밖은 0/100으로 자름).
SEMANTIC_FLOOR = 0.10
SEMANTIC_CEIL = 0.50

COLOR_ALIASES = {
    "검정": ["검정", "검정색", "검은색", "검은", "블랙", "black"],
    "흰색": ["흰색", "흰", "하얀색", "하얀", "화이트", "white"],
    "회색": ["회색", "그레이", "gray", "grey"],
    "갈색": ["갈색", "브라운", "brown"],
    "빨강": ["빨강", "빨간색", "빨간", "레드", "red"],
    "파랑": ["파랑", "파란색", "파란", "블루", "blue"],
    "남색": ["남색", "네이비", "navy"],
    "초록": ["초록", "초록색", "녹색", "그린", "green"],
    "노랑": ["노랑", "노란색", "노란", "옐로", "yellow"],
    "분홍": ["분홍", "분홍색", "핑크", "pink"],
    "보라": ["보라", "보라색", "퍼플", "purple"],
    "베이지": ["베이지", "베이지색", "beige"],
    "은색": ["은색", "실버", "silver"],
    "금색": ["금색", "골드", "gold"],
}
_COLOR_LOOKUP = {alias: name for name, aliases in COLOR_ALIASES.items() for alias in aliases}


def normalize(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().lower()


def normalize_color(value: str | None) -> str:
    text = normalize(value).replace(" ", "")
    return _COLOR_LOOKUP.get(text, text)


def text_similarity(a: str, b: str) -> float:
    """문자열 유사도 0~100 (API 호출 없음). 한쪽이 다른 쪽을 포함하면 100."""

    a = normalize(a).replace(" ", "")
    b = normalize(b).replace(" ", "")
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 100.0
    return SequenceMatcher(None, a, b).ratio() * 100


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def cosine_to_score(cos: float) -> float:
    scaled = (cos - SEMANTIC_FLOOR) / (SEMANTIC_CEIL - SEMANTIC_FLOOR)
    return max(0.0, min(1.0, scaled)) * 100


def semantic_similarities(pairs: list[tuple[str, str]]) -> list[float]:
    """
    (a, b) 텍스트 쌍들의 의미 유사도 0~100.
    REAL: 임베딩 코사인 유사도 (한 번의 배치 요청 + 캐시).
    MOCK: API 호출 없이 문자열 유사도로 대체.
    """

    if not pairs:
        return []
    if is_mock_mode():
        return [text_similarity(a, b) for a, b in pairs]

    texts = list(dict.fromkeys(t for pair in pairs for t in pair))
    vectors = dict(zip(texts, embed_texts(texts)))
    return [cosine_to_score(cosine_similarity(vectors[a], vectors[b])) for a, b in pairs]


def feature_text(item: ItemFeatures) -> str:
    """
    특징 비교용 설명문. 분실자 특징("오른쪽 아래 스크래치")만으로는
    물건이 무엇인지 알 수 없으므로 category/material을 맥락으로 함께 넣는다.
    """

    details = [x for x in [item.material, *item.keywords, *item.distinctive_features] if x]
    head = f"{item.category}. " if item.category else ""
    return head + ", ".join(details)


# ---------------------------------------------------------------- location
# 물건은 습득 전에 옮겨질 수 있으므로 장소는 "일치하면 가산"하는 증거로만 쓴다.
# 다른 건물이면 0점 벌점 대신 None(비교 제외)으로 둔다.

_FLOOR = re.compile(r"(지하\s*\d+|(?<![a-z])b\s*\d+|\d+)\s*(?:층|f\b)")


def parse_location(text: str | None) -> tuple[str, str | None, str] | None:
    """'공학관 1층 로비' -> (building='공학관', floor='1층', compact='공학관1층로비')."""

    text = re.sub(r"\s+", " ", normalize(text))
    if not text:
        return None
    floor_match = _FLOOR.search(text)
    floor = None
    text_wo_floor = text
    if floor_match:
        number = re.sub(r"\s+", "", floor_match.group(1)).replace("b", "지하")
        floor = f"{number}층"  # "B1층", "1F" -> "지하1층", "1층"
        text_wo_floor = (text[: floor_match.start()] + " " + text[floor_match.end():]).strip()
        text = f"{text[: floor_match.start()]}{floor}{text[floor_match.end():]}"
    building = text_wo_floor.split(" ")[0] if text_wo_floor else ""
    return building, floor, text.replace(" ", "")


def location_similarity(a: str | None, b: str | None) -> float | None:
    pa, pb = parse_location(a), parse_location(b)
    if not pa or not pb:
        return None
    (building_a, floor_a, compact_a), (building_b, floor_b, compact_b) = pa, pb
    if compact_a == compact_b:
        return 100.0
    if compact_a in compact_b or compact_b in compact_a:
        return 90.0  # "공학관" ⊂ "공학관 1층"
    if building_a and building_a == building_b:
        if floor_a and floor_b and floor_a != floor_b:
            return 80.0  # 같은 건물, 다른 층
        return 85.0  # 같은 건물, 세부 위치만 다름
    return None


# -------------------------------------------------------------------- time
# 한국어 시간 표현(오늘/어제, 오전/오후, 3시 반, 15:30 등)을 regex로 파싱한다.
# 습득이 분실보다 얼마나 뒤인지로 점수를 매기고, 날짜가 불확실해 판단할 수 없으면 None.

_DAY_WORDS = {"그저께": -2, "그제": -2, "어제": -1, "오늘": 0}
_AM_WORDS = ("오전", "아침", "새벽")
_PM_WORDS = ("오후", "저녁", "밤", "낮")
_MERIDIEM = "|".join(_AM_WORDS + _PM_WORDS)
_CLOCK = re.compile(rf"(?:({_MERIDIEM})\s*)?(\d{{1,2}})\s*시(?:\s*(\d{{1,2}})\s*분|\s*(반))?")
_COLON = re.compile(rf"(?:({_MERIDIEM})\s*)?(\d{{1,2}}):(\d{{2}})")
# 표현 오차("3시쯤" vs "2시 반")를 감안해 이 정도 역전은 같은 시각으로 본다.
TIME_TOLERANCE_MINUTES = 60


def _hour_candidates(meridiem: str | None, hour: int) -> list[int]:
    if hour > 24:
        return []
    if meridiem in _AM_WORDS:
        return [0 if hour == 12 else hour]
    if meridiem == "낮":
        return [hour if hour >= 10 else hour + 12]
    if meridiem == "밤" and hour < 5:
        return [hour]
    if meridiem in _PM_WORDS:
        return [hour if hour >= 12 else hour + 12]
    if hour == 0 or hour >= 12:
        return [hour % 24]
    return [hour, hour + 12]  # 오전/오후 표시가 없으면 두 경우 모두 후보


def parse_time(text: str | None) -> tuple[int | None, list[int]] | None:
    """'오늘 오후 3시쯤' -> (day_offset=0, [900]) / 시각을 못 찾으면 None."""

    text = normalize(text)
    if not text:
        return None
    day = next((offset for word, offset in _DAY_WORDS.items() if word in text), None)

    match = _COLON.search(text)
    if match:
        meridiem, hour, minute = match.group(1), int(match.group(2)), int(match.group(3))
    else:
        match = _CLOCK.search(text)
        if not match:
            return None
        meridiem, hour = match.group(1), int(match.group(2))
        minute = 30 if match.group(4) else int(match.group(3) or 0)
    if minute >= 60:
        return None

    minutes = [h * 60 + minute for h in _hour_candidates(meridiem, hour)]
    return (day, minutes) if minutes else None


def _elapsed_score(minutes: int) -> float:
    if minutes <= 60:
        return 100.0
    if minutes <= 180:
        return 90.0
    if minutes <= 360:
        return 70.0
    if minutes <= 720:
        return 50.0
    return 30.0


def time_similarity(lost_text: str | None, found_text: str | None) -> float | None:
    lost_time, found_time = parse_time(lost_text), parse_time(found_text)
    if not lost_time or not found_time:
        return None
    (lost_day, lost_minutes), (found_day, found_minutes) = lost_time, found_time
    both_dated = lost_day is not None and found_day is not None
    # 날짜가 한쪽이라도 없으면 같은 날로 가정한다 (역전되면 다음 날일 수 있어 판단 보류).
    day_gap = (found_day - lost_day) * 24 * 60 if both_dated else 0

    best: float | None = None
    for lost_m in lost_minutes:
        for found_m in found_minutes:
            elapsed = day_gap + found_m - lost_m
            if elapsed < -TIME_TOLERANCE_MINUTES:
                score = 0.0 if both_dated else None
            else:
                score = _elapsed_score(max(elapsed, 0))
            if score is not None and (best is None or score > best):
                best = score
    return best


def calculate_match_score(
    lost: ItemFeatures,
    found: ItemFeatures,
) -> dict:
    """
    분실물/습득물 ItemFeatures 비교 -> {"match_score": 0~100, "reasons": {...}}.
    한쪽이라도 정보가 없는 항목은 reasons에 None으로 두고,
    남은 항목의 weight만 다시 정규화해 최종 점수를 계산한다.
    """

    reasons: dict[str, float | None] = {key: None for key in WEIGHTS}

    # 임베딩이 필요한 비교는 모아서 한 번에 계산한다.
    semantic_pairs: list[tuple[str, str]] = []
    semantic_slots: list[tuple[str, int]] = []

    # category: 분실 category vs 습득 category/keywords 중 최댓값.
    # (Vision은 "무선 이어폰" + keywords "충전 케이스"처럼 물건명을 나눠 적는 경우가 많다.)
    if lost.category and found.category:
        candidates = list(dict.fromkeys([found.category, *found.keywords]))
        for candidate in candidates:
            semantic_pairs.append((lost.category, candidate))
            semantic_slots.append(("category", len(semantic_pairs) - 1))

    # features: 양쪽 모두 keywords/특징/재질 중 하나라도 있을 때만.
    if (lost.keywords or lost.distinctive_features or lost.material) and (
        found.keywords or found.distinctive_features or found.material
    ):
        semantic_pairs.append((feature_text(lost), feature_text(found)))
        semantic_slots.append(("features", len(semantic_pairs) - 1))

    scores = semantic_similarities(semantic_pairs)
    for key, index in semantic_slots:
        current = reasons[key]
        reasons[key] = scores[index] if current is None else max(current, scores[index])

    if lost.color and found.color:
        reasons["color"] = 100.0 if normalize_color(lost.color) == normalize_color(found.color) else 0.0

    if lost.ocr_text and found.ocr_text:
        reasons["ocr"] = text_similarity(lost.ocr_text, found.ocr_text)

    reasons["location"] = location_similarity(lost.location, found.location)
    reasons["time"] = time_similarity(lost.time_text, found.time_text)

    available = {key: value for key, value in reasons.items() if value is not None}
    total_weight = sum(WEIGHTS[key] for key in available)
    final_score = (
        sum(value * WEIGHTS[key] for key, value in available.items()) / total_weight
        if total_weight
        else 0.0
    )

    return {
        "match_score": round(final_score, 1),
        "reasons": {
            key: (round(value, 1) if value is not None else None)
            for key, value in reasons.items()
        },
    }
