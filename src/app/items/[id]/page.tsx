"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Palette, ShieldCheck, Tag } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ItemArtwork } from "@/components/item-artwork";
import { InfoRow } from "@/components/info-row";
import { ManualClaim } from "@/components/manual-claim";
import { ApiError, deleteItem, getItem, type PublicItem } from "@/lib/api";
import { itemCategoryLabel, itemHighlights, itemLocation, itemRegisteredAt, itemTitle } from "@/lib/item-display";

const demoWallet: PublicItem = {
  id: "found-wallet",
  type: "FOUND",
  name: "검은색 카드지갑 (시연용)",
  image_url: null,
  features: { category: "카드지갑", color: "검정", material: "가죽", location: "학생회관 1층" },
  created_at: "2026-09-14T00:00:00+09:00",
};

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<PublicItem | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDelete = async () => {
    if (deleting || !window.confirm("이 물건을 삭제할까요?\n삭제한 물건은 복구할 수 없습니다.")) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteItem(id);
      router.push("/items");
    } catch {
      setDeleteError("삭제하지 못했어요. 다시 시도해주세요.");
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (id === "found-wallet") return;
    let active = true;
    getItem(id)
      .then((result) => { if (active) setItem(result); })
      .catch((err) => { if (active) setError(err instanceof ApiError && err.kind === "not-found" ? "등록된 물건을 찾을 수 없어요." : "물건 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요."); });
    return () => { active = false; };
  }, [id]);

  const displayedItem = id === "found-wallet" ? demoWallet : item;
  const found = displayedItem?.type === "FOUND";
  const highlights = displayedItem ? itemHighlights(displayedItem) : [];

  return <div className="app-shell"><AppHeader back="/items" step="물건 상세" /><main className="mx-auto max-w-4xl px-5 pb-16 pt-6 sm:px-8"><Link href="/items" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--blue)]"><ArrowLeft size={15} /> 목록으로 돌아가기</Link>
    {error ? <div role="alert" className="phone-panel mt-5 rounded-[26px] px-6 py-14 text-center"><p className="text-sm font-bold">{error}</p><Link href="/items" className="mt-4 inline-block text-xs font-bold text-[var(--blue)] underline underline-offset-4">목록 보기</Link></div>
      : !displayedItem ? <div className="phone-panel mt-5 rounded-[26px] px-6 py-14 text-center text-sm text-[var(--muted)]" aria-busy="true">물건 정보를 불러오고 있어요.</div>
      : <div className="phone-panel mt-5 overflow-hidden rounded-[26px] sm:grid sm:grid-cols-[.95fr_1.05fr]"><ItemArtwork item={displayedItem} className="h-64 w-full sm:h-full sm:min-h-[420px]" /><section className="p-6 sm:p-8"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${found ? "bg-[#e7f8f1] text-[#24946f]" : "bg-[#eaf4ff] text-[var(--blue)]"}`}>{found ? "습득물" : "분실물"}</span><h1 className="mt-5 break-keep text-2xl font-extrabold tracking-tight sm:text-3xl">{itemTitle(displayedItem)}</h1>{highlights.length > 0 && <p className="mt-3 text-sm leading-7 text-[#61758c]">{highlights.join(", ")}</p>}<div className="mt-7 border-t border-[#e8eef5] pt-2"><InfoRow icon={<Tag size={16} />} label="품목" value={itemCategoryLabel(displayedItem)} />{displayedItem.features?.color && <InfoRow icon={<Palette size={16} />} label="색상" value={displayedItem.features.color} />}<InfoRow icon={<MapPin size={16} />} label="장소" value={itemLocation(displayedItem)} /><InfoRow icon={<CalendarDays size={16} />} label="등록일" value={itemRegisteredAt(displayedItem)} /></div><div className="mt-6 flex items-start gap-2 rounded-xl bg-[#f0f7ff] p-4 text-xs leading-5 text-[#5b7793]"><ShieldCheck size={18} className="shrink-0 text-[var(--blue)]" /> 소유권 확인 전에는 등록자의 연락처가 공개되지 않습니다.{id === "found-wallet" ? " 이 게시물은 시연용입니다." : ""}</div>{id !== "found-wallet" && <Link href={found ? "/lost" : "/found"} className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-[var(--navy)] px-4 text-sm font-bold text-white">{found ? "내 물건 같다면 분실물 등록하기 →" : "이 물건을 주웠다면 습득물 등록하기 →"}</Link>}</section></div>}
    {displayedItem && id !== "found-wallet" && <div className="mt-4 flex justify-end"><button type="button" onClick={() => void handleDelete()} disabled={deleting} className="min-h-10 rounded-xl border border-red-200 px-4 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50">{deleting ? "삭제 중..." : "삭제"}</button></div>}
    {deleteError && <p role="alert" className="mt-2 text-right text-xs font-semibold text-red-600">{deleteError}</p>}
    {id === "found-wallet" && <ManualClaim itemId={id} />}
  </main></div>;
}
