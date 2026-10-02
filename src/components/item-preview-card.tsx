import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { ItemArtwork } from "./item-artwork";
import type { PublicItem } from "@/lib/api";
import { itemCategoryLabel, itemLocation, itemRegisteredAt, itemTitle } from "@/lib/item-display";

// 홈용 축약 카드: 이미지 → 습득/분실 → 이름 → 장소 → 등록일만 보여주고 상세는 /items/[id]로 보낸다.
// 모바일은 가로형(썸네일 + 정보), md 이상은 세로형 카드.
export function ItemPreviewCard({ item }: { item: PublicItem }) {
  const found = item.type === "FOUND";
  return (
    <Link href={`/items/${item.id}`} className="group flex items-center gap-4 rounded-[20px] border border-[#e5eaf0] bg-white p-3 transition hover:-translate-y-0.5 hover:border-[#b9d3f0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)] md:block md:overflow-hidden md:p-0">
      <ItemArtwork item={item} className="aspect-[4/3] w-[132px] shrink-0 rounded-[14px] md:aspect-[16/10] md:w-full md:rounded-none" />
      <div className="min-w-0 flex-1 md:p-5">
        <div className="flex items-center gap-2 text-[13px]">
          <span className={`shrink-0 rounded-md px-2 py-0.5 font-semibold ${found ? "bg-[#e6f6f1] text-[#0f7a65]" : "bg-[#eaf3ff] text-[#0a6de0]"}`}>{found ? "습득물" : "분실물"}</span>
          <span className="truncate text-[#5b6b80]">{itemCategoryLabel(item)}</span>
        </div>
        <h3 className="mt-2 line-clamp-2 break-keep text-[16px] font-bold text-[var(--navy)] md:text-[18px]">{itemTitle(item)}</h3>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0 space-y-1 text-[14px] text-[#5b6b80]">
            <p className="flex items-center gap-1.5"><MapPin size={15} className="shrink-0" aria-hidden="true" /><span className="truncate">{itemLocation(item)}</span></p>
            <p className="flex items-center gap-1.5"><CalendarDays size={15} className="shrink-0" aria-hidden="true" />{itemRegisteredAt(item)}</p>
          </div>
          <ArrowRight size={18} className="hidden shrink-0 text-[var(--blue)] transition group-hover:translate-x-0.5 md:block" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}
