"""
장소/시간 매칭 단위 테스트 (AI/임베딩 호출 없음).

실행: python -m unittest ai.test_matcher -v
"""

import unittest
from dataclasses import replace
from unittest import mock

from ai.matcher import (
    calculate_match_score,
    categories_compatible,
    location_similarity,
    match_candidate,
    time_similarity,
)
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


class CategoryCompatibilityTest(unittest.TestCase):
    def _compatible(self, lost_category, found_category, found_keywords=()):
        return categories_compatible(
            ItemFeatures(category=lost_category),
            ItemFeatures(category=found_category, keywords=list(found_keywords)),
        )

    def test_obvious_mismatch(self):
        # 휴대폰↔무선 이어폰은 운영 데이터에서 임베딩만으로 100점이 나왔던 쌍이다.
        for lost, found in [("글러브", "포스터"), ("지갑", "무선 이어폰"), ("텀블러", "접이식 우산"), ("휴대폰", "파우치"), ("휴대폰", "무선 이어폰")]:
            with self.subTest(lost=lost, found=found):
                self.assertFalse(self._compatible(lost, found))

    def test_synonym_and_subtype(self):
        for lost, found in [("카드지갑", "지갑"), ("AirPods", "무선 이어폰"), ("에어팟", "이어폰"), ("우산", "접이식 우산"), ("텀블러", "물병"), ("키링", "열쇠고리")]:
            with self.subTest(lost=lost, found=found):
                self.assertTrue(self._compatible(lost, found))

    def test_found_keywords_count_as_item_names(self):
        # 습득자가 입력한 습득물명은 keywords 맨 앞에 들어간다.
        self.assertTrue(self._compatible("에어팟", "파우치", ["에어팟 케이스"]))

    def test_missing_or_unlisted_category_is_not_gated(self):
        for lost, found in [(None, "포스터"), ("글러브", None), ("", "포스터"), ("unknown", "포스터"), ("충전기", "포스터")]:
            with self.subTest(lost=lost, found=found):
                self.assertTrue(self._compatible(lost, found))


@mock.patch("ai.matcher.is_mock_mode", return_value=True)
class MatchCandidateTest(unittest.TestCase):
    """임베딩 대신 문자열 유사도(Mock)로 점수를 내므로 결정적으로 검사할 수 있다."""

    def test_glove_vs_poster_with_same_place_and_time(self, _):
        # 실제 오매칭 사례: 장소·시간 점수만으로 52%가 나와 후보로 보였다.
        lost = ItemFeatures(category="글러브", color="검정", location="건국체육관", time_text="오후 4시쯤")
        found = ItemFeatures(category="포스터", color="분홍", location="건국체육관", time_text="오후 5시", keywords=["분홍색 포스터"])
        self.assertIsNone(match_candidate(lost, found))

    def test_wallet_vs_earphones(self, _):
        lost = ItemFeatures(category="지갑", color="흰색", location="학생회관 1층")
        found = ItemFeatures(category="무선 이어폰", color="흰색", location="학생회관 1층", keywords=["무선 이어폰"])
        self.assertIsNone(match_candidate(lost, found))

    def test_bottle_vs_umbrella(self, _):
        lost = ItemFeatures(category="텀블러", color="갈색", location="도서관 입구")
        found = ItemFeatures(category="접이식 우산", color="갈색", location="도서관 입구", keywords=["접이식 우산"])
        self.assertIsNone(match_candidate(lost, found))

    def test_compatible_pairs_are_kept(self, _):
        pairs = {
            "card wallet": (
                ItemFeatures(category="카드지갑", color="검정", keywords=["학생증"]),
                ItemFeatures(category="지갑", color="검은색", keywords=["검정 지갑"]),
            ),
            "airpods": (
                ItemFeatures(category="AirPods", color="흰색", location="학생회관 1층"),
                ItemFeatures(category="무선 이어폰", color="흰색", location="학생회관 1층", keywords=["무선 이어폰"]),
            ),
            "umbrella": (
                ItemFeatures(category="우산", location="도서관 입구"),
                ItemFeatures(category="접이식 우산", color="갈색", location="도서관 입구", keywords=["접이식 우산"]),
            ),
            "tumbler": (
                ItemFeatures(category="텀블러", color="파랑", location="중앙도서관 2층"),
                ItemFeatures(category="물병", color="파란색", location="중앙도서관 2층", keywords=["물병"]),
            ),
            "keyring": (
                ItemFeatures(category="키링", location="공학관 앞"),
                ItemFeatures(category="열쇠고리", location="공학관 앞", keywords=["열쇠고리"]),
            ),
            "glove": (
                ItemFeatures(category="글러브", color="검정"),
                ItemFeatures(category="격투기 글러브", color="검정", keywords=["ufc 글러브"]),
            ),
        }
        for name, (lost, found) in pairs.items():
            with self.subTest(name):
                self.assertIsNotNone(match_candidate(lost, found))

    def test_missing_category_is_scored_not_rejected(self, _):
        lost = ItemFeatures(color="검정", location="건국체육관")
        found = ItemFeatures(category="포스터", color="검정", location="건국체육관")
        self.assertIsNotNone(match_candidate(lost, found))

    def test_too_low_score_is_excluded(self, _):
        # 같은 계열이어도 색이 다르고 같은 날 분실보다 먼저 습득됐다면 근거가 없다.
        lost = ItemFeatures(category="텀블러", color="회색", time_text="오늘 오후 5시")
        found = ItemFeatures(category="물병", color="파랑", time_text="오늘 오후 3시")
        self.assertIsNone(match_candidate(lost, found))


