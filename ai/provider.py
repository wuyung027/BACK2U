"""
OpenAI 호환 Chat Completions API 호출 어댑터.

설정은 환경변수(.env.local > .env)에서만 읽는다.
- AI_API_KEY          (필수, Secret)
- AI_BASE_URL         (필수, 예: https://api.openai.com/v1)
- AI_MODEL            (필수)
- AI_EMBEDDING_MODEL  (임베딩 사용 시 필수, 예: text-embedding-3-small)
- AI_TIMEOUT_SECONDS  (선택, 기본 30)
- AI_MOCK_MODE        (선택, true면 실제 호출 대신 Mock 사용)

user_content에는 문자열 또는 OpenAI content part 리스트를 넘길 수 있으므로,
이후 이미지(Vision) 입력도 같은 함수로 호출할 수 있다.
"""

import base64
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

import httpx
from dotenv import load_dotenv


_ROOT = Path(__file__).resolve().parent.parent

# 이미 설정된 OS 환경변수가 우선, 그다음 .env.local, .env 순.
load_dotenv(_ROOT / ".env.local")
load_dotenv(_ROOT / ".env")


class AIConfigError(RuntimeError):
    """필수 환경변수가 없거나 잘못된 경우."""


class AIProviderError(RuntimeError):
    """네트워크/HTTP/API 응답 오류."""


class AIResponseParseError(ValueError):
    """AI 응답을 JSON으로 해석할 수 없는 경우."""

    def __init__(self, message: str, raw: str | None = None):
        super().__init__(message)
        self.raw = raw


@dataclass(frozen=True)
class AIConfig:
    api_key: str
    base_url: str
    model: str
    timeout: float
    embedding_model: str | None = None


def is_mock_mode() -> bool:
    return os.getenv("AI_MOCK_MODE", "false").strip().lower() in {"1", "true", "yes", "on"}


def load_config() -> AIConfig:
    missing = [
        name
        for name in ("AI_API_KEY", "AI_BASE_URL", "AI_MODEL")
        if not os.getenv(name, "").strip()
    ]
    if missing:
        raise AIConfigError(
            f"AI 설정 누락: {', '.join(missing)}. "
            "프로젝트 루트의 .env 또는 .env.local에 값을 넣어 주세요 "
            "(.env.example 참고). 테스트만 하려면 AI_MOCK_MODE=true."
        )

    timeout_raw = os.getenv("AI_TIMEOUT_SECONDS", "30").strip()
    try:
        timeout = float(timeout_raw)
    except ValueError as e:
        raise AIConfigError(f"AI_TIMEOUT_SECONDS가 숫자가 아닙니다: {timeout_raw!r}") from e

    return AIConfig(
        api_key=os.environ["AI_API_KEY"].strip(),
        base_url=os.environ["AI_BASE_URL"].strip().rstrip("/"),
        model=os.environ["AI_MODEL"].strip(),
        timeout=timeout,
        embedding_model=os.getenv("AI_EMBEDDING_MODEL", "").strip() or None,
    )


# 오류 메시지에 섞여 오는 API 키 조각(sk-...)을 로그/예외에서 지운다.
_API_KEY_PATTERN = re.compile(r"sk-[A-Za-z0-9_\-*.]+")


def _redact_keys(text: str) -> str:
    return _API_KEY_PATTERN.sub("sk-***", text or "")


_CODE_FENCE = re.compile(r"^```(?:json)?\s*(.*?)\s*```$", re.DOTALL | re.IGNORECASE)


def parse_json_object(raw: str) -> dict:
    """
    AI 응답 문자열에서 JSON 객체를 추출한다.
    ```json ... ``` 코드펜스나 앞뒤 설명 문장이 섞여도 처리한다.
    """

    text = raw.strip()

    fenced = _CODE_FENCE.match(text)
    if fenced:
        text = fenced.group(1).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise AIResponseParseError("AI 응답에서 JSON 객체를 찾을 수 없습니다.", raw)
        try:
            data = json.loads(text[start : end + 1])
        except json.JSONDecodeError as e:
            raise AIResponseParseError(f"AI 응답 JSON 파싱 실패: {e}", raw) from e

    if not isinstance(data, dict):
        raise AIResponseParseError(
            f"AI 응답이 JSON 객체가 아닙니다 (type={type(data).__name__}).", raw
        )

    return data


IMAGE_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
MAX_IMAGE_BYTES = 20 * 1024 * 1024


