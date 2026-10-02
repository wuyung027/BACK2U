import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Camera, Check, PenLine, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { RecentItems } from "@/components/recent-items";

const exampleReasons = ["물품 종류가 같아요", "검은색 특징이 일치해요", "발견 장소가 가까워요", "시간대가 비슷해요"];

const ctaBase = "group flex min-h-[108px] items-center gap-3.5 rounded-[18px] px-5 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]";

export default function Home() {
  return <div className="min-h-screen bg-[#f7f9fc]">
    <AppHeader wide nav />
    <main className="mx-auto max-w-[1240px] px-5 sm:px-8">
      <div className="grid items-center gap-10 pb-14 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-14 lg:pt-12">
        <section>
          <p className="text-base font-semibold text-[var(--blue)]">AI 기반 캠퍼스 분실물 매칭 서비스</p>
          <h1 className="mt-4 break-keep text-[clamp(38px,3.8vw,56px)] font-extrabold leading-[1.22] tracking-[-0.045em] text-[var(--navy)]"><span className="block">Back2U</span>캠퍼스의 잃어버린 물건과<br className="hidden sm:block" /> 주인을 <span className="whitespace-nowrap text-[var(--blue)]">다시 연결합니다.</span></h1>
          <div className="mt-10 grid max-w-[660px] gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Link href="/lost" className={`${ctaBase} bg-[#0a6de0] text-white hover:bg-[#075fc4]`}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white/15" aria-hidden="true"><PenLine size={21} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-xl">잃어버렸어요</strong><span className="mt-0.5 block break-keep text-[15px] text-white/90">기억나는 특징으로 찾아보기</span></span>
              <ArrowRight size={20} className="shrink-0" aria-hidden="true" />
            </Link>
            <Link href="/found" className={`${ctaBase} border border-[#d5e9e2] bg-white text-[var(--navy)] hover:border-[#9fd6c6]`}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#e6f6f1] text-[#0f7a65]" aria-hidden="true"><Camera size={21} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-xl">주웠어요</strong><span className="mt-0.5 block break-keep text-[15px] text-[#5b6b80]">사진 한 장으로 등록하기</span></span>
              <ArrowRight size={20} className="shrink-0 text-[#0f7a65]" aria-hidden="true" />
            </Link>
          </div>
          <p className="mt-5 flex items-center gap-2 text-[15px] text-[#5b6b80]"><ShieldCheck size={18} className="shrink-0 text-[var(--blue)]" aria-hidden="true" /> 안전한 매칭을 위해 소유 확인 절차를 거칩니다.</p>
        </section>

        <section aria-labelledby="example-title" className="mx-auto w-full max-w-[480px] rounded-[24px] border border-[#e3eaf3] bg-white p-6 shadow-[0_10px_30px_rgba(16,52,94,.06)] sm:p-7 lg:mr-0">
          <div className="flex items-baseline justify-between">
            <h2 id="example-title" className="text-[15px] font-semibold text-[#5b6b80]">매칭 결과 예시</h2>
            <p className="font-bold text-[#0f7a65]"><span className="text-2xl">94%</span> <span className="text-[15px]">일치</span></p>
          </div>
          <div className="mt-4 overflow-hidden rounded-[16px] bg-[#eef2f7]">
            <Image src="/wallet-lost.svg" alt="습득물로 등록된 검은색 카드지갑 사진" width={800} height={600} priority className="h-[180px] w-full object-cover sm:h-[190px]" />
          </div>
          <h3 className="mt-5 text-[21px] font-bold tracking-tight text-[var(--navy)]">검은색 카드지갑</h3>
          <p className="mt-1.5 text-[15px] leading-6 text-[#5b6b80]">오늘 오후 3:30<br />학생회관 1층</p>
          <ul className="mt-5 space-y-2.5 border-t border-[#e8eef5] pt-5" aria-label="매칭 근거">
            {exampleReasons.map((reason) => <li key={reason} className="flex items-center justify-between gap-3 text-[15px] text-[var(--navy)]">{reason}<Check size={18} className="shrink-0 text-[#1f9d84]" aria-label="일치" /></li>)}
          </ul>
        </section>
      </div>

      <RecentItems />
    </main>
  </div>;
}
