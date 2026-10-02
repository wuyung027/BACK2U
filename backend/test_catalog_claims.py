"""시연용 목록 클레임 API: 정답 비공개와 서버 판정을 확인한다."""

import unittest

from fastapi.testclient import TestClient

from backend.main import app


class CatalogClaimApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_question_does_not_reveal_answer_or_pickup_location(self):
        response = self.client.get("/api/v1/catalog-claims/found-wallet")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["choices"], ["학생증", "국민카드", "현금 5만원"])
        self.assertNotIn("pickup_location", response.json())
        self.assertNotIn("answer_hash", response.text)
        self.assertNotIn("salt", response.text)

    def test_wrong_answer_does_not_reveal_location(self):
        response = self.client.post("/api/v1/catalog-claims/found-wallet/verify", json={"answer": "학생증"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"verified": False, "pickup_location": None})

    def test_correct_answer_returns_location(self):
        response = self.client.post("/api/v1/catalog-claims/found-wallet/verify", json={"answer": "국민카드"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "verified": True,
            "pickup_location": "학생회관 1층 분실물 보관소",
        })

    def test_unknown_item_and_invalid_choice(self):
        self.assertEqual(self.client.get("/api/v1/catalog-claims/found-earbuds").status_code, 404)
        self.assertEqual(
            self.client.post("/api/v1/catalog-claims/found-wallet/verify", json={"answer": "없는 보기"}).status_code,
            400,
        )


if __name__ == "__main__":
    unittest.main()
