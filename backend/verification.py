"""
소유 확인(비공개 정답) 보안 helper. 표준 라이브러리만 사용한다.

- 정답 평문(정규화 결과 포함)은 저장하지 않고 salt + SHA-256 해시만 저장한다.
- 비교는 hmac.compare_digest로 상수 시간 비교한다.
"""

import hashlib
import hmac
import re
import secrets
import threading
import time
import unicodedata

QUESTION_MAX_LENGTH = 200
ANSWER_MAX_LENGTH = 100


def normalize_answer(answer: str) -> str:
    """NFKC 정규화 + 앞뒤 공백 제거 + 연속 공백 정리 + 대소문자 무시."""

    text = unicodedata.normalize("NFKC", answer or "")
    return re.sub(r"\s+", " ", text).strip().casefold()


def _digest(salt: str, normalized: str) -> str:
    return hashlib.sha256(f"{salt}:{normalized}".encode("utf-8")).hexdigest()


def validate_verification(question: str | None, answer: str | None) -> tuple[str, str] | None:
    """
    둘 다 비어 있으면 None(소유 확인 정보 없이 등록).
    하나만 있거나 길이를 넘으면 ValueError (사용자에게 보여줄 문구).
    """

    question = (question or "").strip()
    has_answer = bool(normalize_answer(answer or ""))
    if not question and not has_answer:
        return None
    if not question:
        raise ValueError("소유 확인 질문을 입력해 주세요.")
    if not has_answer:
        raise ValueError("소유 확인 정답을 입력해 주세요.")
    if len(question) > QUESTION_MAX_LENGTH:
        raise ValueError(f"소유 확인 질문은 {QUESTION_MAX_LENGTH}자 이하로 입력해 주세요.")
    if len(answer.strip()) > ANSWER_MAX_LENGTH:
        raise ValueError(f"소유 확인 정답은 {ANSWER_MAX_LENGTH}자 이하로 입력해 주세요.")
    return question, answer


def hash_answer(answer: str) -> tuple[str, str]:
    """정답 -> (answer_hash, salt)."""

    normalized = normalize_answer(answer)
    if not normalized:
        raise ValueError("소유 확인 정답을 입력해 주세요.")
    salt = secrets.token_hex(16)
    return _digest(salt, normalized), salt


def verify_answer(answer: str, answer_hash: str, salt: str) -> bool:
    normalized = normalize_answer(answer)
    if not normalized or not answer_hash or not salt:
        return False
    return hmac.compare_digest(_digest(salt, normalized), answer_hash)


# ------------------------------------------------- 습득자가 만드는 질문 3개
# 습득자가 물건을 직접 보고 질문/정답을 만들고, 분실자는 그중 하나만 맞히면 된다.

CHALLENGE_COUNT = 3


def build_challenges(entries) -> list[dict]:
    """
    [{"question", "answer"}] x 3 -> 저장용 [{"id", "question", "answer_hash", "salt"}].
    정답 평문은 결과에 남기지 않는다. 형식이 맞지 않으면 ValueError (사용자에게 보여줄 문구).
    """

    if not isinstance(entries, list) or len(entries) != CHALLENGE_COUNT:
        raise ValueError(f"소유 확인 질문 {CHALLENGE_COUNT}개와 정답을 모두 입력해 주세요.")
    challenges, seen = [], set()
    for index, entry in enumerate(entries, start=1):
        entry = entry if isinstance(entry, dict) else {}
        question = entry.get("question") if isinstance(entry.get("question"), str) else ""
        answer = entry.get("answer") if isinstance(entry.get("answer"), str) else ""
        validated = validate_verification(question, answer)
        if validated is None:
            raise ValueError(f"소유 확인 질문 {CHALLENGE_COUNT}개와 정답을 모두 입력해 주세요.")
        question, answer = validated
        key = normalize_answer(question)
        if key in seen:
            raise ValueError("서로 다른 질문을 입력해 주세요.")
        seen.add(key)
        answer_hash, salt = hash_answer(answer)
        challenges.append({"id": f"q{index}", "question": question, "answer_hash": answer_hash, "salt": salt})
    return challenges


def public_questions(challenges) -> list[dict]:
    """분실자에게 보여줄 질문만 (id, question). 해시/salt는 빼고 내보낸다."""

    return [
        {"id": c["id"], "question": c["question"]}
        for c in (challenges or [])
        if isinstance(c, dict) and c.get("id") and c.get("question")
    ]


def find_challenge(challenges, question_id: str | None) -> dict | None:
    return next((c for c in (challenges or []) if isinstance(c, dict) and question_id and c.get("id") == question_id), None)


# ------------------------------------------------- 오답 제한
# (분실물, 습득물) 쌍마다 오답 5번이면 10분 동안 답을 확인하지 않는다.
# 서버 메모리에만 두므로 서버가 재시작되면 초기화된다.

MAX_FAILED_ATTEMPTS = 5
BLOCK_SECONDS = 10 * 60


class AttemptLimiter:
    def __init__(self, max_failures: int = MAX_FAILED_ATTEMPTS, block_seconds: float = BLOCK_SECONDS, clock=time.monotonic):
        self._max_failures = max_failures
        self._block_seconds = block_seconds
        self._clock = clock
        self._failures: dict[tuple[str, str], int] = {}
        self._blocked_until: dict[tuple[str, str], float] = {}
        self._lock = threading.Lock()

    def is_blocked(self, pair: tuple[str, str]) -> bool:
        with self._lock:
            until = self._blocked_until.get(pair)
            if until is not None and self._clock() >= until:
                del self._blocked_until[pair]
                return False
            return until is not None

    def record_failure(self, pair: tuple[str, str]) -> None:
        with self._lock:
            failures = self._failures.pop(pair, 0) + 1
            if failures >= self._max_failures:
                self._blocked_until[pair] = self._clock() + self._block_seconds
            else:
                self._failures[pair] = failures

    def reset(self, pair: tuple[str, str]) -> None:
        with self._lock:
            self._failures.pop(pair, None)
            self._blocked_until.pop(pair, None)
