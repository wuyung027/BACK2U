"use client";

import { useEffect, useState } from "react";
import { Check, Coffee, X } from "lucide-react";

export function RewardedAdDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [remaining, setRemaining] = useState(5);

  useEffect(() => {
    if (remaining === 0) return;
    const timer = window.setTimeout(() => setRemaining((time) => time - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102f50]/60 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="rewarded-ad-title" className="w-full max-w-sm overflow-hidden rounded-[26px] bg-white shadow-2xl">
      <div className="relative bg-gradient-to-br from-[#ffe9cc] to-[#f7ca9d] px-6 pb-7 pt-5 text-[#513820]"><div className="flex items-center justify-between"><span className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold">광고 시안 · 실제 제휴 아님</span><button type="button" onClick={onClose} aria-label="광고 닫기" className="flex size-8 items-center justify-center rounded-full bg-white/75"><X size={17} /></button></div>
        <div className="mt-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold">건국대학교 카페 레스티오</p><h2 id="rewarded-ad-title" className="mt-2 text-2xl font-black leading-tight tracking-tight">오늘의 작은 휴식,<br />레스티오에서</h2><p className="mt-3 text-xs font-semibold">건국대 캠퍼스 카페 광고 예시</p></div><div className="flex size-24 shrink-0 items-center justify-center rounded-[28px] bg-white/70"><Coffee size={51} strokeWidth={1.5} /></div></div>
      </div>
      <div className="p-6"><div className="flex items-center justify-between text-xs font-bold text-[var(--navy)]"><span>{remaining === 0 ? "광고 시청 데모 완료" : `광고 시청 데모 · ${remaining}초 남음`}</span>{remaining === 0 && <Check size={17} className="text-[#27af7f]" />}</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eaf0f7]"><div className="h-full rounded-full bg-[var(--blue)] transition-all duration-500" style={{ width: `${((5 - remaining) / 5) * 100}%` }} /></div>
        <button type="button" onClick={onComplete} disabled={remaining > 0} className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--blue)] text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#d8e3ef] disabled:text-[#8da0b4]">{remaining === 0 ? "데모 노출 부스트 적용하기" : "시청 후 부스트 적용 가능"}</button>
        <p className="mt-3 text-center text-[11px] leading-5 text-[var(--muted)]">시연용 광고입니다. 실제 광고 재생이나 푸시 알림 발송은 없습니다.</p>
      </div>
    </div>
  </div>;
}
