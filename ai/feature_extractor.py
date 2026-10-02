import re
from dataclasses import fields

from ai.provider import (
    AIResponseParseError,
    chat_json,
    image_content_part,
    is_mock_mode,
)
from ai.schemas import ItemFeatures


LOST_TEXT_SYSTEM_PROMPT = """\
너는 대학 분실물 매칭 서비스 Back2U의 정보 추출기다.
사용자가 쓴 분실물 설명에서 아래 필드를 추출해 JSON 객체 하나만 반환한다.
설명, 마크다운, 코드펜스 없이 JSON만 출력한다.

{
  "category": string | null,
  "color": string | null,
  "material": string | null,
  "brand": string | null,
  "location": string | null,
  "time_text": string | null,
  "ocr_text": string | null,
  "keywords": string[],
  "distinctive_features": string[]
}

규칙:
- 사용자가 말하지 않은 정보를 추측하거나 확정하지 않는다. 알 수 없으면 null 또는 빈 배열.
- category: 가능한 한 일반적인 한국어 물품명 (예: "카드지갑", "에어팟 케이스", "우산").
- color: 입력에 색상이 명시된 경우만, 짧은 한국어 색상명 (예: "검정", "흰색", "파랑").
- material, brand: 입력에 명시된 경우만. 물품 종류에서 유추하지 않는다.
- location: 입력에 장소가 있는 경우만, 원문 표현 그대로 (예: "공학관 1층").
- time_text: 원문의 시간 표현을 그대로 보존 (예: "오늘 오후 3시쯤").
- ocr_text: 텍스트 설명 단계이므로 물품에 적힌 글자가 명시적으로 언급된 경우만 그 글자, 아니면 null.
- keywords: 매칭에 도움이 되는 내용물/구성품/관련 단서 (예: "학생증", "체크카드").
- distinctive_features: 외형, 재질, 형태, 훼손, 스티커 등 식별에 도움이 되는 특징을 짧은 구로
  (예: "오른쪽 아래 작은 스크래치", "학생증 포함").
"""

_STR_FIELDS = ("category", "color", "material", "brand", "location", "time_text", "ocr_text")
_LIST_FIELDS = ("keywords", "distinctive_features")
_NULL_STRINGS = {"", "null", "none", "unknown", "알 수 없음", "없음"}


def _clean_str(value) -> str | None:
    if value is None:
        return None
    if not isinstance(value, (str, int, float)):
        return None
    text = str(value).strip()
    return None if text.lower() in _NULL_STRINGS else text


def _clean_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        text = _clean_str(item)
        if text and text not in cleaned:
            cleaned.append(text)
    return cleaned


def to_item_features(data: dict) -> ItemFeatures:
    """AI가 반환한 dict를 ItemFeatures 스키마에 맞춰 안전하게 변환한다."""

    if not isinstance(data, dict):
        raise AIResponseParseError("ItemFeatures로 변환할 데이터가 dict가 아닙니다.")

    known = {f.name for f in fields(ItemFeatures)}
    values = {}
    for name in _STR_FIELDS:
        if name in known:
            values[name] = _clean_str(data.get(name))
    for name in _LIST_FIELDS:
        if name in known:
            values[name] = _clean_list(data.get(name))

    return ItemFeatures(**values)


def extract_lost_features(text: str) -> ItemFeatures:
    """
    분실물 자연어 설명 -> ItemFeatures.
    AI_MOCK_MODE=true면 고정 Mock 결과를 반환한다 (실제 AI 결과 아님).
    """

    if is_mock_mode():
        return _mock_lost_features()

    if not text or not text.strip():
        raise ValueError("분실물 설명 텍스트가 비어 있습니다.")

    data = chat_json(LOST_TEXT_SYSTEM_PROMPT, text.strip())
    return to_item_features(data)


def _mock_lost_features() -> ItemFeatures:
    """해커톤 현장 API 장애 대비용 Mock. 실제 AI 분석 결과가 아니다."""

    return ItemFeatures(
        category="카드지갑",
        color="검정",
        material="가죽",
        brand=None,
        location="공학관 1층",
        time_text="오후 3시경",
        ocr_text=None,
        keywords=["학생증", "체크카드"],
        distinctive_features=[
            "카드 수납형",
            "검은색 가죽",
        ],
    )


