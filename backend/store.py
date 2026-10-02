"""
items 저장소.

PERSISTENCE_MODE=memory   (기본) 프로세스 메모리. 서버 재시작 시 데이터가 사라진다.
PERSISTENCE_MODE=supabase Supabase DB(items 테이블) + Storage(private bucket).

Supabase 접근은 Backend 전용 Service Role(또는 secret) 키로만 하며,
사진은 짧은 만료 시간의 Signed URL로만 내보낸다.
"""

import logging
import os
import threading
import uuid
from dataclasses import asdict, fields
from datetime import datetime, timezone

import httpx

import ai.provider  # noqa: F401  (.env 로딩)
from ai.schemas import ItemFeatures


logger = logging.getLogger("back2u.store")

PERSISTENCE_MODE = (os.getenv("PERSISTENCE_MODE") or "memory").strip().lower()
SIGNED_URL_EXPIRES_SECONDS = 60 * 60


class PersistenceError(RuntimeError):
    """DB/Storage 호출 실패."""


# ---------------------------------------------------------------- memory

_items: dict[str, dict] = {}
_lock = threading.Lock()


def _memory_add(item: dict) -> dict:
    with _lock:
        _items[item["id"]] = item
    return item


def _memory_get(item_id: str) -> dict | None:
    with _lock:
        return _items.get(item_id)


def _memory_delete(item_id: str) -> bool:
    with _lock:
        return _items.pop(item_id, None) is not None


def _memory_list(item_type: str | None, limit: int | None) -> list[dict]:
    with _lock:
        # 등록 순서를 뒤집은 뒤 created_at으로 안정 정렬 -> 시각이 같아도 나중에 등록한 것이 앞에 온다.
        items = [item for item in reversed(_items.values()) if item_type is None or item["type"] == item_type]
    items.sort(key=lambda item: item["created_at"], reverse=True)
    return items[:limit] if limit else items


# -------------------------------------------------------------- supabase

_SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
_SUPABASE_KEY = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
_BUCKET = (os.getenv("SUPABASE_STORAGE_BUCKET") or "found-items").strip()
_TIMEOUT = 20.0
_client: httpx.Client | None = None

if PERSISTENCE_MODE not in {"memory", "supabase"}:
    raise RuntimeError(f"PERSISTENCE_MODE는 memory 또는 supabase여야 합니다 (현재: {PERSISTENCE_MODE!r}).")

if PERSISTENCE_MODE == "supabase":
    _missing = [name for name, value in (("SUPABASE_URL", _SUPABASE_URL), ("SUPABASE_SERVICE_ROLE_KEY", _SUPABASE_KEY)) if not value]
    if _missing:
        raise RuntimeError(
            f"PERSISTENCE_MODE=supabase인데 설정이 없습니다: {', '.join(_missing)}. "
            ".env에 값을 넣거나 PERSISTENCE_MODE=memory로 실행하세요."
        )
    if "supabase.com/dashboard" in _SUPABASE_URL or not _SUPABASE_URL.startswith("https://"):
        raise RuntimeError(
            "SUPABASE_URL은 대시보드 주소가 아니라 API 주소여야 합니다 "
            "(Project Settings > API의 Project URL, 예: https://<project-ref>.supabase.co)."
        )


def _http() -> httpx.Client:
    global _client
    if _client is None:
        headers = {"apikey": _SUPABASE_KEY}
        # 예전 JWT 형식 service_role 키만 Bearer로 함께 보낸다. (sb_secret_ 키는 apikey 헤더만 허용)
        if _SUPABASE_KEY.startswith("eyJ"):
            headers["Authorization"] = f"Bearer {_SUPABASE_KEY}"
        _client = httpx.Client(base_url=_SUPABASE_URL, headers=headers, timeout=_TIMEOUT)
    return _client


def _call(method: str, path: str, **kwargs) -> httpx.Response:
    try:
        response = _http().request(method, path, **kwargs)
    except httpx.HTTPError as e:
        raise PersistenceError(f"Supabase 연결 실패 ({method} {path.split('?')[0]}): {type(e).__name__}") from e
    if response.status_code >= 400:
        raise PersistenceError(
            f"Supabase 오류 ({method} {path.split('?')[0]} -> HTTP {response.status_code}): {response.text[:200]}"
        )
    return response


def _features_from_json(data) -> ItemFeatures:
    known = {f.name for f in fields(ItemFeatures)}
    return ItemFeatures(**{k: v for k, v in (data or {}).items() if k in known})


