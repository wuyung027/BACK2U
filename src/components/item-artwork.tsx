"use client";

import Image from "next/image";
import { useState } from "react";
import { BookOpen, Headphones, KeyRound, Package, ShoppingBag, Smartphone, Umbrella, Wallet, Watch } from "lucide-react";
import type { PublicItem } from "@/lib/api";
import { itemCategoryText, itemTitle } from "@/lib/item-display";

// 사진이 있으면(주로 습득물) 만료 시간이 있는 Supabase 사진을, 없으면 물품 종류에 맞는 아이콘 그림을 보여준다.
const visuals = [
  { rule: /지갑|카드|학생증|신분증/, icon: Wallet, background: "bg-[#e9eef4]", color: "text-[#3d4f63]" },
  { rule: /이어폰|에어팟|버즈|헤드폰|헤드셋/, icon: Headphones, background: "bg-[#e8f3ff]", color: "text-[#327fca]" },
  { rule: /우산/, icon: Umbrella, background: "bg-[#e8efff]", color: "text-[#4b63b7]" },
  { rule: /열쇠|키링/, icon: KeyRound, background: "bg-[#f4ecdf]", color: "text-[#a8814d]" },
  { rule: /폰|전화/, icon: Smartphone, background: "bg-[#e7eef4]", color: "text-[#50677d]" },
  { rule: /가방|백팩|에코백|파우치/, icon: ShoppingBag, background: "bg-[#f7eddf]", color: "text-[#b2895a]" },
  { rule: /책|노트|공책/, icon: BookOpen, background: "bg-[#e6f1ff]", color: "text-[#3879bc]" },
  { rule: /시계|워치/, icon: Watch, background: "bg-[#e9eff2]", color: "text-[#536d7c]" },
];
const fallback = { icon: Package, background: "bg-[#eef2f7]", color: "text-[#6b7f95]" };

export function ItemArtwork({ item, className = "" }: { item: PublicItem; className?: string }) {
  const title = itemTitle(item);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (item.image_url && failedUrl !== item.image_url) {
    return <div className={`relative overflow-hidden bg-[#e9eef4] ${className}`}><Image src={item.image_url} alt={`${title} 사진`} fill unoptimized sizes="(max-width: 768px) 140px, 380px" className="object-cover" onError={() => setFailedUrl(item.image_url ?? null)} /></div>;
  }
  const source = `${itemCategoryText(item)} ${item.name ?? ""}`;
  const { icon: Icon, background, color } = visuals.find(({ rule }) => rule.test(source)) ?? fallback;
  return <div className={`flex items-center justify-center ${background} ${color} ${className}`} role="img" aria-label={`${title} 그림`}><Icon size={52} strokeWidth={1.5} /></div>;
}