def image_content_part(image_path: str | Path) -> dict:
    """
    로컬 이미지 파일 -> OpenAI image_url content part (base64 data URI).
    파일 없음/미지원 확장자/빈 파일/용량 초과 시 명확한 예외를 낸다.
    """

    path = Path(image_path)
    if not path.is_file():
        raise FileNotFoundError(f"이미지 파일을 찾을 수 없습니다: {path}")

    mime = IMAGE_MIME_TYPES.get(path.suffix.lower())
    if mime is None:
        raise ValueError(
            f"지원하지 않는 이미지 형식입니다: {path.suffix or '(확장자 없음)'} "
            f"(지원: {', '.join(IMAGE_MIME_TYPES)})"
        )

    data = path.read_bytes()
    if not data:
        raise ValueError(f"이미지 파일이 비어 있습니다: {path}")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError(
            f"이미지가 너무 큽니다: {len(data) / 1024 / 1024:.1f}MB "
            f"(최대 {MAX_IMAGE_BYTES // 1024 // 1024}MB)"
        )

    encoded = base64.b64encode(data).decode("ascii")
    return {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}}


def chat_json(
    system_prompt: str,
    user_content: str | list[dict],
    config: AIConfig | None = None,
) -> dict:
    """
    시스템 프롬프트 + 사용자 입력으로 Chat Completions를 호출하고
    JSON 객체(dict)를 반환한다.
    """

    config = config or load_config()

    payload = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "response_format": {"type": "json_object"},
    }

    try:
        response = httpx.post(
            f"{config.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {config.api_key}"},
            json=payload,
            timeout=config.timeout,
        )
    except httpx.TimeoutException as e:
        raise AIProviderError(f"AI API 응답 시간 초과 ({config.timeout}s).") from e
    except httpx.HTTPError as e:
        raise AIProviderError(f"AI API 네트워크 오류: {type(e).__name__}: {e}") from e

    if response.status_code != 200:
        try:
            detail = response.json().get("error", {}).get("message", "")
        except ValueError:
            detail = response.text[:300]
        raise AIProviderError(f"AI API 오류 (HTTP {response.status_code}): {_redact_keys(detail)}")

    try:
        choice = response.json()["choices"][0]
        content = choice["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as e:
        raise AIProviderError("AI API 응답 형식이 예상과 다릅니다.") from e

    if not content:
        reason = choice.get("finish_reason")
        raise AIResponseParseError(f"AI 응답 본문이 비어 있습니다 (finish_reason={reason}).")

    return parse_json_object(content)


# (embedding_model, text) -> vector. 프로세스 내 단순 캐시.
_EMBEDDING_CACHE: dict[tuple[str, str], list[float]] = {}


def embed_texts(texts: list[str], config: AIConfig | None = None) -> list[list[float]]:
    """
    여러 텍스트를 임베딩한다. 캐시에 없는 텍스트만 한 번의 요청으로 보낸다.
    """

    config = config or load_config()
    if not config.embedding_model:
        raise AIConfigError(
            "AI 설정 누락: AI_EMBEDDING_MODEL. .env 또는 .env.local에 값을 넣어 주세요."
        )

    cleaned = [t.strip() if isinstance(t, str) else "" for t in texts]
    if any(not t for t in cleaned):
        raise ValueError("빈 문자열은 임베딩할 수 없습니다.")

    model = config.embedding_model
    missing = list(dict.fromkeys(t for t in cleaned if (model, t) not in _EMBEDDING_CACHE))

    if missing:
        try:
            response = httpx.post(
                f"{config.base_url}/embeddings",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json={"model": model, "input": missing},
                timeout=config.timeout,
            )
        except httpx.TimeoutException as e:
            raise AIProviderError(f"임베딩 API 응답 시간 초과 ({config.timeout}s).") from e
        except httpx.HTTPError as e:
            raise AIProviderError(f"임베딩 API 네트워크 오류: {type(e).__name__}: {e}") from e

        if response.status_code != 200:
            try:
                detail = response.json().get("error", {}).get("message", "")
            except ValueError:
                detail = response.text[:300]
            raise AIProviderError(f"임베딩 API 오류 (HTTP {response.status_code}): {_redact_keys(detail)}")

        try:
            items = sorted(response.json()["data"], key=lambda d: d["index"])
            vectors = [item["embedding"] for item in items]
        except (ValueError, KeyError, TypeError) as e:
            raise AIProviderError("임베딩 API 응답 형식이 예상과 다릅니다.") from e

        if len(vectors) != len(missing):
            raise AIProviderError(
                f"임베딩 개수 불일치 (요청 {len(missing)}, 응답 {len(vectors)})."
            )

        for text, vector in zip(missing, vectors):
            _EMBEDDING_CACHE[(model, text)] = vector

    return [_EMBEDDING_CACHE[(model, t)] for t in cleaned]
