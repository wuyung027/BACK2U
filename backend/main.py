"""
Back2U API (FastAPI)

실행: uvicorn backend.main:app --reload --port 8000
문서: http://localhost:8000/docs
"""

import json
import logging
import os
import tempfile
from dataclasses import asdict
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from ai.feature_extractor import _mask_numbers, extract_found_features, extract_lost_features
from ai.matcher import match_candidate
from ai.provider import (
    IMAGE_MIME_TYPES,
    MAX_IMAGE_BYTES,
    AIConfigError,
    AIProviderError,
    AIResponseParseError,
    is_mock_mode,
)
from backend import store
from backend.catalog_claims import check_answer, get_claim
from backend.schemas import (
    CatalogClaimChallenge,
    CatalogClaimRequest,
    CatalogClaimResponse,
    DeleteItemResponse,
    ItemListResponse,
    ItemResponse,
    LostItemRequest,
    MatchResponse,
    PublicItemOut,
    VerifyRequest,
    VerifyResponse,
)
from backend.verification import (
    build_challenges,
    find_challenge,
    hash_answer,
    public_questions,
    validate_verification,
    verify_answer,
)


logger = logging.getLogger("back2u")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Back2U API", version="0.1.0")

# 콤마로 구분해 Vercel 등 추가 Origin을 넣을 수 있다.
CORS_ORIGINS = [
    origin.strip()
    for origin in (
        os.getenv("CORS_ORIGINS") or "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    # Next.js가 3000/3001을 사용 중이면 다음 포트로 올라가므로 로컬 개발 포트를 허용한다.
    allow_origin_regex=r"^http://(?:localhost|127\.0\.0\.1):300[0-9]$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# AI 오류는 내부 메시지를 로그에만 남기고, 응답에는 일반화된 메시지만 준다.
@app.exception_handler(AIConfigError)
async def handle_ai_config_error(request: Request, exc: AIConfigError):
    logger.error("AI config error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=503, content={"detail": "AI 서비스 설정이 올바르지 않습니다."})


@app.exception_handler(AIProviderError)
async def handle_ai_provider_error(request: Request, exc: AIProviderError):
    logger.error("AI provider error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=502, content={"detail": "AI 서비스 호출에 실패했습니다. 잠시 후 다시 시도해 주세요."})


@app.exception_handler(AIResponseParseError)
async def handle_ai_parse_error(request: Request, exc: AIResponseParseError):
    logger.error("AI response parse error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=502, content={"detail": "AI 분석 결과를 해석하지 못했습니다. 다시 시도해 주세요."})


@app.exception_handler(store.PersistenceError)
async def handle_persistence_error(request: Request, exc: store.PersistenceError):
    logger.error("Persistence error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=503, content={"detail": "저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."})


# 응답에 내보낼 item 필드 화이트리스트. 정답 해시/salt 등은 절대 포함하지 않는다.
def _item_out(item: dict, image_url: str | None = None) -> dict:
    return {
        "id": item["id"],
        "type": item["type"],
        "raw_text": item["raw_text"],
        "image_filename": item["image_filename"],
        "image_url": image_url,
        "features": item["features"],
        "created_at": item["created_at"],
        "verification_question": item.get("verification_question"),
        "verification_required": _has_verification(item),
    }


def _has_verification(item: dict) -> bool:
    return bool(
        item.get("verification_question")
        and item.get("verification_answer_hash")
        and item.get("verification_salt")
    )


def _with_image_url(item: dict) -> dict:
    urls = store.signed_image_urls([item])
    return _item_out(item, urls.get(item["id"]))


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Back2U API",
        "ai_mode": "MOCK" if is_mock_mode() else "REAL",
        "persistence": store.PERSISTENCE_MODE,
    }


@app.post("/api/v1/items/lost", response_model=ItemResponse, tags=["items"])
def create_lost_item(body: LostItemRequest):
    raw_text = body.raw_text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="분실물 설명(raw_text)이 비어 있습니다.")

    try:
        verification = validate_verification(body.verification_question, body.verification_answer)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    stored_verification = None
    if verification:
        question, answer = verification
        answer_hash, salt = hash_answer(answer)
        stored_verification = (question, answer_hash, salt)

    features = extract_lost_features(raw_text)
    item = store.add_item("LOST", features, raw_text=raw_text, verification=stored_verification)
    return {"success": True, "item": _item_out(item)}


ITEM_NAME_MAX_LENGTH = 50
STORAGE_LOCATION_MAX_LENGTH = 200

_IMAGE_SIGNATURES = {
    ".jpg": lambda b: b.startswith(b"\xff\xd8\xff"),
    ".jpeg": lambda b: b.startswith(b"\xff\xd8\xff"),
    ".png": lambda b: b.startswith(b"\x89PNG\r\n\x1a\n"),
    ".webp": lambda b: b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}


@app.post("/api/v1/items/found", response_model=ItemResponse, tags=["items"])
def create_found_item(
    image: UploadFile = File(..., description="습득물 사진 (jpg/jpeg/png/webp)"),
    location: str | None = Form(None, description="습득 장소 (예: 학생회관 1층)"),
    time_text: str | None = Form(None, description="습득 시간 (예: 오후 4시경)"),
    item_name: str | None = Form(None, description="습득물명 (예: 검은색 카드지갑)"),
    storage_location: str | None = Form(
        None, description="현재 보관 장소 (예: 학생회관 1층 안내데스크). 소유 확인 성공 응답에서만 공개된다."
    ),
    verification_questions: str | None = Form(
        None,
        description='습득자가 만든 소유 확인 질문 3개 JSON: [{"question": "...", "answer": "..."}, ...]. 정답은 해시만 저장된다.',
    ),
):
    name = (item_name or "").strip()
    if len(name) > ITEM_NAME_MAX_LENGTH:
        raise HTTPException(status_code=400, detail=f"습득물명은 {ITEM_NAME_MAX_LENGTH}자 이하로 입력해 주세요.")
    storage = (storage_location or "").strip()
    if len(storage) > STORAGE_LOCATION_MAX_LENGTH:
        raise HTTPException(
            status_code=400, detail=f"보관 장소는 {STORAGE_LOCATION_MAX_LENGTH}자 이하로 입력해 주세요."
        )
    # 질문/정답은 AI·features·매칭에 쓰지 않는다. 정답은 여기서 바로 해시로 바꾸고 평문은 버린다.
    challenges = None
    if verification_questions and verification_questions.strip():
        try:
            challenges = build_challenges(json.loads(verification_questions))
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail="소유 확인 질문 형식이 올바르지 않습니다.") from e
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    suffix = Path(image.filename or "").suffix.lower()
    if suffix not in IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 이미지 형식입니다. 허용: {', '.join(IMAGE_MIME_TYPES)}",
        )

    data = image.file.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="이미지 파일이 비어 있습니다.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="이미지가 너무 큽니다 (최대 20MB).")
    if not _IMAGE_SIGNATURES[suffix](data):
        raise HTTPException(status_code=400, detail="이미지 내용이 확장자와 일치하지 않습니다.")

    # 저장소 밖 시스템 임시 폴더에 잠시 저장 후 분석이 끝나면 삭제한다.
    with tempfile.NamedTemporaryFile(prefix="back2u_", suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        temp_path = tmp.name

    try:
        features = extract_found_features(temp_path)
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            logger.warning("Failed to delete temp image: %s", temp_path)

    # 발견 장소/시간은 사진이 아니라 습득자 입력을 사용한다 (매칭용).
    # 보관 장소(storage_location)는 features·AI·매칭에 넣지 않고 따로 저장한다.
    if location and location.strip():
        features.location = location.strip()
    if time_text and time_text.strip():
        features.time_text = time_text.strip()
    # 습득자가 적은 이름은 Vision 결과를 덮지 않고 keywords 맨 앞에 더해 물품 종류 비교 후보로 쓴다.
    # 사진 OCR과 같은 기준으로 6자리 이상 숫자는 가린다.
    if name:
        name = _mask_numbers(name)
        features.keywords = [name, *[k for k in features.keywords if k != name]]

    item = store.add_item(
        "FOUND",
        features,
        raw_text=name or None,
        image_filename=image.filename,
        image=(data, IMAGE_MIME_TYPES[suffix], suffix),
        storage_location=storage or None,
        verification_challenges=challenges,
    )
    return {"success": True, "item": _with_image_url(item)}


LIST_DEFAULT_LIMIT = 50
LIST_MAX_LIMIT = 100


def _public_item(item: dict, image_url: str | None = None) -> PublicItemOut:
    # 허용한 필드만 골라 담는다 (DB row 통째 반환 금지). features는 dict로 넘겨 형식이 다른 옛 row를 여기서 걸러낸다.
    features = asdict(item["features"])
    features["ocr_text"] = None
    return PublicItemOut.model_validate(
        {
            "id": item["id"],
            "type": item["type"],
            "name": item["raw_text"] if item["type"] == "FOUND" else None,
            "image_url": image_url,
            "features": features,
            "created_at": item["created_at"],
        }
    )


@app.get("/api/v1/items", response_model=ItemListResponse, tags=["items"])
def list_public_items(
    type: Literal["LOST", "FOUND"] | None = Query(None, description="생략하면 전체"),
    limit: int = Query(LIST_DEFAULT_LIMIT, ge=1, le=LIST_MAX_LIMIT),
):
    """등록된 물건 공개 목록 (최신 등록순)."""

    items = store.list_items(type, limit)
    image_urls = store.signed_image_urls(items)
    public = []
    for item in items:
        try:
            public.append(_public_item(item, image_urls.get(item["id"])))
        except ValidationError:
            # 형식이 맞지 않는 옛 데이터 한 건 때문에 목록 전체가 실패하지 않게 건너뛴다.
            logger.warning("Skipping item with unexpected features shape: %s", item["id"])
    return {"items": public}


@app.get("/api/v1/items/{item_id}", response_model=PublicItemOut, tags=["items"])
def get_public_item(item_id: str):
    item = store.get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="해당 item을 찾을 수 없습니다.")
    try:
        return _public_item(item, store.signed_image_urls([item]).get(item["id"]))
    except ValidationError as e:
        raise HTTPException(status_code=404, detail="해당 item을 찾을 수 없습니다.") from e


@app.delete("/api/v1/items/{item_id}", response_model=DeleteItemResponse, tags=["items"])
def delete_item(item_id: str):
    if not store.delete_item(item_id):
        raise HTTPException(status_code=404, detail="해당 item을 찾을 수 없습니다.")
    return {"deleted": True, "item_id": item_id}


@app.get("/api/v1/items/match/{item_id}", response_model=MatchResponse, tags=["items"])
def match_item(item_id: str):
    source = store.get_item(item_id)
    if source is None:
        raise HTTPException(status_code=404, detail="해당 item을 찾을 수 없습니다.")

    target_type = "FOUND" if source["type"] == "LOST" else "LOST"

    matches = []
    candidates = store.list_items(target_type)
    image_urls = store.signed_image_urls([source, *candidates])

    for candidate in candidates:
        lost, found = (source, candidate) if source["type"] == "LOST" else (candidate, source)
        # 물품 종류가 명백히 다르거나 일치도가 너무 낮으면 후보에서 뺀다 (후보가 0개일 수 있다).
        result = match_candidate(lost["features"], found["features"])
        if result is None:
            continue
        # 습득자가 만든 질문(질문 문장만)은 분실물 화면에서만 내려준다. 습득자 화면에서는 소유 확인을 하지 않는다.
        questions = public_questions(found.get("verification_challenges")) if source["type"] == "LOST" else []

        matches.append(
            {
                "item_id": candidate["id"],
                "type": candidate["type"],
                "match_score": result["match_score"],
                "reasons": result["reasons"],
                "features": candidate["features"],
                "image_url": image_urls.get(candidate["id"]),
                "verification_required": bool(found.get("verification_challenges")) or _has_verification(lost),
                "verification_question": lost.get("verification_question"),
                "verification_questions": questions or None,
                # 이 습득물로 확인된 경우에만 true (다른 습득물로 확인된 기록은 무시)
                "verified": lost.get("verified_found_item_id") == found["id"],
            }
        )

    matches.sort(key=lambda m: m["match_score"], reverse=True)
    return {
        "source_item_id": item_id,
        "source_item": _item_out(source, image_urls.get(source["id"])),
        "matches": matches,
    }


# 실패 응답에는 storage_location 필드 자체를 넣지 않는다 (설정한 필드만 직렬화).
@app.post("/api/v1/items/verify", response_model=VerifyResponse, response_model_exclude_unset=True, tags=["items"])
def verify_ownership(body: VerifyRequest):
    if not body.answer.strip():
        raise HTTPException(status_code=400, detail="소유 확인 정답을 입력해 주세요.")

    lost = store.get_item(body.lost_item_id)
    found = store.get_item(body.found_item_id)
    if lost is None or found is None:
        raise HTTPException(status_code=404, detail="해당 item을 찾을 수 없습니다.")
    if lost["type"] != "LOST" or found["type"] != "FOUND":
        raise HTTPException(status_code=400, detail="분실물과 습득물 조합으로만 확인할 수 있습니다.")
    challenges = found.get("verification_challenges")
    if challenges:
        # 습득자가 만든 질문 3개 중 분실자가 고른 질문 하나만 검사한다 (이 습득물의 질문만).
        if not body.question_id:
            raise HTTPException(status_code=400, detail="확인할 질문을 선택해 주세요.")
        challenge = find_challenge(challenges, body.question_id)
        if challenge is None:
            raise HTTPException(status_code=400, detail="선택한 질문을 찾을 수 없습니다.")
        matched = verify_answer(body.answer, challenge.get("answer_hash"), challenge.get("salt"))
    elif _has_verification(lost):
        # 예전 데이터: 분실물에 등록된 단일 질문 (새 등록에서는 더 이상 만들지 않는다)
        matched = verify_answer(body.answer, lost["verification_answer_hash"], lost["verification_salt"])
    else:
        raise HTTPException(status_code=400, detail="등록된 소유 확인 질문이 없습니다.")

    if not matched:
        return {"verified": False, "message": "소유 확인 정보가 일치하지 않습니다."}

    store.set_verified(lost["id"], found["id"])
    # 이 요청의 습득물(found_item_id) 보관 장소만 돌려준다. 매칭/목록/상세 응답에는 없다.
    return {
        "verified": True,
        "message": "소유 확인이 완료되었습니다.",
        "storage_location": found.get("storage_location"),
    }


@app.get("/api/v1/catalog-claims/{item_id}", response_model=CatalogClaimChallenge, tags=["catalog claims"])
def get_catalog_claim(item_id: str):
    claim = get_claim(item_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="소유 확인 문제가 준비되지 않은 습득물입니다.")
    return {"question": claim.question, "choices": list(claim.choices)}


@app.post("/api/v1/catalog-claims/{item_id}/verify", response_model=CatalogClaimResponse, tags=["catalog claims"])
def verify_catalog_claim(item_id: str, body: CatalogClaimRequest):
    claim = get_claim(item_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="소유 확인 문제가 준비되지 않은 습득물입니다.")
    if body.answer not in claim.choices:
        raise HTTPException(status_code=400, detail="제시된 선택지 중 하나를 골라주세요.")
    if not check_answer(claim, body.answer):
        return {"verified": False}
    return {"verified": True, "pickup_location": claim.pickup_location}
