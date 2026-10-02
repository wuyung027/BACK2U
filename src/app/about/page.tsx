import Image from "next/image";
import { ArrowRight, Camera, Clock, FileText, ImageIcon, Link2, MessageSquareText } from "lucide-react";
import { AppHeader } from "@/components/app-header";

const problems = [
  { icon: Clock, title: "잃어버려도 찾기 어려운 구조", detail: "분실 장소와 시간이 달라도 연락이 닿기 어렵습니다." },
  { icon: MessageSquareText, title: "제한적인 정보", detail: "분실물의 특징을 정확히 설명하기 어려운 경우가 많습니다." },
  { icon: Camera, title: "습득 후 연결이 어려움", detail: "주운 사람이 물건을 올려도 주인과 직접 연결되기 어렵습니다." },
];

const solutions = [
  { icon: FileText, title: "자연어로 이해하는 AI", detail: "기억나는 특징만 적어도 AI가 핵심 정보를 정리합니다." },
  { icon: ImageIcon, title: "사진도 정확하게 분석", detail: "습득자가 올린 사진에서 물건의 특징을 자동으로 추출합니다." },
  { icon: Link2, title: "서로 다른 정보를 연결", detail: "글과 사진, 시간과 장소를 비교해 가장 비슷한 후보를 찾아 연결합니다." },
];

const steps = [
  { label: "정보 등록", detail: "잃어버린 물건은 글로, 주운 물건은 사진으로 등록합니다." },
  { label: "AI 매칭", detail: "멀티모달 AI가 특징·시간·장소를 비교해 가장 비슷한 후보를 찾습니다." },
  { label: "소유 확인", detail: "비공개 질문으로 실제 주인을 확인하고 안전하게 연결합니다." },
];

const iconCircle = "flex size-14 shrink-0 items-center justify-center rounded-full bg-[#eaf3ff] text-[var(--blue)]";
const sectionTitle = "text-[clamp(26px,2.4vw,32px)] font-bold tracking-tight text-[var(--navy)]";
const sectionDesc = "mt-3 max-w-[640px] break-keep text-[16px] leading-[1.7] text-[#5b6b80]";

export default function AboutPage() {
  return <div className="min-h-screen bg-[#f7f9fc]">
    <AppHeader wide nav />
    <main className="mx-auto max-w-[1240px] px-5 pb-24 sm:px-8">
      <section className="grid items-center gap-10 pb-14 pt-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)] xl:gap-12 lg:pt-10">
        <div>
          <p className="text-[14px] font-semibold tracking-[0.08em] text-[#3f78bd]">ABOUT BACK2U</p>
          <h1 className="mt-4 break-keep text-[clamp(32px,2.8vw,40px)] font-extrabold leading-[1.3] tracking-[-0.04em] text-[var(--navy)]">
            <span className="block">Back2U는</span>
            <span className="block">캠퍼스의 잃어버린 물건과 주인을</span>
            <span className="block"><span className="text-[var(--blue)]">AI로 다시 연결하는</span> 서비스입니다.</span>
          </h1>
          <p className="mt-6 max-w-[600px] break-keep text-[17px] leading-[1.75] text-[#5b6b80]">분실자의 자연어 정보와 습득자의 사진을 멀티모달 AI로 분석하여,<br className="hidden sm:block" /> 캠퍼스 안에서 잃어버린 물건과 주인을 자동으로 연결합니다.</p>
        </div>
        <div className="relative overflow-hidden rounded-[24px] bg-[#e8eff7] shadow-[0_10px_30px_rgba(16,52,94,.08)]">
          <Image src="/wallet-lost.svg" alt="캠퍼스에서 발견된 검은색 카드지갑" width={800} height={600} priority className="h-[260px] w-full object-cover sm:h-[340px]" />
          <p className="absolute right-4 top-4 max-w-[230px] break-keep rounded-[16px] bg-white/95 px-5 pb-4 pt-5 text-[15px] leading-[1.6] text-[var(--navy)] shadow-[0_10px_30px_rgba(16,52,94,.10)] sm:right-6 sm:top-6">
            <span className="absolute left-4 top-3 size-1.5 rounded-full bg-[var(--blue)]" aria-hidden="true" />
            누군가의 소중한 물건이 다시 주인에게 돌아가는 순간을 만듭니다.
          </p>
        </div>
      </section>

      <section aria-labelledby="problem-title" className="border-t border-[#e3eaf3] py-12 lg:py-14">
        <h2 id="problem-title" className={sectionTitle}>이런 문제를 해결합니다</h2>
        <p className={sectionDesc}>캠퍼스에서는 매일 많은 물건이 분실되지만, 주인을 찾기까지 시간이 오래 걸리거나 연락이 닿지 않아 되돌아가지 못하는 경우가 많습니다.</p>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {problems.map(({ icon: Icon, title, detail }) => <li key={title} className="flex items-center gap-5 rounded-[20px] border border-[#e8eef5] bg-white/70 p-6">
            <span className={iconCircle} aria-hidden="true"><Icon size={26} /></span>
            <div><h3 className="break-keep text-[17px] font-bold text-[var(--navy)]">{title}</h3><p className="mt-1.5 break-keep text-[15px] leading-[1.6] text-[#5b6b80]">{detail}</p></div>
          </li>)}
        </ul>
      </section>

      <section aria-labelledby="solution-title" className="border-t border-[#e3eaf3] py-12 lg:py-14">
        <h2 id="solution-title" className={sectionTitle}>Back2U가 다르게 해결합니다</h2>
        <p className={sectionDesc}>글과 사진을 함께 이해하는 멀티모달 AI로, 서로 다른 형태의 정보를 비교해 가장 비슷한 분실물과 주인을 찾아 연결합니다.</p>
        <ul className="mt-8 grid gap-8 md:grid-cols-3">
          {solutions.map(({ icon: Icon, title, detail }) => <li key={title} className="flex items-center gap-5">
            <span className={iconCircle} aria-hidden="true"><Icon size={26} /></span>
            <div><h3 className="break-keep text-[17px] font-bold text-[var(--navy)]">{title}</h3><p className="mt-1.5 break-keep text-[15px] leading-[1.6] text-[#5b6b80]">{detail}</p></div>
          </li>)}
        </ul>
      </section>

      <section aria-labelledby="how-title" className="border-t border-[#e3eaf3] pt-12 lg:pt-14">
        <h2 id="how-title" className={sectionTitle}>어떻게 작동하나요?</h2>
        <p className={sectionDesc}>간단한 등록만으로 AI가 가장 비슷한 물건과 주인을 찾아드립니다.</p>
        <ol className="mt-9 grid gap-8 md:grid-cols-3 md:gap-12">
          {steps.map(({ label, detail }, index) => <li key={label} className="relative border-t border-[#d8e2ee] pt-5">
            <span className="text-[15px] font-bold tabular-nums text-[var(--blue)]">0{index + 1}</span>
            <h3 className="mt-2 text-[18px] font-bold text-[var(--navy)]">{label}</h3>
            <p className="mt-2 max-w-[320px] break-keep text-[16px] leading-[1.65] text-[#5b6b80]">{detail}</p>
            {index < steps.length - 1 && <ArrowRight size={18} className="absolute -right-[33px] top-[-9px] hidden bg-[#f7f9fc] text-[#9fb2c8] md:block" aria-hidden="true" />}
          </li>)}
        </ol>
      </section>
    </main>
  </div>;
}
