"""
습득물명(item_name) 테스트 (AI/Supabase 호출 없음).

실행: python -m unittest backend.test_found_item -v
"""

import json
import os
import unittest

# .env가 supabase/REAL 모드여도 테스트는 메모리 저장소 + Mock 분석만 쓴다 (dotenv는 기존 값을 덮어쓰지 않음).
os.environ["PERSISTENCE_MODE"] = "memory"
os.environ["AI_MOCK_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from backend import main  # noqa: E402


class FoundItemNameTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        self.jpg = b"\xff\xd8\xff\xe0" + b"0" * 64

    def _found(self, **form):
        return self.client.post("/api/v1/items/found", files={"image": ("photo.jpg", self.jpg, "image/jpeg")}, data=form)

    def test_name_saved_as_raw_text_and_first_keyword(self):
        response = self._found(item_name="  학생증 20231234 카드지갑 ")
        self.assertEqual(response.status_code, 200)
        item = response.json()["item"]
        self.assertEqual(item["raw_text"], "학생증 *** 카드지갑")
        self.assertEqual(item["features"]["keywords"][0], "학생증 *** 카드지갑")
        self.assertNotIn("20231234", response.text)

    def test_too_long_name_rejected(self):
        response = self._found(item_name="가" * (main.ITEM_NAME_MAX_LENGTH + 1))
        self.assertEqual(response.status_code, 400)

    def test_storage_location_saved_separately(self):
        response = self._found(item_name="카드지갑", location="공학관 앞 벤치", storage_location="  학생회관 1층 안내데스크 ")
        self.assertEqual(response.status_code, 200)
        item = response.json()["item"]
        # 등록 응답·features(AI/매칭 입력)에는 들어가지 않고 저장소에만 정리된 값으로 남는다.
        self.assertNotIn("학생회관 1층 안내데스크", response.text)
        self.assertNotIn("storage_location", response.text)
        self.assertEqual(item["features"]["location"], "공학관 앞 벤치")
        self.assertEqual(main.store.get_item(item["id"])["storage_location"], "학생회관 1층 안내데스크")

    def test_too_long_storage_location_rejected(self):
        response = self._found(storage_location="가" * (main.STORAGE_LOCATION_MAX_LENGTH + 1))
        self.assertEqual(response.status_code, 400)

    def test_verification_questions_validation(self):
        two = [{"question": "a?", "answer": "1"}, {"question": "b?", "answer": "2"}]
        dup = [{"question": "같은 질문?", "answer": "1"}, {"question": "같은  질문?", "answer": "2"}, {"question": "c?", "answer": "3"}]
        blank = [{"question": "a?", "answer": "1"}, {"question": "b?", "answer": "   "}, {"question": "c?", "answer": "3"}]
        long_answer = [{"question": "a?", "answer": "가" * 101}, {"question": "b?", "answer": "2"}, {"question": "c?", "answer": "3"}]
        for value in (json.dumps(two), json.dumps(dup), json.dumps(blank), json.dumps(long_answer), "not-json"):
            self.assertEqual(self._found(verification_questions=value).status_code, 400, value[:40])

    def test_without_name_keeps_previous_behavior(self):
        response = self._found(location="학생회관 1층")
        self.assertEqual(response.status_code, 200)
        item = response.json()["item"]
        self.assertIsNone(item["raw_text"])
        self.assertEqual(item["features"]["location"], "학생회관 1층")


if __name__ == "__main__":
    unittest.main()
