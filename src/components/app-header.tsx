import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "./brand";
import { AuthStatus } from "./auth-status";
import { SiteNav } from "./site-nav";

// showAuth: 카카오 로그인이 실제로 연결되기 전까지는 기본 숨김. 구현 후 홈에서 showAuth로 다시 노출한다.
// wide: 홈처럼 본문 폭이 넓은 화면에서 로고 정렬을 맞출 때만 사용
// nav: 홈·안내 페이지에서만 서비스 소개/이용 방법/FAQ 메뉴를 보여준다 (모바일은 로고 아래 줄)
export function AppHeader({ back, step, showAuth = false, wide = false, nav = false }: { back?: string; step?: string; showAuth?: boolean; wide?: boolean; nav?: boolean }) {
  return (
    <header className={`mx-auto flex w-full ${wide ? "max-w-[1240px]" : "max-w-6xl"} items-center justify-between px-5 py-5 sm:px-8 ${nav ? "flex-wrap gap-y-4" : ""}`}>
      <div className="flex items-center gap-3">
        {back && <Link href={back} aria-label="뒤로 가기" className="icon-button"><ArrowLeft size={20} /></Link>}
        <Brand compact={Boolean(back)} />
      </div>
      {step ? <span className="rounded-full bg-[#eef5ff] px-3 py-1.5 text-xs font-bold text-[var(--blue)]">{step}</span> : showAuth ? <AuthStatus /> : nav ? <SiteNav /> : null}
    </header>
  );
}
