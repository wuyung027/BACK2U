"""
소유 확인 테스트 (AI/Supabase 호출 없음).

실행: python -m unittest backend.test_verification -v
"""

import json
import os
import unittest
from unittest import mock

# .env가 supabase/REAL 모드여도 테스트는 메모리 저장소 + Mock 매칭만 쓴다 (dotenv는 기존 값을 덮어쓰지 않음).
os.environ["PERSISTENCE_MODE"] = "memory"
os.environ["AI_MOCK_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from ai.schemas import ItemFeatures  # noqa: E402
from backend import main  # noqa: E402
from backend.verification import (  # noqa: E402
    BLOCK_SECONDS,
    MAX_FAILED_ATTEMPTS,
    AttemptLimiter,
    hash_answer,
    normalize_answer,
    validate_verification,
    verify_answer,
)

SECRET = "KU2026"


class VerificationHelperTest(unittest.TestCase):
    def setUp(self):
        self.answer_hash, self.salt = hash_answer(SECRET)

    def test_same_answer(self):
        self.assertTrue(verify_answer("KU2026", self.answer_hash, self.salt))

    def test_surrounding_whitespace(self):
        self.assertTrue(verify_answer("  KU2026 \n", self.answer_hash, self.salt))

    def test_case_insensitive(self):
        self.assertTrue(verify_answer("ku2026", self.answer_hash, self.salt))

    def test_unicode_nfkc(self):
        # 전각 문자 "ＫＵ２０２６"은 NFKC로 "KU2026"이 된다.
        self.assertEqual(normalize_answer("ＫＵ２０２６"), normalize_answer("KU2026"))
        self.assertTrue(verify_answer("ＫＵ２０２６", self.answer_hash, self.salt))

    def test_inner_whitespace_collapsed(self):
        answer_hash, salt = hash_answer("파란 고양이")
        self.assertTrue(verify_answer("파란   고양이", answer_hash, salt))

    def test_different_answer(self):
        self.assertFalse(verify_answer("KU2025", self.answer_hash, self.salt))
        self.assertFalse(verify_answer("", self.answer_hash, self.salt))

    def test_hash_is_salted_and_not_plaintext(self):
        other_hash, other_salt = hash_answer(SECRET)
        self.assertNotEqual(self.salt, other_salt)
        self.assertNotEqual(self.answer_hash, other_hash)
        self.assertNotIn(normalize_answer(SECRET), self.answer_hash)

    def test_validation(self):
        self.assertIsNone(validate_verification(None, None))
        self.assertIsNone(validate_verification("  ", "  "))
        with self.assertRaises(ValueError):
            validate_verification("스티커 문구는?", "   ")
        with self.assertRaises(ValueError):
            validate_verification("", SECRET)
        with self.assertRaises(ValueError):
            validate_verification("질" * 201, SECRET)
        with self.assertRaises(ValueError):
            validate_verification("스티커 문구는?", "a" * 101)
        with self.assertRaises(ValueError):
            hash_answer("   ")


def _fake_lost(_text):
    return ItemFeatures(category="카드지갑", color="검정", location="공학관 1층", time_text="오늘 오후 3시쯤")


def _fake_found(_path):
    return ItemFeatures(category="카드지갑", color="검정")


@mock.patch.object(main, "extract_found_features", _fake_found)
@mock.patch.object(main, "extract_lost_features", _fake_lost)
class VerificationApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.jpg = b"\xff\xd8\xff\xe0" + b"0" * 64

    def _lost(self, **extra):
        body = {"raw_text": "검은색 카드지갑을 잃어버렸어요.", **extra}
        return self.client.post("/api/v1/items/lost", json=body)

    def _found(self, storage_location=None):
        data = {"storage_location": storage_location} if storage_location else None
        r = self.client.post("/api/v1/items/found", files={"image": ("w.jpg", self.jpg, "image/jpeg")}, data=data)
        return r.json()["item"]["id"]

    def _assert_no_secret(self, payload):
        text = json.dumps(payload, ensure_ascii=False)
        for forbidden in ("verification_answer", "verification_answer_hash", "verification_salt", SECRET, SECRET.lower()):
            self.assertNotIn(forbidden, text)

    def _verify(self, lost_id, found_id, answer):
        return self.client.post(
            "/api/v1/items/verify",
            json={"lost_item_id": lost_id, "found_item_id": found_id, "answer": answer},
        )

    def test_full_flow(self):
        r = self._lost(verification_question="지갑 안쪽 스티커 문구는?", verification_answer=SECRET)
        self.assertEqual(r.status_code, 200)
        lost = r.json()["item"]
        self._assert_no_secret(r.json())
        self.assertTrue(lost["verification_required"])
        self.assertEqual(lost["verification_question"], "지갑 안쪽 스티커 문구는?")

        stored = main.store.get_item(lost["id"])
        self.assertNotIn(SECRET.casefold(), json.dumps(stored, default=str).casefold())

        found_id = self._found()
        other_found_id = self._found()
        match = self.client.get(f"/api/v1/items/match/{found_id}").json()
        self._assert_no_secret(match)
        pair = next(m for m in match["matches"] if m["item_id"] == lost["id"])
        self.assertTrue(pair["verification_required"])
        self.assertFalse(pair["verified"])

        wrong = self._verify(lost["id"], found_id, "KU2025")
        self.assertEqual(wrong.json(), {"verified": False, "message": "소유 확인 정보가 일치하지 않습니다."})

        right = self._verify(lost["id"], found_id, " ku2026 ")
        self.assertEqual(right.json()["verified"], True)

        pair = next(m for m in self.client.get(f"/api/v1/items/match/{found_id}").json()["matches"] if m["item_id"] == lost["id"])
        self.assertTrue(pair["verified"])
        # 다른 습득물은 확인된 것으로 보지 않는다.
        lost_view = self.client.get(f"/api/v1/items/match/{lost['id']}").json()
        verified_by_found = {m["item_id"]: m["verified"] for m in lost_view["matches"]}
        self.assertTrue(verified_by_found[found_id])
        self.assertFalse(verified_by_found[other_found_id])

    def test_storage_location_only_after_verification(self):
        lost = self._lost(verification_question="지갑 안쪽 스티커 문구는?", verification_answer=SECRET).json()["item"]
        found_b = self._found("학생회관 1층 안내데스크")
        self._found("공학관 경비실")

        # D: 매칭 응답(습득물/분실물 양쪽 화면)에는 보관 장소가 없다.
        for source in (found_b, lost["id"]):
            match = self.client.get(f"/api/v1/items/match/{source}")
            for leaked in ("storage_location", "학생회관 1층 안내데스크", "공학관 경비실"):
                self.assertNotIn(leaked, match.text)

        # E: 오답이면 필드 자체가 없다.
        wrong = self._verify(lost["id"], found_b, "KU2025")
        self.assertEqual(wrong.json(), {"verified": False, "message": "소유 확인 정보가 일치하지 않습니다."})

        # F/G: 정답이면 요청한 습득물(B)의 보관 장소만 돌려준다.
        right = self._verify(lost["id"], found_b, SECRET)
        self.assertEqual(right.json()["verified"], True)
        self.assertEqual(right.json()["storage_location"], "학생회관 1층 안내데스크")
        self.assertNotIn("공학관 경비실", right.text)

        # 이미 확인된 쌍도 정답을 다시 맞히면 다시 보여준다 (조회만으로는 공개되지 않음).
        again = self._verify(lost["id"], found_b, SECRET)
        self.assertEqual(again.json()["storage_location"], "학생회관 1층 안내데스크")

    def test_legacy_found_without_storage_location(self):
        # H: 보관 장소가 없는 예전 습득물도 소유 확인은 정상 처리된다.
        lost = self._lost(verification_question="질문?", verification_answer=SECRET).json()["item"]
        found_id = self._found()
        right = self._verify(lost["id"], found_id, SECRET)
        self.assertEqual(right.status_code, 200)
        self.assertEqual(right.json()["verified"], True)
        self.assertIsNone(right.json()["storage_location"])

    def test_legacy_item_without_verification(self):
        lost = self._lost().json()["item"]
        self.assertFalse(lost["verification_required"])
        found_id = self._found()
        pair = next(m for m in self.client.get(f"/api/v1/items/match/{found_id}").json()["matches"] if m["item_id"] == lost["id"])
        self.assertFalse(pair["verification_required"])
        self.assertIsNone(pair["verification_question"])
        self.assertEqual(self._verify(lost["id"], found_id, SECRET).status_code, 400)

    def test_lost_validation_errors(self):
        self.assertEqual(self._lost(verification_question="질문?", verification_answer="  ").status_code, 400)
        self.assertEqual(self._lost(verification_answer=SECRET).status_code, 400)

    def test_verify_request_errors(self):
        lost = self._lost(verification_question="질문?", verification_answer=SECRET).json()["item"]
        found_id = self._found()
        self.assertEqual(self._verify(lost["id"], found_id, "   ").status_code, 400)
        self.assertEqual(self._verify(lost["id"], "missing", SECRET).status_code, 404)
        self.assertEqual(self._verify(found_id, lost["id"], SECRET).status_code, 400)



QUESTIONS = [
    {"question": "텀블러 바닥 스티커 색은?", "answer": "노란색"},
    {"question": "뚜껑 빨대는 무슨 색인가요?", "answer": "갈색"},
    {"question": "손잡이 안쪽에 적힌 글자는?", "answer": "STANLEY"},
]
STORAGE = "학생회관 1층 안내데스크"


@mock.patch.object(main, "extract_found_features", _fake_found)
@mock.patch.object(main, "extract_lost_features", _fake_lost)
class FoundChallengeTest(unittest.TestCase):
    """습득자가 FOUND 등록 때 만든 질문 3개 중 하나를 분실자가 맞히는 흐름."""

    def setUp(self):
        self.client = TestClient(main.app)
        self.jpg = b"\xff\xd8\xff\xe0" + b"0" * 64

    def _found(self, questions=QUESTIONS, storage=STORAGE):
        data = {"storage_location": storage, "verification_questions": json.dumps(questions, ensure_ascii=False)}
        r = self.client.post("/api/v1/items/found", files={"image": ("w.jpg", self.jpg, "image/jpeg")}, data=data)
        self.assertEqual(r.status_code, 200, r.text)
        return r

    def _lost(self):
        return self.client.post("/api/v1/items/lost", json={"raw_text": "오늘 컨벤션홀에서 텀블러를 잃어버렸어요."}).json()["item"]

    def _verify(self, lost_id, found_id, question_id, answer):
        body = {"lost_item_id": lost_id, "found_item_id": found_id, "answer": answer}
        if question_id:
            body["question_id"] = question_id
        return self.client.post("/api/v1/items/verify", json=body)

    def test_found_saves_three_hashed_challenges(self):
        r = self._found()
        found_id = r.json()["item"]["id"]
        stored = main.store.get_item(found_id)["verification_challenges"]
        self.assertEqual([c["id"] for c in stored], ["q1", "q2", "q3"])
        self.assertEqual([c["question"] for c in stored], [q["question"] for q in QUESTIONS])
        self.assertTrue(all(c["answer_hash"] and c["salt"] for c in stored))
        # 정답 평문은 저장소/등록 응답 어디에도 없다.
        dumped = json.dumps(main.store.get_item(found_id), default=str, ensure_ascii=False).casefold()
        for q in QUESTIONS:
            self.assertNotIn(q["answer"].casefold(), dumped)
            self.assertNotIn(q["answer"], r.text)
        self.assertNotIn("answer_hash", r.text)
        # 새 분실물은 질문/정답 없이 등록된다.
        self.assertFalse(self._lost()["verification_required"])

    def test_match_shows_questions_only_to_lost_side(self):
        found_id = self._found().json()["item"]["id"]
        lost = self._lost()
        match = self.client.get(f"/api/v1/items/match/{lost['id']}")
        pair = next(m for m in match.json()["matches"] if m["item_id"] == found_id)
        self.assertEqual(pair["verification_questions"], [{"id": f"q{i}", "question": q["question"]} for i, q in enumerate(QUESTIONS, 1)])
        self.assertTrue(pair["verification_required"])
        for leaked in ("answer_hash", "salt", "storage_location", STORAGE, *[q["answer"] for q in QUESTIONS]):
            self.assertNotIn(leaked, match.text)
        # 습득자 화면(FOUND source)에는 질문을 내려주지 않는다.
        found_view = self.client.get(f"/api/v1/items/match/{found_id}")
        self.assertTrue(all(m["verification_questions"] is None for m in found_view.json()["matches"]))
        self.assertNotIn("answer_hash", found_view.text)

    def test_wrong_then_other_question_correct(self):
        found_id = self._found().json()["item"]["id"]
        lost = self._lost()
        wrong = self._verify(lost["id"], found_id, "q1", "빨간색")
        self.assertEqual(wrong.json(), {"verified": False, "message": "소유 확인 정보가 일치하지 않습니다."})
        right = self._verify(lost["id"], found_id, "q2", " 갈색 ")
        self.assertEqual(right.json()["verified"], True)
        self.assertEqual(right.json()["storage_location"], STORAGE)
        pair = next(m for m in self.client.get(f"/api/v1/items/match/{lost['id']}").json()["matches"] if m["item_id"] == found_id)
        self.assertTrue(pair["verified"])

    def test_third_question_also_works(self):
        found_id = self._found().json()["item"]["id"]
        right = self._verify(self._lost()["id"], found_id, "q3", "stanley")
        self.assertEqual(right.json()["storage_location"], STORAGE)

    def test_invalid_question_id(self):
        found_id = self._found().json()["item"]["id"]
        lost_id = self._lost()["id"]
        self.assertEqual(self._verify(lost_id, found_id, "q9", "갈색").status_code, 400)
        self.assertEqual(self._verify(lost_id, found_id, None, "갈색").status_code, 400)

    def test_question_checked_against_requested_found_only(self):
        found_b = self._found().json()["item"]["id"]
        other = [{"question": "가방 안 쪽지 문구는?", "answer": "HELLO"}, {"question": "지퍼 고리 색은?", "answer": "초록"}, {"question": "이니셜은?", "answer": "JK"}]
        found_c = self._found(questions=other, storage="공학관 경비실").json()["item"]["id"]
        lost_id = self._lost()["id"]
        # B의 정답을 C에 대고 검증하면 실패하고, C의 장소도 새지 않는다.
        r = self._verify(lost_id, found_c, "q2", "갈색")
        self.assertFalse(r.json()["verified"])
        self.assertNotIn("공학관 경비실", r.text)
        ok = self._verify(lost_id, found_b, "q2", "갈색")
        self.assertEqual(ok.json()["storage_location"], STORAGE)
        self.assertNotIn("공학관 경비실", ok.text)

    def test_found_without_challenges_and_new_lost_has_no_verification(self):
        r = self.client.post("/api/v1/items/found", files={"image": ("w.jpg", self.jpg, "image/jpeg")})
        found_id = r.json()["item"]["id"]
        self.assertEqual(self._verify(self._lost()["id"], found_id, "q1", "갈색").status_code, 400)


@mock.patch.object(main, "extract_found_features", _fake_found)
@mock.patch.object(main, "extract_lost_features", _fake_lost)
class AttemptLimitTest(unittest.TestCase):
    """(분실물, 습득물) 쌍마다 오답 5번이면 정답 확인을 멈춘다."""

    setUp = FoundChallengeTest.setUp
    _found = FoundChallengeTest._found
    _lost = FoundChallengeTest._lost
    _verify = FoundChallengeTest._verify

    def _wrong(self, lost_id, found_id):
        r = self._verify(lost_id, found_id, "q1", "빨간색")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["verified"])
        self.assertNotIn(STORAGE, r.text)

    def test_blocked_after_five_wrong_answers(self):
        found_id = self._found().json()["item"]["id"]
        lost_id = self._lost()["id"]
        for _ in range(MAX_FAILED_ATTEMPTS):
            self._wrong(lost_id, found_id)
        # 6번째는 정답이어도 확인하지 않고, 보관 장소도 내주지 않는다.
        blocked = self._verify(lost_id, found_id, "q2", "갈색")
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked.json()["detail"], "소유 확인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.")
        self.assertNotIn(STORAGE, blocked.text)
        self.assertFalse(main.store.get_item(lost_id)["verified_found_item_id"])

    def test_other_pairs_are_not_blocked(self):
        found_id = self._found().json()["item"]["id"]
        other_found_id = self._found().json()["item"]["id"]
        lost_id, other_lost_id = self._lost()["id"], self._lost()["id"]
        for _ in range(MAX_FAILED_ATTEMPTS):
            self._wrong(lost_id, found_id)
        self.assertEqual(self._verify(lost_id, found_id, "q2", "갈색").status_code, 429)
        self.assertEqual(self._verify(lost_id, other_found_id, "q2", "갈색").json()["storage_location"], STORAGE)
        self.assertEqual(self._verify(other_lost_id, found_id, "q2", "갈색").json()["storage_location"], STORAGE)

    def test_success_clears_failures(self):
        found_id = self._found().json()["item"]["id"]
        lost_id = self._lost()["id"]
        for _ in range(MAX_FAILED_ATTEMPTS - 1):
            self._wrong(lost_id, found_id)
        self.assertEqual(self._verify(lost_id, found_id, "q3", "STANLEY").json()["storage_location"], STORAGE)
        # 성공하면 오답 기록이 지워져 다시 4번 틀려도 막히지 않는다.
        for _ in range(MAX_FAILED_ATTEMPTS - 1):
            self._wrong(lost_id, found_id)
        self.assertEqual(self._verify(lost_id, found_id, "q2", "갈색").json()["storage_location"], STORAGE)


class AttemptLimiterTest(unittest.TestCase):
    def test_block_expires(self):
        now = [1000.0]
        limiter = AttemptLimiter(clock=lambda: now[0])
        pair = ("lost", "found")
        for _ in range(MAX_FAILED_ATTEMPTS - 1):
            limiter.record_failure(pair)
        self.assertFalse(limiter.is_blocked(pair))
        limiter.record_failure(pair)
        self.assertTrue(limiter.is_blocked(pair))
        now[0] += BLOCK_SECONDS - 1
        self.assertTrue(limiter.is_blocked(pair))
        now[0] += 1
        self.assertFalse(limiter.is_blocked(pair))
        limiter.record_failure(pair)  # 차단이 풀리면 처음부터 다시 센다
        self.assertFalse(limiter.is_blocked(pair))


if __name__ == "__main__":
    unittest.main()