FOUND_IMAGE_SYSTEM_PROMPT = """\
너는 대학 분실물 매칭 서비스 Back2U의 습득물 사진 분석기다.
사진 속 습득물을 분석해 JSON 객체 하나만 반환한다.
설명, 마크다운, 코드펜스 없이 JSON만 출력한다.

{
  "category": string | null,
  "color": string | null,
  "material": string | null,
  "brand": string | null,
  "location": null,
  "time_text": null,
  "ocr_text": string | null,
  "keywords": string[],
  "distinctive_features": string[]
}

규칙:
- 사진에서 실제로 보이는 것만 적는다. 확신이 없으면 null 또는 빈 배열.
- category: 사진의 주된 습득물의 일반적인 한국어 이름 (예: "카드지갑", "에어팟 케이스", "우산", "텀블러").
- color: 물건 자체의 주된 색상을 짧은 한국어로 (예: "검정", "흰색", "갈색"). 배경색은 제외. 애매하면 null.
- material: 시각적으로 어느 정도 판단 가능한 경우만 (예: "가죽", "플라스틱", "금속", "천"). 애매하면 null.
- brand: 사진에 로고나 브랜드 글자가 실제로 보일 때만. 모양만 보고 추측하지 않는다.
- location, time_text: 사진만으로는 알 수 없으므로 항상 null. 배경으로 추론하지 않는다.
- ocr_text: 사진에서 읽히는 글자 중 매칭에 도움이 되는 핵심 텍스트만 (예: "건국대학교", 브랜드명). 없으면 null.
- keywords: 물건 식별에 도움이 되는 짧은 단서 (예: "학생증", "교통카드", "열쇠고리").
- distinctive_features: 형태, 긁힘, 스티커, 색 조합, 케이스 모양 등 사진에서 확인 가능한 특징을 짧은 구로.

개인정보 보호 (매우 중요):
- 이름, 학번, 주민번호, 전화번호, 카드번호, 계좌번호, 주소, 이메일 등은 어떤 필드에도 그대로 쓰지 않는다.
- "건국대학교 학생증", "체크카드", "교통카드"처럼 비식별 정보로만 표현한다.
"""

# 숫자가 6자리 이상 이어지는 패턴(학번/전화/카드번호 등) 마스킹용 안전장치.
_LONG_NUMBER = re.compile(r"\d[\d\-\s.]{4,}\d")


def _mask_numbers(text: str | None) -> str | None:
    if not text:
        return text

    def mask(m: re.Match) -> str:
        digits = sum(c.isdigit() for c in m.group(0))
        return "***" if digits >= 6 else m.group(0)

    return _LONG_NUMBER.sub(mask, text)


def extract_found_features(image_path: str) -> ItemFeatures:
    """
    습득물 사진 -> ItemFeatures (Vision).
    AI_MOCK_MODE=true면 고정 Mock 결과를 반환한다 (실제 AI 결과 아님).
    실제 호출 실패 시 Mock으로 대체하지 않고 예외를 그대로 올린다.
    """

    if is_mock_mode():
        return _mock_found_features()

    image_part = image_content_part(image_path)
    data = chat_json(
        FOUND_IMAGE_SYSTEM_PROMPT,
        [
            {"type": "text", "text": "이 습득물 사진을 분석해 주세요."},
            image_part,
        ],
    )
    features = to_item_features(data)

    # 장소/시간은 사진이 아니라 습득자 입력에서 받는다.
    features.location = None
    features.time_text = None

    features.ocr_text = _mask_numbers(features.ocr_text)
    features.keywords = [_mask_numbers(k) for k in features.keywords]
    features.distinctive_features = [_mask_numbers(f) for f in features.distinctive_features]

    return features


def _mock_found_features() -> ItemFeatures:
    """해커톤 현장 API 장애 대비용 Mock. 실제 AI 분석 결과가 아니다."""

    return ItemFeatures(
        category="카드지갑",
        color="검정",
        material="가죽",
        brand=None,
        location="학생회관",
        time_text="오후 4시경",
        ocr_text="건국대학교",
        keywords=["학생증"],
        distinctive_features=[
            "카드 수납형",
            "검은색 가죽",
        ],
    )