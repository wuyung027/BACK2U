"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/about", label: "서비스 소개" },
  { href: "/guide", label: "이용 방법" },
  { href: "/faq", label: "자주 묻는 질문" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="주요 메뉴" className="flex w-full gap-6 sm:w-auto sm:gap-9">
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`border-b-2 py-1.5 text-[15px] transition hover:text-[var(--navy)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--blue)] ${active ? "border-[var(--blue)] font-semibold text-[var(--navy)]" : "border-transparent text-[#5b6b80]"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
