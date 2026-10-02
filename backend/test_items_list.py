"""
공개 물건 목록(GET /api/v1/items) 테스트 (AI/Supabase 호출 없음).

실행: python -m unittest backend.test_items_list -v
"""

import json
import os
import unittest

# .env가 supabase/REAL 모드여도 테스트는 메모리 저장소 + Mock 분석만 쓴다 (dotenv는 기존 값을 덮어쓰지 않음).
os.environ["PERSISTENCE_MODE"] = "memory"
os.environ["AI_MOCK_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from backend import main  # noqa: E402

ANSWER = "목록테스트정답"
QUESTION = "목록 테스트 질문은?"
STORAGE = "목록테스트 보관함 3번"
CHALLENGES = [{"question": "목록테스트 질문1?", "answer": "답일"}, {"question": "목록테스트 질문2?", "answer": "답이"}, {"question": "목록테스트 질문3?", "answer": "답삼"}]
LOST_TEXT = "목록 테스트: 학생회관에서 검은색 카드지갑을 잃어버렸어요. 학생증 이름 홍길동"
PRIVATE_KEYS = ("contact_phone", "storage_location", "verification_challenges", "verification_answer_hash", "verification_salt", "verification_question", "raw_text", "image_filename")


class PublicItemListTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)
        lost = cls.client.post(
            "/api/v1/items/lost",
            json={"raw_text": LOST_TEXT, "verification_question": QUESTION, "verification_answer": ANSWER},
        )
        cls.lost_id = lost.json()["item"]["id"]
        found = cls.client.post(
            "/api/v1/items/found",
            files={"image": ("photo.jpg", b"\xff\xd8\xff\xe0" + b"0" * 64, "image/jpeg")},
            data={"item_name": "목록 테스트 지갑", "location": "학생회관 1층", "time_text": "오후 3시", "storage_location": STORAGE,
                  "verification_questions": json.dumps(CHALLENGES, ensure_ascii=False)},
        )
        cls.found_id = found.json()["item"]["id"]

    def test_newest_first(self):
        ids = [item["id"] for item in self.client.get("/api/v1/items").json()["items"]]
        self.assertEqual(ids[0], self.found_id)
        self.assertLess(ids.index(self.found_id), ids.index(self.lost_id))

    def test_type_filter(self):
        items = self.client.get("/api/v1/items", params={"type": "LOST"}).json()["items"]
        self.assertTrue(items)
        self.assertTrue(all(item["type"] == "LOST" for item in items))
        self.assertEqual(self.client.get("/api/v1/items", params={"type": "OTHER"}).status_code, 422)

    def test_limit(self):
        items = self.client.get("/api/v1/items", params={"limit": 1}).json()["items"]
        self.assertEqual([item["id"] for item in items], [self.found_id])
        self.assertEqual(self.client.get("/api/v1/items", params={"limit": main.LIST_MAX_LIMIT + 1}).status_code, 422)

    def test_no_private_fields(self):
        response = self.client.get("/api/v1/items")
        for item in response.json()["items"]:
            for key in PRIVATE_KEYS:
                self.assertNotIn(key, item)
            self.assertIsNone(item["features"]["ocr_text"])
        for secret in (ANSWER, QUESTION, "홍길동", STORAGE, "storage_location", "verification_answer_hash", "verification_salt", "contact_phone",
                       "verification_challenges", "answer_hash", "목록테스트 질문1?", "답일"):
            self.assertNotIn(secret, response.text)

    def test_found_name_and_detail(self):
        detail = self.client.get(f"/api/v1/items/{self.found_id}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["name"], "목록 테스트 지갑")
        self.assertNotIn(STORAGE, detail.text)
        self.assertNotIn("storage_location", detail.text)
        for leaked in ("verification_challenges", "answer_hash", "salt", "목록테스트 질문1?", "답일"):
            self.assertNotIn(leaked, detail.text)
        lost = self.client.get(f"/api/v1/items/{self.lost_id}").json()
        self.assertIsNone(lost["name"])
        self.assertNotIn(ANSWER, str(lost))
        self.assertEqual(self.client.get("/api/v1/items/not-a-real-id").status_code, 404)


if __name__ == "__main__":
    unittest.main()
