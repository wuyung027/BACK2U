// score가 null이면 비교할 정보가 없다는 뜻이다. 0%로 표시하지 않는다.
export type MatchReason = { label: string; score: number | null; detail: string };

export function MatchReasonBar({ reason }: { reason: MatchReason }) {
  const available = reason.score !== null;
  return <div className="grid grid-cols-[86px_1fr_52px] items-center gap-3 sm:grid-cols-[120px_1fr_60px]">
    <span className={`text-xs font-semibold sm:text-sm ${available ? "text-[#52657d]" : "text-[#a5b2c1]"}`}>{reason.label}</span>
    {available ? <div className="h-2.5 overflow-hidden rounded-full bg-[#eaf0f7]" role="progressbar" aria-label={reason.label} aria-valuenow={reason.score ?? 0} aria-valuemin={0} aria-valuemax={100} title={reason.detail}>
      <div className="h-full rounded-full bg-gradient-to-r from-[#007aff] to-[#5bacff]" style={{ width: `${reason.score}%` }} />
    </div> : <div className="h-2.5 rounded-full border border-dashed border-[#dbe4ee]" title={reason.detail} />}
    <strong className={`text-right text-xs sm:text-sm ${available ? "text-[var(--navy)]" : "font-semibold text-[#a5b2c1]"}`}>{available ? `${reason.score}%` : "정보 없음"}</strong>
  </div>;
}
