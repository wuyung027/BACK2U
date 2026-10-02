"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ListFilter, PackageOpen, Search, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ItemArtwork } from "@/components/item-artwork";
import { deleteItem, listItems, type PublicItem } from "@/lib/api";
import { itemCategoryLabel, itemGroup, itemGroups, itemHighlights, itemLocation, itemRegisteredAt, itemSearchText, itemTitle, type ItemGroup } from "@/lib/item-display";

type TypeFilter = "ALL" | "FOUND" | "LOST";
const typeFilters: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "전체" }, { value: "FOUND", label: "주운 물건" }, { value: "LOST", label: "잃어버린 물건" },
];
// 현재 데이터 규모에서는 최신 물건을 한 번에 받아 화면에서 검색·필터한다.
const LIST_LIMIT = 100;

export default function ItemsPage() {
  const [items, setItems] = useState<PublicItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const deletingRef = useRef<string | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("ALL");
  const [category, setCategory] = useState<"전체" | ItemGroup>("전체");

  useEffect(() => {
    let active = true;
    listItems({ limit: LIST_LIMIT })
      .then(({ items }) => { if (active) setItems(items); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko");
    return (items ?? []).filter((item) => (type === "ALL" || item.type === type) && (category === "전체" || itemGroup(item) === category) && (!keyword || itemSearchText(item).includes(keyword)));
  }, [items, query, type, category]);

  const resetFilters = () => { setQuery(""); setCategory("전체"); setType("ALL"); };

  const handleDelete = async (itemId: string) => {
    if (deletingRef.current || !window.confirm("이 물건을 삭제할까요?\n삭제한 물건은 복구할 수 없습니다.")) return;
    deletingRef.current = itemId;
    setDeletingId(itemId);
    setDeleteError("");
    try {
      await deleteItem(itemId);
      setItems((current) => current?.filter((item) => item.id !== itemId) ?? null);
      try {
        const latest = await listItems({ limit: LIST_LIMIT });
        setItems(latest.items);
      } catch {
        // 삭제는 완료됐으므로 다시 조회할 수 없어도 삭제된 카드는 되살리지 않는다.
      }
    } catch {
      setDeleteError("삭제하지 못했어요. 다시 시도해주세요.");
    } finally {
      deletingRef.current = null;
      setDeletingId(null);
    }
  };

  return <div className="app-shell"><AppHeader back="/" step="물건 목록" />
    <main className="mx-auto max-w-6xl px-5 pb-16 pt-5 sm:px-8"><div className="max-w-2xl"><span className="eyebrow"><ListFilter size={13} className="mr-1.5" /> BROWSE ITEMS</span><h1 className="mt-4 text-[30px] font-extrabold tracking-[-0.06em] sm:text-4xl">목록에서 직접 찾아보세요</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">AI 매칭을 기다리는 동안에도 물건, 장소, 종류로 살펴볼 수 있어요.</p></div>
      <section aria-label="목록 검색과 필터" className="phone-panel mt-7 rounded-[24px] p-4 sm:p-5"><div className="relative"><Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8498ad]" /><input type="search" aria-label="물건 검색" placeholder="물건 이름이나 장소를 검색해보세요" value={query} onChange={(event) => setQuery(event.target.value)} className="h-13 w-full rounded-xl border border-[#dae5f0] bg-[#fafdff] pl-11 pr-10 text-sm outline-none focus:border-[var(--blue)] focus:ring-4 focus:ring-[#007aff]/10" />{query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8397aa]"><X size={17} /></button>}</div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="등록 유형">{typeFilters.map((filter) => <button key={filter.value} type="button" onClick={() => setType(filter.value)} aria-pressed={type === filter.value} className={`rounded-full px-4 py-2 text-xs font-bold transition ${type === filter.value ? "bg-[var(--navy)] text-white" : "bg-[#eef3f8] text-[#60758b] hover:bg-[#e2ecf6]"}`}>{filter.label}</button>)}</div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="품목 분류">{itemGroups.map((name) => <button key={name} type="button" onClick={() => setCategory(name)} aria-pressed={category === name} className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${category === name ? "border-[var(--blue)] bg-[#eaf4ff] text-[var(--blue)]" : "border-[#e1e9f1] text-[#7d8fa2] hover:bg-[#f7faff]"}`}>{name}</button>)}</div>
      </section>
      <div className="mt-7 flex items-center justify-between gap-3"><h2 className="text-base font-extrabold">등록된 물건 {items && <span className="text-[var(--blue)]">{filtered.length}</span>}</h2><span className="text-[11px] font-semibold text-[#8da0b4]">최신 등록순</span></div>
      {deleteError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{deleteError}</p>}
      {failed ? <div role="alert" className="subtle-card mt-4 flex min-h-56 flex-col items-center justify-center px-5 text-center"><h3 className="text-sm font-bold">물건 목록을 불러오지 못했어요.</h3><p className="mt-2 text-xs text-[var(--muted)]">잠시 후 다시 시도해주세요.</p></div>
        : items === null ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true"><p className="sr-only">등록된 물건을 불러오고 있어요.</p>{Array.from({ length: 3 }, (_, index) => <div key={index} className="subtle-card flex gap-4 p-3 sm:block" aria-hidden="true"><div className="h-28 w-28 shrink-0 rounded-xl bg-[#eef2f7] sm:h-44 sm:w-full" /><div className="flex-1 space-y-2.5 py-1 sm:px-1 sm:pt-4"><div className="h-3.5 w-16 rounded bg-[#eef2f7]" /><div className="h-4 w-3/4 rounded bg-[#eef2f7]" /><div className="h-3.5 w-1/2 rounded bg-[#eef2f7]" /></div></div>)}</div>
        : items.length === 0 ? <div className="subtle-card mt-4 flex min-h-56 flex-col items-center justify-center px-5 text-center"><PackageOpen size={29} className="text-[#a2b5c9]" /><h3 className="mt-4 text-sm font-bold">아직 등록된 물건이 없어요.</h3><p className="mt-2 text-xs text-[var(--muted)]">분실했거나 주운 물건을 처음으로 등록해보세요.</p><div className="mt-4 flex flex-wrap justify-center gap-2"><Link href="/lost" className="rounded-xl bg-[var(--blue)] px-4 py-2.5 text-xs font-bold text-white">잃어버린 물건 등록</Link><Link href="/found" className="rounded-xl border border-[#cbe9df] bg-white px-4 py-2.5 text-xs font-bold text-[#0f7a65]">주운 물건 등록</Link></div></div>
        : filtered.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => {
          const highlights = itemHighlights(item);
          return <article key={item.id} className="group subtle-card p-3 transition hover:-translate-y-0.5 hover:border-[#b9d8fa] hover:shadow-[0_12px_28px_rgba(42,93,146,.08)]">
            <Link href={`/items/${item.id}`} className="flex min-w-0 gap-4 sm:block"><ItemArtwork item={item} className="h-28 w-28 shrink-0 rounded-xl sm:h-44 sm:w-full" /><div className="min-w-0 flex-1 py-1 sm:px-1 sm:pt-4"><div className="flex flex-wrap items-center gap-1.5"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.type === "FOUND" ? "bg-[#e7f8f1] text-[#24946f]" : "bg-[#eaf4ff] text-[var(--blue)]"}`}>{item.type === "FOUND" ? "습득물" : "분실물"}</span><span className="text-[10px] font-semibold text-[#8fa0b1]">{itemCategoryLabel(item)}</span></div><h3 className="mt-2 break-keep text-sm font-extrabold sm:text-base">{itemTitle(item)}</h3>{highlights.length > 0 && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[var(--muted)]">{highlights.join(", ")}</p>}<div className="mt-3 flex items-center justify-between text-[10px] text-[#8fa0b1]"><span>{itemLocation(item)} · {itemRegisteredAt(item)}</span><ArrowRight size={15} className="shrink-0 text-[var(--blue)] transition group-hover:translate-x-1" /></div></div></Link>
            <div className="mt-2 flex justify-end border-t border-[#edf1f6] pt-2"><button type="button" onClick={() => void handleDelete(item.id)} disabled={deletingId !== null} aria-label={`${itemTitle(item)} 삭제`} className="min-h-9 rounded-lg px-3 text-xs font-bold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50">{deletingId === item.id ? "삭제 중..." : "삭제"}</button></div>
          </article>;
        })}</div>
        : <div className="subtle-card mt-4 flex min-h-56 flex-col items-center justify-center px-5 text-center"><Search size={29} className="text-[#a2b5c9]" /><h3 className="mt-4 text-sm font-bold">검색 결과가 없어요</h3><p className="mt-2 text-xs text-[var(--muted)]">다른 이름이나 장소로 검색해보세요.</p><button type="button" onClick={resetFilters} className="mt-4 text-xs font-bold text-[var(--blue)] underline underline-offset-4">필터 초기화</button></div>}
      <p className="mt-7 text-center text-xs text-[var(--muted)]">목록에 없다면 <Link href="/lost" className="font-bold text-[var(--blue)] underline underline-offset-4">분실물을 등록</Link>하고 새 후보를 기다릴 수 있어요.</p>
    </main></div>;
}
