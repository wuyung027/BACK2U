"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ItemPreviewCard } from "./item-preview-card";
import { listItems, type PublicItem } from "@/lib/api";

const RECENT_LIMIT = 3;

// 홈의 최근 등록된 물건. Hero는 바로 그리고 이 섹션만 따로 불러온다 (화면에 들어올 때마다 최신 데이터).
export function RecentItems() {
  const [items, setItems] = useState<PublicItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    listItems({ limit: RECENT_LIMIT })
      .then(({ items }) => { if (active) setItems(items); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  return <section aria-labelledby="items-title" className="border-t border-[#e3eaf3] pb-20 pt-12">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id="items-title" className="text-[26px] font-bold tracking-tight text-[var(--navy)]">최근 등록된 물건</h2>
        <p className="mt-1.5 break-keep text-[16px] text-[#5b6b80]">캠퍼스에서 등록된 분실물과 습득물을 확인해보세요.</p>
      </div>
      <Link href="/items" className="inline-flex w-fit items-center gap-1.5 rounded py-1 text-[15px] font-semibold text-[var(--blue)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]">전체 물건 보기 <ArrowRight size={17} aria-hidden="true" /></Link>
    </div>

    {failed ? <p role="alert" className="mt-7 rounded-[20px] border border-[#e5eaf0] bg-white px-6 py-8 text-center text-[15px] leading-7 text-[#5b6b80]">물건 목록을 불러오지 못했어요.<br />잠시 후 다시 시도해주세요.</p>
      : items === null ? <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-5" aria-busy="true">
          <p className="sr-only">등록된 물건을 불러오고 있어요.</p>
          {Array.from({ length: RECENT_LIMIT }, (_, index) => <div key={index} className="flex gap-4 rounded-[20px] border border-[#e5eaf0] bg-white p-3 md:block md:p-0" aria-hidden="true"><div className="aspect-[4/3] w-[132px] shrink-0 rounded-[14px] bg-[#eef2f7] md:aspect-[16/10] md:w-full md:rounded-none md:rounded-t-[20px]" /><div className="flex-1 space-y-2.5 py-2 md:p-5"><div className="h-4 w-16 rounded bg-[#eef2f7]" /><div className="h-5 w-3/4 rounded bg-[#eef2f7]" /><div className="h-4 w-1/2 rounded bg-[#eef2f7]" /></div></div>)}
        </div>
      : items.length === 0 ? <div className="mt-7 rounded-[20px] border border-[#e5eaf0] bg-white px-6 py-9 text-center">
          <p className="text-[17px] font-bold text-[var(--navy)]">아직 등록된 물건이 없어요.</p>
          <p className="mt-1.5 text-[15px] text-[#5b6b80]">분실했거나 주운 물건을 처음으로 등록해보세요.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Link href="/lost" className="rounded-[12px] bg-[#0a6de0] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#075fc4]">잃어버린 물건 등록</Link>
            <Link href="/found" className="rounded-[12px] border border-[#d5e9e2] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#0f7a65] hover:border-[#9fd6c6]">주운 물건 등록</Link>
          </div>
        </div>
      : <ul className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-5">{items.map((item) => <li key={item.id}><ItemPreviewCard item={item} /></li>)}</ul>}
  </section>;
}
