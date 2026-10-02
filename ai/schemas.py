from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class ItemFeatures:
    """
    분실 텍스트와 습득 사진을
    공통된 형태로 변환하기 위한 Back2U 표준 스키마.
    """

    category: Optional[str] = None
    color: Optional[str] = None
    material: Optional[str] = None
    brand: Optional[str] = None

    location: Optional[str] = None
    time_text: Optional[str] = None

    ocr_text: Optional[str] = None

    keywords: list[str] = field(default_factory=list)
    distinctive_features: list[str] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)