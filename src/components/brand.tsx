import Link from "next/link";
import { RotateCcw } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 text-[var(--navy)]" aria-label="Back2U 홈">
      <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--blue)] text-white shadow-[0_5px_13px_rgba(0,122,255,.18)]">
        <RotateCcw size={21} strokeWidth={2.6} />
      </span>
      <span className={`font-extrabold tracking-[-0.06em] ${compact ? "text-xl" : "text-2xl"}`}>Back2U</span>
    </Link>
  );
}
