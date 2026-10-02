import json
import sys
from pathlib import Path

from ai.feature_extractor import (
    _mock_found_features,
    extract_lost_features,
    extract_found_features,
)
from ai.matcher import calculate_match_score
from ai.provider import is_mock_mode


LOST_TEXTS = [
    ("wallet", """
오늘 오후 3시쯤 공학관 1층에서 검은색 카드지갑을 잃어버렸어요.
안에는 학생증과 체크카드가 있습니다.
"""),
    ("airpods", """
에어팟 케이스를 도서관에서 잃어버렸어요.
흰색이고 오른쪽 아래에 작은 스크래치가 있어요.
"""),
]


def dump(data) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


mode = "MOCK (실제 AI 결과 아님)" if is_mock_mode() else "REAL API"
print(f"=== AI MODE: {mode} ===")

# 사용법: python -m ai.test_ai [이미지경로 ...]
# 이미지 경로가 없으면 습득물은 Mock 결과로 대체한다.
image_paths = sys.argv[1:]


lost_list = []
for name, lost_text in LOST_TEXTS:
    lost = extract_lost_features(lost_text)
    lost_list.append((name, lost))

    print(f"\n=== LOST {name} INPUT ===")
    print(lost_text.strip())

    print(f"\n=== LOST {name} FEATURES ===")
    print(dump(lost.to_dict()))


if image_paths:
    found_list = [
        (Path(path).stem, extract_found_features(path))
        for path in image_paths
    ]
else:
    print("\n(이미지 경로가 없어 습득물은 MOCK 결과를 사용합니다. "
          "예: python -m ai.test_ai ai/test_images/wallet.jpg)")
    found_list = [("MOCK", _mock_found_features())]


comparison = []
for found_name, found in found_list:
    print(f"\n=== FOUND {found_name} FEATURES ===")
    print(dump(found.to_dict()))

    for lost_name, lost in lost_list:
        result = calculate_match_score(
            lost,
            found,
        )
        comparison.append((lost_name, found_name, result))

        print(f"\n=== MATCH: {lost_name} -> {found_name} ===")
        print(dump(result))


print(f"\n=== MATCH COMPARISON ({mode}) ===")
for lost_name, found_name, result in comparison:
    print(f"{lost_name} -> {found_name}: {result['match_score']}")
