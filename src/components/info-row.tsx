import type { ReactNode } from "react";

export function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 border-b border-[#e9eef4] py-3 last:border-0">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#edf5ff] text-[var(--blue)]">{icon}</span>
    <span className="w-20 shrink-0 text-xs font-semibold text-[var(--muted)]">{label}</span>
    <span className="min-w-0 flex-1 text-sm font-bold text-[var(--navy)]">{value}</span>
  </div>;
}