def _row_to_item(row: dict) -> dict:
    return {
        "id": row["id"],
        "type": row["type"],
        "raw_text": row.get("raw_text"),
        "features": _features_from_json(row.get("features")),
        "image_filename": row.get("original_filename"),
        "image_path": row.get("image_path"),
        "created_at": row["created_at"],
        # 002 migration 이전 row에는 아래 컬럼이 없으므로 get으로 읽는다.
        "verification_question": row.get("verification_question"),
        "verification_answer_hash": row.get("verification_answer_hash"),
        "verification_salt": row.get("verification_salt"),
        "verified_found_item_id": row.get("verified_found_item_id"),
        "verified_at": row.get("verified_at"),
        # 003 migration 이전 row에는 없다. 소유 확인 성공 응답에서만 꺼내 쓴다.
        "storage_location": row.get("storage_location"),
        # 004 migration: 습득자가 만든 소유 확인 질문 3개 (질문 + 정답 해시/salt). 응답에는 질문만 골라 내보낸다.
        "verification_challenges": row.get("verification_challenges"),
    }


def _upload_image(path: str, data: bytes, content_type: str) -> None:
    _call(
        "POST",
        f"/storage/v1/object/{_BUCKET}/{path}",
        content=data,
        headers={"content-type": content_type, "x-upsert": "false"},
    )


def _delete_image(path: str) -> None:
    try:
        _call("DELETE", f"/storage/v1/object/{_BUCKET}", json={"prefixes": [path]})
    except PersistenceError:
        logger.exception("Failed to clean up orphan image: %s", path)


def _supabase_add(item: dict, image: tuple[bytes, str, str] | None) -> dict:
    image_path = None
    if image is not None:
        data, content_type, suffix = image
        # 원래 파일명은 경로에 쓰지 않는다.
        image_path = f"{item['id']}/{uuid.uuid4().hex}{suffix}"
        try:
            _upload_image(image_path, data, content_type)
        except PersistenceError as e:
            # 사용자에게는 같은 503이지만, 로그에서는 어느 단계가 실패했는지 바로 구분되게 한다.
            raise PersistenceError(f"[storage-upload] {e}") from e

    row = {
        "id": item["id"],
        "type": item["type"],
        "raw_text": item["raw_text"],
        "features": asdict(item["features"]),
        "image_path": image_path,
        "original_filename": item["image_filename"],
    }
    # 소유 확인 정보가 있을 때만 002 migration 컬럼을 보낸다 (migration 전에도 기존 등록 유지).
    if item["verification_question"]:
        for key in ("verification_question", "verification_answer_hash", "verification_salt"):
            row[key] = item[key]
    # 보관 장소도 값이 있을 때만 보낸다 (003 migration 전에도 기존 등록 경로는 그대로 동작).
    if item["storage_location"]:
        row["storage_location"] = item["storage_location"]
    if item["verification_challenges"]:
        row["verification_challenges"] = item["verification_challenges"]
    try:
        response = _call("POST", "/rest/v1/items", json=row, headers={"Prefer": "return=representation"})
    except PersistenceError as e:
        # DB 저장이 실패하면 방금 올린 사진을 지워 orphan object를 남기지 않는다.
        if image_path:
            _delete_image(image_path)
        hint = ""
        if "PGRST204" in str(e) or "42703" in str(e):
            hint = " -> items 테이블에 없는 컬럼입니다. supabase/migrations의 SQL이 모두 적용됐는지 확인하세요."
        raise PersistenceError(f"[db-insert] {e}{hint}") from e
    return _row_to_item(response.json()[0])


def _supabase_get(item_id: str) -> dict | None:
    try:
        uuid.UUID(item_id)
    except ValueError:
        return None
    rows = _call("GET", f"/rest/v1/items?id=eq.{item_id}&select=*").json()
    return _row_to_item(rows[0]) if rows else None


def _supabase_list(item_type: str | None, limit: int | None) -> list[dict]:
    query = "select=*&order=created_at.desc"
    if item_type:
        query = f"type=eq.{item_type}&{query}"
    if limit:
        query += f"&limit={int(limit)}"
    rows = _call("GET", f"/rest/v1/items?{query}").json()
    return [_row_to_item(row) for row in rows]