# 운영 데이터에서 실제 임베딩으로 관찰한 점수: 색상 단어가 다른 물품명과도 높게 나온다.
_OBSERVED_SEMANTIC = {
    frozenset(("텀블러", "갈색")): 55.9,
    frozenset(("텀블러", "파란색")): 65.3,
    frozenset(("지갑", "갈색")): 54.9,
}
_UNRELATED = 20.0


def _observed_semantic(pairs):
    return [100.0 if a == b else _OBSERVED_SEMANTIC.get(frozenset((a, b)), _UNRELATED) for a, b in pairs]


@mock.patch("ai.matcher.semantic_similarities", side_effect=_observed_semantic)
class CategoryEvidenceIsolationTest(unittest.TestCase):
    """category 점수는 물품 종류(category)끼리만 비교한다. 색상·keywords·특징은 각자의 항목에서만 반영된다."""

    def _category(self, lost, found):
        return calculate_match_score(lost, found)["reasons"]["category"]

    def test_same_color_does_not_raise_category(self, _):
        lost = ItemFeatures(category="텀블러", color="갈색")
        found = ItemFeatures(category="안경", color="갈색", keywords=["안경", "갈색"])
        reasons = calculate_match_score(lost, found)["reasons"]
        self.assertEqual(reasons["category"], _UNRELATED)
        self.assertEqual(reasons["color"], 100.0)
        self.assertIsNone(match_candidate(lost, found))

    def test_color_mismatch_does_not_lower_category(self, _):
        lost = ItemFeatures(category="텀블러", color="검정")
        found = ItemFeatures(category="텀블러", color="갈색", keywords=["텀블러", "갈색"])
        reasons = calculate_match_score(lost, found)["reasons"]
        self.assertEqual(reasons["category"], 100.0)
        self.assertEqual(reasons["color"], 0.0)

    def test_shared_keyword_does_not_raise_category(self, _):
        lost = ItemFeatures(category="지갑", keywords=["갈색", "가죽"])
        found = ItemFeatures(category="안경", keywords=["갈색"])
        self.assertEqual(self._category(lost, found), _UNRELATED)

    def test_shared_distinctive_feature_does_not_raise_category(self, _):
        lost = ItemFeatures(category="안경", distinctive_features=["검은 테두리"])
        found = ItemFeatures(category="파우치", distinctive_features=["검은 테두리"])
        self.assertEqual(self._category(lost, found), _UNRELATED)

    def test_category_is_invariant_to_other_fields(self, _):
        lost = ItemFeatures(category="텀블러", color="회색")
        found = ItemFeatures(category="물병", color="회색", keywords=["물병"])
        base = self._category(lost, found)
        variants = {
            "color": (lost, replace(found, color="파란색")),
            "keywords": (lost, replace(found, keywords=["물병", "파란색"])),
            "distinctive_features": (lost, replace(found, distinctive_features=["파란색 뚜껑"])),
            "lost keywords": (replace(lost, keywords=["갈색"]), found),
            "ocr/location/time": (lost, replace(found, ocr_text="텀블러", location="공학관", time_text="오후 3시")),
        }
        for name, (lost_variant, found_variant) in variants.items():
            with self.subTest(name):
                self.assertAlmostEqual(self._category(lost_variant, found_variant), base, places=6)


if __name__ == "__main__":
    unittest.main()
