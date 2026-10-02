import { Coffee } from "lucide-react";

export function SponsorBanner() {
  return <section aria-label="예시 광고" className="relative overflow-hidden rounded-[22px] border border-[#f0dfcb] bg-gradient-to-r from-[#fff7e8] via-[#fff4e1] to-[#ffe8ce] p-5 sm:p-6">
    <div className="absolute -right-8 -top-12 size-44 rounded-full bg-white/35" />
    <div className="relative flex items-center justify-between gap-4">
      <div className="min-w-0"><span className="inline-flex items-center gap-1 rounded-full border border-[#e6cbaa] bg-white/70 px-2 py-1 text-[10px] font-bold text-[#91663d]">광고 시안 · 실제 제휴 아님</span>
        <p className="mt-3 text-xs font-semibold text-[#9a6c41]">건국대학교 카페 레스티오</p><h2 className="mt-1 text-lg font-extrabold leading-snug tracking-tight text-[#513820] sm:text-xl">찾는 동안,<br />잠깐 쉬어가요 ☕</h2>
        <p className="mt-2 text-[11px] font-semibold text-[#875e37]">레스티오에서 만나는 한 잔의 여유</p>
      </div>
      <div aria-hidden="true" className="relative flex size-24 shrink-0 items-center justify-center rounded-[28px] bg-white/75 shadow-[0_12px_25px_rgba(120,83,40,.12)] sm:size-28"><div className="flex size-16 items-center justify-center rounded-2xl bg-[#eac39b] text-[#6c4325] sm:size-20"><Coffee size={37} strokeWidth={1.6} /></div></div>
    </div>
  </section>;
}
