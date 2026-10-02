"""
Supabase 저장 경로(사진 업로드 → items insert) 테스트. 실제 Supabase는 호출하지 않고 store._call을 가짜로 바꾼다.

실행: python -m unittest backend.test_store_supabase -v
"""

import os
import unittest
from unittest import mock

os.environ["PERSISTENCE_MODE"] = "memory"
os.environ["AI_MOCK_MODE"] = "true"

from ai.schemas import ItemFeatures  # noqa: E402
from backend import store  # noqa: E402

ITEM_ID = "11111111-1111-4111-8111-111111111111"
IMAGE = (b"\xff\xd8\xff\xe0" + b"0" * 32, "image/jpeg", ".jpg")


def _item(storage_location=None, challenges=None):
    return {
        "id": ITEM_ID, "type": "FOUND", "raw_text": "검은색 카드지갑", "features": ItemFeatures(category="카드지갑"),
        "image_filename": "wallet.jpg", "image_path": None, "created_at": "2026-10-02T00:00:00+00:00",
        "verification_question": None, "verification_answer_hash": None, "verification_salt": None,
        "verified_found_item_id": None, "verified_at": None, "storage_location": storage_location,
        "verification_challenges": challenges,
    }


class FakeResponse:
    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data


class SupabaseAddTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.fail_on = None  # "upload" | "insert"

    def _fake_call(self, method, path, **kwargs):
        self.calls.append((method, path, kwargs))
        if method == "POST" and path.startswith(f"/storage/v1/object/{store._BUCKET}/"):
            if self.fail_on == "upload":
                raise store.PersistenceError("Supabase 오류 (POST /storage/v1/object -> HTTP 400): bucket not found")
            return FakeResponse({})
        if method == "POST" and path == "/rest/v1/items":
            if self.fail_on == "insert":
                raise store.PersistenceError(
                    'Supabase 오류 (POST /rest/v1/items -> HTTP 400): {"code":"PGRST204","message":"Could not find the column"}'
                )
            return FakeResponse([{**kwargs["json"], "created_at": "2026-10-02T00:00:00+00:00"}])
        if method == "DELETE":
            return FakeResponse([])
        raise AssertionError(f"unexpected call {method} {path}")

    def _add(self, item):
        with mock.patch.object(store, "_call", self._fake_call):
            return store._supabase_add(item, IMAGE)

    def test_upload_then_insert_with_image_path(self):
        saved = self._add(_item("학생회관 1층 안내데스크"))
        (m1, upload_path, upload_kw), (m2, insert_path, insert_kw) = self.calls
        self.assertTrue(upload_path.startswith(f"/storage/v1/object/{store._BUCKET}/{ITEM_ID}/"))
        self.assertEqual(upload_kw["content"], IMAGE[0])
        self.assertEqual(upload_kw["headers"]["content-type"], "image/jpeg")
        self.assertEqual(insert_kw["json"]["image_path"], upload_path.split(f"/{store._BUCKET}/", 1)[1])
        self.assertEqual(saved["image_path"], insert_kw["json"]["image_path"])
        self.assertEqual(saved["storage_location"], "학생회관 1층 안내데스크")

    def test_insert_failure_removes_uploaded_image(self):
        self.fail_on = "insert"
        with self.assertRaises(store.PersistenceError) as ctx:
            self._add(_item("학생회관 1층 안내데스크"))
        uploaded = self.calls[0][1].split(f"/{store._BUCKET}/", 1)[1]
        method, path, kwargs = self.calls[-1]
        self.assertEqual((method, path), ("DELETE", f"/storage/v1/object/{store._BUCKET}"))
        self.assertEqual(kwargs["json"], {"prefixes": [uploaded]})
        self.assertTrue(str(ctx.exception).startswith("[db-insert]"))
        self.assertIn("supabase/migrations", str(ctx.exception))

    def test_upload_failure_skips_insert(self):
        self.fail_on = "upload"
        with self.assertRaises(store.PersistenceError) as ctx:
            self._add(_item())
        self.assertEqual(len(self.calls), 1)
        self.assertTrue(str(ctx.exception).startswith("[storage-upload]"))

    def test_storage_location_column_sent_only_when_given(self):
        self._add(_item())
        self.assertNotIn("storage_location", self.calls[1][2]["json"])
        self.assertNotIn("verification_challenges", self.calls[1][2]["json"])

    def test_verification_challenges_saved_as_given(self):
        challenges = [{"id": "q1", "question": "스티커 색은?", "answer_hash": "h", "salt": "s"}]
        saved = self._add(_item(challenges=challenges))
        self.assertEqual(self.calls[1][2]["json"]["verification_challenges"], challenges)
        self.assertEqual(saved["verification_challenges"], challenges)


if __name__ == "__main__":
    unittest.main()
