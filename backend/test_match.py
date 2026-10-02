"""
매칭 후보 API 테스트 (AI/Supabase 호출 없음).

실행: python -m unittest backend.test_match -v
"""

import os
import unittest
from unittest import mock

# .env가 supabase/REAL 모드여도 테스트는 메모리 저장소 + Mock 매칭만 쓴다 (dotenv는 기존 값을 덮어쓰지 않음).
os.environ["PERSISTENCE_MODE"] = "memory"
os.environ["AI_MOCK_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from ai.schemas import ItemFeatures  # noqa: E402
from backend import main  # noqa: E402

JPG = b"\xff\xd8\xff\xe0" + b"0" * 64


class MatchCandidatesApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        # 다른 테스트가 메모리 저장소에 넣은 물건과 섞이지 않게 비운 상태로 시작하고 끝나면 되돌린다.
        isolated = mock.patch.dict(main.store._items, clear=True)
        isolated.start()
        self.addCleanup(isolated.stop)

    def _lost(self, features):
        with mock.patch.object(main, "extract_lost_features", lambda _text: features):
            return self.client.post("/api/v1/items/lost", json={"raw_text": "분실물 설명"}).json()["item"]["id"]

    def _found(self, features):
        with mock.patch.object(main, "extract_found_features", lambda _path: features):
            r = self.client.post("/api/v1/items/found", files={"image": ("f.jpg", JPG, "image/jpeg")})
            return r.json()["item"]["id"]

    def test_mismatched_category_returns_empty_matches(self):
        lost_id = self._lost(ItemFeatures(category="글러브", color="검정", location="건국체육관", time_text="오후 4시쯤"))
        found_id = self._found(ItemFeatures(category="포스터", color="분홍", keywords=["분홍색 포스터"]))

        for source in (lost_id, found_id):
            r = self.client.get(f"/api/v1/items/match/{source}")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r.json()["matches"], [])

    def test_compatible_candidate_is_kept(self):
        lost_id = self._lost(ItemFeatures(category="카드지갑", color="검정"))
        wallet_id = self._found(ItemFeatures(category="지갑", color="검은색"))
        self._found(ItemFeatures(category="무선 이어폰", color="흰색"))

        matches = self.client.get(f"/api/v1/items/match/{lost_id}").json()["matches"]
        self.assertEqual([m["item_id"] for m in matches], [wallet_id])


if __name__ == "__main__":
    unittest.main()
