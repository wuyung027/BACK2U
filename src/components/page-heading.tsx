import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="text-center">
    <span className="eyebrow">{eyebrow}</span>
    <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.055em] text-[var(--navy)] sm:text-4xl">{title}</h1>
    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--muted)] sm:text-base">{children}</p>
  </div>;
}
