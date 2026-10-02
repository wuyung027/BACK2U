from typing import Literal

from pydantic import BaseModel, Field

from ai.schemas import ItemFeatures


# ItemFeatures(dataclass)는 Pydantic v2가 그대로 검증/직렬화한다.


class LostItemRequest(BaseModel):
    raw_text: str = Field(
        ...,
        examples=[
            "오늘 오후 3시쯤 공학관 1층에서 검은색 카드지갑을 잃어버렸어요. "
            "안에는 학생증과 체크카드가 있습니다."
        ],
    )
    # (deprecated) 예전 분실자 단일 질문. 새 화면은 보내지 않고, 소유 확인 질문은 습득자가 FOUND 등록 때 만든다.
    # 선택: 둘 다 주거나 둘 다 생략. 정답은 해시만 저장되며 어떤 응답에도 포함되지 않는다.
    verification_question: str | None = Field(None, examples=["지갑 안쪽에 붙어 있는 스티커 문구는?"])
    verification_answer: str | None = Field(None, examples=["(본인만 아는 정답)"])


class ItemOut(BaseModel):
    id: str
    type: Literal["LOST", "FOUND"]
    raw_text: str | None = None
    image_filename: str | None = None
    # Supabase 모드에서 만료 시간이 있는 사진 Signed URL. memory 모드면 null.
    image_url: str | None = None
    features: ItemFeatures
    created_at: str
    verification_question: str | None = None
    verification_required: bool = False


class ItemResponse(BaseModel):
    success: bool = True
    item: ItemOut


class PublicItemOut(BaseModel):
    """
    공개 목록/상세용. DB row를 그대로 내보내지 않고 아래 필드만 담는다.
    소유 확인 질문·해시·salt, 원본 파일명, 분실 설명 원문(raw_text), 사진 속 글자(ocr_text)는 포함하지 않는다.
    """

    id: str
    type: Literal["LOST", "FOUND"]
    # 습득자가 직접 입력한 습득물명 (FOUND만)
    name: str | None = None
    image_url: str | None = None
    features: ItemFeatures
    created_at: str


class ItemListResponse(BaseModel):
    items: list[PublicItemOut]


class VerificationQuestionOut(BaseModel):
    """습득자가 만든 소유 확인 질문 (분실자에게는 질문만 보여준다)."""

    id: str
    question: str


class DeleteItemResponse(BaseModel):
    deleted: bool
    item_id: str


class MatchOut(BaseModel):
    item_id: str
    type: Literal["LOST", "FOUND"]
    match_score: float
    reasons: dict[str, float | None]
    features: ItemFeatures
    image_url: str | None = None
    # 이 후보 쌍(분실물 ↔ 습득물)의 분실물 쪽 소유 확인 정보
    verification_required: bool = False
    # (예전 데이터) 분실물에 등록된 단일 질문
    verification_question: str | None = None
    # 이 후보 쌍의 습득물에 습득자가 만든 질문 3개 (분실물 화면에서만). 정답 해시/salt는 없다.
    verification_questions: list[VerificationQuestionOut] | None = None
    verified: bool = False


class MatchResponse(BaseModel):
    source_item_id: str
    source_item: ItemOut
    matches: list[MatchOut]


class VerifyRequest(BaseModel):
    lost_item_id: str
    found_item_id: str
    answer: str
    # 습득자가 만든 질문 3개 중 분실자가 고른 질문 (예: "q2"). 예전 단일 질문 데이터는 생략.
    question_id: str | None = None


class VerifyResponse(BaseModel):
    verified: bool
    message: str
    # 소유 확인 성공 시에만 포함: 요청한 습득물의 보관 장소 (예전 습득물은 null)
    storage_location: str | None = None


class CatalogClaimChallenge(BaseModel):
    question: str
    choices: list[str]


class CatalogClaimRequest(BaseModel):
    answer: str = Field(..., min_length=1, max_length=100)


class CatalogClaimResponse(BaseModel):
    verified: bool
    pickup_location: str | None = None
