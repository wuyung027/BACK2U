"""
장소/시간 매칭 단위 테스트 (AI/임베딩 호출 없음).

실행: python -m unittest ai.test_matcher -v
"""

import unittest

from ai.matcher import calculate_match_score, location_similarity, time_similarity
from ai.schemas import ItemFeatures


class LocationSimilarityTest(unittest.TestCase):
    def test_same_place(self):
        self.assertEqual(location_similarity("공학관 1층", "공학관 1층"), 100.0)
        self.assertEqual(location_similarity("  공학관   1층 ", "공학관1층"), 100.0)
        self.assertEqual(location_similarity("공학관 B1층", "공학관 지하1층"), 100.0)

    def test_same_building_other_floor(self):
        self.assertGreaterEqual(location_similarity("공학관 1층", "공학관 2층"), 80.0)

    def test_building_contains_detail(self):
        self.assertGreaterEqual(location_similarity("공학관", "공학관 1층"), 80.0)

    def test_other_building_is_not_compared(self):
        self.assertIsNone(location_similarity("공학관 1층", "학생회관 1층"))

    def test_missing_location(self):
        self.assertIsNone(location_similarity("공학관 1층", None))


class TimeSimilarityTest(unittest.TestCase):
    def test_found_one_hour_after_lost(self):
        self.assertGreaterEqual(time_similarity("오늘 오후 3시쯤", "오후 4시경"), 90.0)
        self.assertGreaterEqual(time_similarity("15시", "16시"), 90.0)

    def test_half_hour(self):
        self.assertEqual(time_similarity("오후 3시", "오후 3시 30분"), 100.0)
        self.assertEqual(time_similarity("15:00", "15:30"), 100.0)
        self.assertEqual(time_similarity("3시 반", "4시"), 100.0)

    def test_few_hours(self):
        score = time_similarity("오전 11시", "오후 2시")
        self.assertGreaterEqual(score, 70.0)
        self.assertLess(score, 100.0)

    def test_longer_gap_scores_lower(self):
        self.assertLess(time_similarity("오전 9시", "오후 9시"), time_similarity("오전 9시", "오전 10시"))

    def test_missing_time(self):
        self.assertIsNone(time_similarity("오후 3시", None))
        self.assertIsNone(time_similarity(None, "오후 4시"))

    def test_unparseable_time(self):
        self.assertIsNone(time_similarity("아까쯤", "오후 4시"))
        self.assertIsNone(time_similarity("어제 저녁", "오늘"))

    def test_reversed_clock_without_dates_is_unknown(self):
        # 다음 날 습득했을 수도 있으므로 벌점 대신 판단 보류.
        self.assertIsNone(time_similarity("오후 5시", "오후 3시"))

    def test_reversed_clock_on_same_day_is_penalized(self):
        self.assertEqual(time_similarity("오늘 오후 5시", "오늘 오후 3시"), 0.0)

    def test_next_day(self):
        self.assertEqual(time_similarity("어제 오후 5시", "오늘 오후 3시"), 30.0)


class MatchScoreLocationTimeTest(unittest.TestCase):
    """category/features가 없으면 임베딩을 부르지 않으므로 결정적으로 검사할 수 있다."""

    def test_other_building_excluded_and_time_scored(self):
        lost = ItemFeatures(color="검정", location="공학관 1층", time_text="오늘 오후 3시쯤")
        found = ItemFeatures(color="검정", location="학생회관 1층", time_text="오후 4시경")
        result = calculate_match_score(lost, found)
        self.assertIsNone(result["reasons"]["location"])
        self.assertEqual(result["reasons"]["time"], 100.0)
        self.assertEqual(result["match_score"], 100.0)

    def test_response_shape_unchanged(self):
        result = calculate_match_score(ItemFeatures(), ItemFeatures())
        self.assertEqual(set(result), {"match_score", "reasons"})
        self.assertEqual(set(result["reasons"]), {"category", "features", "color", "ocr", "location", "time"})


if __name__ == "__main__":
    unittest.main()
