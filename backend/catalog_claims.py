"""시연용 목록 항목의 수동 소유권 확인 문제.

실제 등록 물건의 확인 절차는 /api/v1/items/verify를 사용한다. 이 모듈의
문제와 보관 장소는 /items/found-wallet 시연 경로에만 대응한다.
"""

from dataclasses import dataclass

from backend.verification import hash_answer, verify_answer


@dataclass(frozen=True)
class CatalogClaim:
    question: str
    choices: tuple[str, ...]
    answer_hash: str
    salt: str
    pickup_location: str


_wallet_answer_hash, _wallet_salt = hash_answer("국민카드")

CLAIMS: dict[str, CatalogClaim] = {
    "found-wallet": CatalogClaim(
        question="보안을 위해 지갑 내부에 대한 퀴즈를 풀어주세요.",
        choices=("학생증", "국민카드", "현금 5만원"),
        answer_hash=_wallet_answer_hash,
        salt=_wallet_salt,
        pickup_location="학생회관 1층 분실물 보관소",
    ),
}


def get_claim(item_id: str) -> CatalogClaim | None:
    return CLAIMS.get(item_id)


def check_answer(claim: CatalogClaim, answer: str) -> bool:
    return verify_answer(answer, claim.answer_hash, claim.salt)