def _supabase_delete(item_id: str) -> bool:
    item = _supabase_get(item_id)
    if item is None:
        return False

    image_path = item.get("image_path") if item["type"] == "FOUND" else None
    if image_path:
        try:
            # 서명 URL이 아닌 DB의 원본 object path를 사용한다.
            _call("DELETE", f"/storage/v1/object/{_BUCKET}", json={"prefixes": [image_path]})
        except PersistenceError as exc:
            # 사진이 이미 지워진 경우에도 게시글은 삭제할 수 있다.
            if "HTTP 404" not in str(exc):
                raise
            logger.info("Storage object already missing: %s", image_path)

    response = _call(
        "DELETE",
        f"/rest/v1/items?id=eq.{item_id}",
        headers={"Prefer": "return=representation"},
    )
    return bool(response.json())


def _supabase_signed_urls(paths: list[str]) -> dict[str, str]:
    if not paths:
        return {}
    try:
        results = _call(
            "POST",
            f"/storage/v1/object/sign/{_BUCKET}",
            json={"expiresIn": SIGNED_URL_EXPIRES_SECONDS, "paths": paths},
        ).json()
    except PersistenceError:
        # 사진 URL 실패로 매칭 결과 전체를 막지 않는다.
        logger.exception("Failed to create signed URLs")
        return {}
    return {
        r["path"]: f"{_SUPABASE_URL}/storage/v1{r['signedURL']}"
        for r in results
        if r.get("signedURL") and not r.get("error")
    }


# ------------------------------------------------------------ public API


def add_item(
    item_type: str,
    features: ItemFeatures,
    raw_text: str | None = None,
    image_filename: str | None = None,
    image: tuple[bytes, str, str] | None = None,
    verification: tuple[str, str, str] | None = None,
    storage_location: str | None = None,
    verification_challenges: list[dict] | None = None,
) -> dict:
    """
    image = (bytes, content_type, suffix). memory 모드에서는 이미지를 저장하지 않는다.
    verification = (question, answer_hash, salt). 정답 평문은 받지 않는다.
    storage_location = 습득물 보관 장소. features와 분리해 저장하며 소유 확인 성공 응답에서만 내보낸다.
    verification_challenges = 습득자가 만든 질문 3개 [{id, question, answer_hash, salt}]. 정답 평문은 받지 않는다.
    """

    question, answer_hash, salt = verification or (None, None, None)

    item = {
        "id": str(uuid.uuid4()),
        "type": item_type,
        "raw_text": raw_text,
        "features": features,
        "image_filename": image_filename,
        "image_path": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "verification_question": question,
        "verification_answer_hash": answer_hash,
        "verification_salt": salt,
        "verified_found_item_id": None,
        "verified_at": None,
        "storage_location": storage_location,
        "verification_challenges": verification_challenges,
    }
    if PERSISTENCE_MODE == "supabase":
        return _supabase_add(item, image)
    return _memory_add(item)


def get_item(item_id: str) -> dict | None:
    if PERSISTENCE_MODE == "supabase":
        return _supabase_get(item_id)
    return _memory_get(item_id)


def list_items(item_type: str | None = None, limit: int | None = None) -> list[dict]:
    """최신 등록순(created_at desc). item_type=None이면 LOST/FOUND 전체."""

    if item_type not in (None, "LOST", "FOUND"):
        raise ValueError(f"item_type은 LOST 또는 FOUND여야 합니다: {item_type!r}")
    if PERSISTENCE_MODE == "supabase":
        return _supabase_list(item_type, limit)
    return _memory_list(item_type, limit)


def delete_item(item_id: str) -> bool:
    """한 물건을 삭제한다. Supabase에서는 사진을 먼저 지우고 DB 행을 지운다."""

    if PERSISTENCE_MODE == "supabase":
        return _supabase_delete(item_id)
    return _memory_delete(item_id)


def set_verified(lost_item_id: str, found_item_id: str) -> None:
    """소유 확인 성공 기록. (supabase 모드는 002 migration 필요)"""

    verified_at = datetime.now(timezone.utc).isoformat()
    if PERSISTENCE_MODE == "supabase":
        _call(
            "PATCH",
            f"/rest/v1/items?id=eq.{uuid.UUID(lost_item_id)}",
            json={"verified_found_item_id": found_item_id, "verified_at": verified_at},
        )
        return
    with _lock:
        item = _items[lost_item_id]
        item["verified_found_item_id"] = found_item_id
        item["verified_at"] = verified_at


def signed_image_urls(items: list[dict]) -> dict[str, str]:
    """item id -> 만료 시간이 있는 사진 URL. 사진이 없거나 memory 모드면 비어 있다."""

    if PERSISTENCE_MODE != "supabase":
        return {}
    paths = {item["id"]: item["image_path"] for item in items if item.get("image_path")}
    urls = _supabase_signed_urls(list(paths.values()))
    return {item_id: urls[path] for item_id, path in paths.items() if path in urls}
