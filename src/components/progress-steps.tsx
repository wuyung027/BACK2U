const labels = ["등록", "AI 분석", "매칭", "연결"];

// compact: 제목보다 덜 눈에 띄도록 원·간격을 줄인 버전 (기존 화면은 기본값 유지)
export function ProgressSteps({ current, compact = false }: { current: number; compact?: boolean }) {
  return (
    <div className={`mx-auto flex max-w-[340px] items-start justify-between gap-1 ${compact ? "py-3" : "py-5"}`} aria-label={`${labels[current - 1]} 단계`}>
      {labels.map((label, index) => (
        <div className="flex min-w-0 flex-1 items-start" key={label}>
          <div className={`flex flex-col items-center ${compact ? "gap-1.5" : "gap-2"}`}>
            <span className={`flex items-center justify-center rounded-full text-xs font-bold ${compact ? "size-6" : "size-7"} ${index + 1 <= current ? "bg-[var(--blue)] text-white" : "bg-[#e8eef7] text-[#9caabd]"}`}>{index + 1}</span>
            <span className={`whitespace-nowrap font-semibold ${compact ? "text-xs" : "text-[11px]"} ${index + 1 <= current ? "text-[var(--navy)]" : "text-[#9caabd]"}`}>{label}</span>
          </div>
          {index < labels.length - 1 && <span className={`h-px flex-1 ${compact ? "mt-3" : "mt-3.5"} ${index + 1 < current ? "bg-[var(--blue)]" : "bg-[#dce5ef]"}`} />}
        </div>
      ))}
    </div>
  );
}
