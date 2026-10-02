"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, Check, Eye, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ProgressSteps } from "@/components/progress-steps";
import { SponsorBanner } from "@/components/sponsor-banner";
import { RewardedAdDialog } from "@/components/rewarded-ad-dialog";
import { useRegistrationStore } from "@/store/use-registration-store";

export default function WaitingPage() {
  const [adOpen, setAdOpen] = useState(false);
  const boosted = useRegistrationStore((s) => s.exposureBoosted);
  const setBoosted = useRegistrationStore((s) => s.setExposureBoosted);
  const lostItem = useRegistrationStore((s) => s.lostItem);
  const foundPreview = useRegistrationStore((s) => s.foundPreview);
  const foundPhotoName = useRegistrationStore((s) => s.foundPhotoName);
  const itemName = lostItem ? [lostItem.features.color, lostItem.features.category].filter(Boolean).join(" ") || "등록한 분실물" : foundPhotoName ? "사진으로 등록한 습득물" : "아직 등록한 물건이 없어요";
  const matchId = lostItem?.id ?? foundPreview?.itemId;

  return <div className="app-shell"><AppHeader back="/" step="STEP 03 · 매칭 대기" />
    <main className="mx-auto max-w-5xl px-5 pb-16 pt-2 sm:px-8"><ProgressSteps current={3} />
      <div className="mx-auto mt-5 max-w-3xl text-center"><span className="eyebrow"><Sparkles size={13} className="mr-1.5" /> AI MATCHING</span><h1 className="mt-4 text-[29px] font-extrabold tracking-[-0.06em] sm:text-4xl">Back2U가 찾고 있어요.</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">등록된 물건의 단서를 비교하고 있어요.<br className="sm:hidden" /> 새 후보가 생기면 다시 확인할 수 있어요.</p></div>
      <div className="mx-auto mt-8 grid max-w-4xl items-start gap-5 lg:grid-cols-[1fr_.84fr]">
        <section className="phone-panel overflow-hidden rounded-[26px] p-5 text-center sm:p-7"><div className="relative mx-auto flex size-52 items-center justify-center sm:size-60"><span className="pulse-ring absolute size-full rounded-full bg-[#d8eaff]" /><span className="pulse-ring absolute size-[72%] rounded-full bg-[#bcd9ff] [animation-delay:.3s]" /><span className="pulse-ring absolute size-[47%] rounded-full bg-[#8dbfff] [animation-delay:.6s]" /><span className="relative flex size-20 items-center justify-center rounded-full bg-[var(--blue)] text-white shadow-[0_12px_30px_rgba(0,122,255,.26)]"><Radar size={35} /></span></div>
          <h2 className="mt-3 text-lg font-extrabold">비슷한 물건을 비교 중이에요</h2><p className="mt-2 text-xs text-[var(--muted)]">사진 · 설명 · 글자 · 위치와 시간을 함께 살펴봐요.</p>
          <div className="mt-6 space-y-3 text-left"><div className="flex items-center justify-between rounded-xl border border-[#e5edf5] p-3"><div className="flex items-center gap-2 text-xs font-bold"><span className="flex size-8 items-center justify-center rounded-lg bg-[#eaf4ff] text-[var(--blue)]"><Eye size={17} /></span>{itemName}</div><span className="text-[10px] font-bold text-[#7d91a8]">등록물</span></div><div className="flex items-center gap-2 rounded-xl border border-[#e5edf5] p-3 text-xs font-semibold text-[#637992]"><span className="flex size-8 items-center justify-center rounded-lg bg-[#e7f7f1] text-[#27ab82]"><Check size={17} /></span>새로운 후보와 계속 비교할 준비가 됐어요.</div></div>
          {matchId ? <Link href={`/match/${matchId}`} className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-[var(--navy)] px-4 text-sm font-bold text-white">지금까지의 매칭 결과 보기 →</Link> : <Link href="/lost" className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-[var(--navy)] px-4 text-sm font-bold text-white">분실물 등록하러 가기 →</Link>}<Link href="/items" className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-[#cbdff3] text-xs font-bold text-[var(--blue)]">기다리는 동안 목록에서 찾기</Link><p className="mt-3 text-[11px] text-[#96a6b6]">새 물건이 등록되면 매칭 결과에서 다시 확인할 수 있어요.</p>
        </section>
        <div className="space-y-5"><SponsorBanner /><section className="subtle-card p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf4ff] text-[var(--blue)]"><BellRing size={20} /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-extrabold">노출 부스트</h2><span className="rounded-full bg-[#eaf4ff] px-2 py-1 text-[10px] font-bold text-[var(--blue)]">선택 사항</span></div><p className="mt-1 text-xs leading-5 text-[var(--muted)]">짧은 광고를 보고 등록물 알림을 한 번 더 널리 알리는 기능을 체험해보세요.</p></div></div>
            {boosted ? <div role="status" className="mt-5 flex items-start gap-2 rounded-xl bg-[#e9f9f2] p-4 text-xs font-bold leading-5 text-[#218c68]"><Check size={17} className="shrink-0" /> 데모 노출 부스트가 적용됐어요. 실제 푸시 알림은 발송되지 않았습니다.</div> : <button type="button" onClick={() => setAdOpen(true)} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-[#bad6fb] bg-[#eef6ff] px-4 text-sm font-bold text-[var(--blue)] transition hover:bg-[#e1f0ff]">예시 광고 보고 부스트 켜기 →</button>}
            <p className="mt-3 flex gap-2 text-[11px] leading-5 text-[#8da0b4]"><ShieldCheck size={15} className="mt-0.5 shrink-0" /> 광고 시청과 부스트는 완전히 선택 사항입니다. 매칭 순위에는 영향을 주지 않아요.</p>
          </section></div>
      </div>
    </main>{adOpen && <RewardedAdDialog onClose={() => setAdOpen(false)} onComplete={() => { setBoosted(true); setAdOpen(false); }} />}</div>;
}
