import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export function ActionButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <button {...props} className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--navy)] px-5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(13,50,92,.12)] transition hover:bg-[#164b88] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>{children}<ArrowRight size={18} /></button>;
}
