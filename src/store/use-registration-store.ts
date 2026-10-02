import { create } from "zustand";
import type { Item } from "@/lib/api";

// 습득물 원본 사진은 서버에 남지 않으므로, 이번 브라우저 세션의 미리보기만 매칭 화면에서 재사용한다.
type FoundPreview = { itemId: string; url: string };

type RegistrationState = {
  // 마지막으로 등록에 성공한 분실물 (/waiting → /match 연결용). /lost 폼의 작성 중 state는 화면 로컬에 둔다.
  lostItem: Item | null;
  foundPhotoName: string | null;
  foundPreview: FoundPreview | null;
  exposureBoosted: boolean;
  setLostItem: (item: Item | null) => void;
  setFoundPhotoName: (name: string | null) => void;
  setFoundPreview: (preview: FoundPreview | null) => void;
  setExposureBoosted: (boosted: boolean) => void;
};

export const useRegistrationStore = create<RegistrationState>((set, get) => ({
  lostItem: null,
  foundPhotoName: null,
  foundPreview: null,
  exposureBoosted: false,
  setLostItem: (lostItem) => set({ lostItem }),
  setFoundPhotoName: (foundPhotoName) => set({ foundPhotoName }),
  setFoundPreview: (foundPreview) => {
    const previous = get().foundPreview;
    if (previous && previous.url !== foundPreview?.url) URL.revokeObjectURL(previous.url);
    set({ foundPreview });
  },
  setExposureBoosted: (exposureBoosted) => set({ exposureBoosted }),
}));
