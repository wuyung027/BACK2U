import { AppHeader } from "./app-header";

// 이용 방법 / 자주 묻는 질문 페이지 공통 틀: 왼쪽 제목·소개, 오른쪽 일러스트(aside), 아래 본문
export function InfoPage({ eyebrow, title, intro, aside, children }: { eyebrow: string; title: string; intro: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f7f9fc]">
    <AppHeader wide nav />
    <main className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-8">
      <section className="grid items-center gap-10 pb-12 pt-6 lg:pt-10 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-10">
        <div>
          <p className="text-[14px] font-semibold tracking-[0.12em] text-[#3f78bd]">{eyebrow}</p>
          <h1 className="mt-4 break-keep text-[clamp(40px,4.4vw,62px)] font-extrabold leading-[1.15] tracking-[-0.045em] text-[var(--navy)]">{title}</h1>
          <div className="mt-6 max-w-[560px] break-keep text-[clamp(17px,1.5vw,20px)] leading-[1.7] text-[#5b6b80]">{intro}</div>
        </div>
        {aside}
      </section>
      {children}
    </main>
  </div>;
}
