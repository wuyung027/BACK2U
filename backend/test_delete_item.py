"""물건 단건 삭제: 메모리 API와 Supabase 저장소 호출 순서를 검증한다."""

import os
import unittest
from unittest import mock

os.environ["PERSISTENCE_MODE"] = "memory"
os.environ["AI_MOCK_MODE"] = "true"

from fastapi.testclient import TestClient  # noqa: E402

from ai.schemas import ItemFeatures  # noqa: E402
from backend import main, store  # noqa: E402


class MemoryDeleteTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_delete_lost_and_found_disappear_from_list(self):
        for item_type in ("LOST", "FOUND"):
            item = store.add_item(item_type, ItemFeatures(category="텀블러"), raw_text="QA DELETE TEST")
            item_id = item["id"]
            self.assertIn(item_id, [row["id"] for row in self.client.get("/api/v1/items").json()["items"]])

            response = self.client.delete(f"/api/v1/items/{item_id}")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {"deleted": True, "item_id": item_id})
            self.assertIsNone(store.get_item(item_id))
            self.assertNotIn(item_id, [row["id"] for row in self.client.get("/api/v1/items").json()["items"]])

    def test_missing_item_returns_404(self):
        response = self.client.delete("/api/v1/items/00000000-0000-4000-8000-000000000000")
        self.assertEqual(response.status_code, 404)


class FakeResponse:
    def __init__(self, rows):
        self.rows = rows

    def json(self):
        return self.rows


class SupabaseDeleteTest(unittest.TestCase):
    item_id = "11111111-1111-4111-8111-111111111111"
    image_path = f"{item_id}/photo.jpg"

    def test_found_image_deleted_before_row(self):
        calls = []

        def fake_call(method, path, **kwargs):
            calls.append((method, path, kwargs))
            return FakeResponse([{"id": self.item_id}])

        item = {"id": self.item_id, "type": "FOUND", "image_path": self.image_path}
        with mock.patch.object(store, "_supabase_get", return_value=item), mock.patch.object(store, "_call", side_effect=fake_call):
            self.assertTrue(store._supabase_delete(self.item_id))
        self.assertEqual([call[0] for call in calls], ["DELETE", "DELETE"])
        self.assertEqual(calls[0][1], f"/storage/v1/object/{store._BUCKET}")
        self.assertEqual(calls[0][2]["json"], {"prefixes": [self.image_path]})
        self.assertEqual(calls[1][1], f"/rest/v1/items?id=eq.{self.item_id}")

    def test_missing_storage_object_still_deletes_row(self):
        calls = []

        def fake_call(method, path, **kwargs):
            calls.append(path)
            if path.startswith("/storage/"):
                raise store.PersistenceError("HTTP 404")
            return FakeResponse([{"id": self.item_id}])

        item = {"id": self.item_id, "type": "FOUND", "image_path": self.image_path}
        with mock.patch.object(store, "_supabase_get", return_value=item), mock.patch.object(store, "_call", side_effect=fake_call):
            self.assertTrue(store._supabase_delete(self.item_id))
        self.assertEqual(len(calls), 2)

    def test_storage_error_keeps_row(self):
        item = {"id": self.item_id, "type": "FOUND", "image_path": self.image_path}
        with mock.patch.object(store, "_supabase_get", return_value=item), mock.patch.object(store, "_call", side_effect=store.PersistenceError("HTTP 500")) as call:
            with self.assertRaises(store.PersistenceError):
                store._supabase_delete(self.item_id)
        self.assertEqual(call.call_count, 1)

    def test_lost_deletes_row_without_storage_call(self):
        item = {"id": self.item_id, "type": "LOST", "image_path": None}
        with mock.patch.object(store, "_supabase_get", return_value=item), mock.patch.object(store, "_call", return_value=FakeResponse([{"id": self.item_id}])) as call:
            self.assertTrue(store._supabase_delete(self.item_id))
        self.assertEqual(call.call_count, 1)
        self.assertTrue(call.call_args.args[1].startswith("/rest/v1/items?"))

    def test_missing_row_skips_delete(self):
        with mock.patch.object(store, "_supabase_get", return_value=None), mock.patch.object(store, "_call") as call:
            self.assertFalse(store._supabase_delete(self.item_id))
        call.assert_not_called()


if __name__ == "__main__":
    unittest.main()
