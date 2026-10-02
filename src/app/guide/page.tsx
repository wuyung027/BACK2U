import Image from "next/image";
import Link from "next/link";
import { AlarmClock, ArrowRight, Camera, Clock, FileUser, ImagePlus, Lock, MapPin, Package, Search, Sparkles, UserRound } from "lucide-react";
import { InfoPage } from "@/components/info-page";

type Step = { label: string; detail: string; preview?: React.ReactNode };

const field = "flex min-h-11 items-center gap-2.5 rounded-[12px] border border-[#dfe7f1] bg-white px-3.5 py-2.5 text-[14px] leading-5 text-[#8b9bb0]";

function Notice({ tone, children }: { tone: "blue" | "mint"; children: React.ReactNode }) {
  return <div className={`flex gap-3 rounded-[12px] p-4 text-[14px] leading-6 ${tone === "blue" ? "bg-[#eef5ff] text-[#3d5a7a]" : "bg-[#ecf8f3] text-[#2f5d52]"}`}>
    <AlarmClock size={20} className={`mt-0.5 shrink-0 ${tone === "blue" ? "text-[var(--blue)]" : "text-[#0f7a65]"}`} />
    <span className="break-keep">{children}</span>
  </div>;
}

const lostSteps: Step[] = [
  { label: "기억나는 특징을 적어요", detail: "언제·어디서 잃어버렸는지, 색상·모양·브랜드 같은 특징을 자유롭게 적어주세요. (최대 500자)", preview: <div className="break-keep rounded-[12px] border border-[#dfe7f1] bg-white px-4 py-3 text-[14px] leading-6 text-[#8b9bb0]">예) 어제 오후 3시쯤 학생회관에서 검은색 카드지갑을 잃어버렸어요. 안에 학생증이 있습니다.</div> },
  { label: "소유 확인 질문을 정해요 (선택)", detail: "본인만 알 수 있는 질문과 정답을 등록하면, 나중에 실제 주인인지 확인할 때 사용돼요.", preview: <div className="space-y-2"><div className={field}>예) 지갑 안쪽의 스티커는 무엇인가요?</div><div className={field}><Lock size={16} className="shrink-0" />예) 파란 고양이 스티커</div></div> },
  { label: "AI가 분석하고 등록해요", detail: "AI가 글에서 물품 종류·색상·장소·시간 같은 특징을 정리해 등록합니다.", preview: <Notice tone="blue">등록 후 비슷한 물건이 발견되면 매칭 결과를 확인할 수 있어요.</Notice> },
];

const foundSteps: Step[] = [
  { label: "사진을 올려요", detail: "물건이 잘 보이도록 밝은 곳에서 찍은 사진 한 장을 올려주세요. (JPG·PNG·WEBP, 최대 20MB)", preview: <div className="flex h-24 flex-col items-center justify-center gap-1.5 rounded-[12px] border-2 border-dashed border-[#cdebe0] bg-[#f6fbf9] text-[14px] text-[#5b6b80]"><ImagePlus size={22} className="text-[#5b6b80]" />사진 업로드</div> },
  { label: "물건 이름과 장소·시간을 적어요", detail: "습득물명과 주운 장소·시간을 적으면 분실물과 더 정확하게 비교할 수 있어요.", preview: <div className="space-y-2"><div className={field}><Package size={16} className="shrink-0" />예) 검은색 카드지갑</div><div className={field}><MapPin size={16} className="shrink-0" />예) 학생회관 1층</div><div className={field}><Clock size={16} className="shrink-0" />예) 10월 1일 오후 3시경</div></div> },
  { label: "AI가 사진을 분석해요", detail: "사진에서 물품 종류·색상·특징·적힌 글자를 인식해 등록합니다.", preview: <Notice tone="mint">등록 후 비슷한 분실물이 있으면 매칭 결과를 확인할 수 있어요.</Notice> },
  { label: "매칭 결과를 확인해요", detail: "등록된 분실물 중 비슷한 후보와 일치도, 매칭 근거를 볼 수 있어요." },
];

const flows = [
  { id: "lost", title: "잃어버렸을 때", subtitle: "기억나는 특징을 글로 적어 간단하게 등록할 수 있어요.", icon: FileUser, href: "/lost", cta: "분실물 등록하기", ctaIcon: Search, steps: lostSteps,
    iconBox: "bg-[#eaf3ff] text-[var(--blue)]", line: "border-[#cfe0f5]", button: "bg-[#0a6de0] hover:bg-[#075fc4]" },
  { id: "found", title: "주웠을 때", subtitle: "사진 한 장으로 간단하게 등록할 수 있어요.", icon: Camera, href: "/found", cta: "습득물 등록하기", ctaIcon: Camera, steps: foundSteps,
    iconBox: "bg-[#e6f6f1] text-[#0f7a65]", line: "border-[#cdebe0]", button: "bg-[#128069] hover:bg-[#0e6d59]" },
];

const tags = ["검은색", "카드지갑", "학생회관", "오후 3시"];
const miniCard = "w-full rounded-[20px] border border-[#e6edf5] bg-white p-4 shadow-[0_10px_30px_rgba(16,52,94,.06)] md:w-[230px]";
const tagList = <ul className="mt-3 flex flex-wrap gap-1.5">{tags.map((tag) => <li key={tag} className="rounded-full bg-[#f1f5fa] px-2.5 py-1 text-[13px] text-[#5b6b80]">{tag}</li>)}</ul>;

const flowIllustration = <figure aria-label="분실자의 글과 습득자의 사진을 멀티모달 AI가 비교하는 과정" className="flex flex-col gap-4 md:flex-row md:items-start md:gap-0">
  <div className={miniCard}>
    <p className="flex items-center gap-2.5 text-[15px] font-bold text-[var(--navy)]"><span className="flex size-9 items-center justify-center rounded-[10px] bg-[#eaf3ff] text-[var(--blue)]" aria-hidden="true"><UserRound size={18} /></span>잃어버린 분</p>
    <p className="mt-3 break-keep rounded-[12px] border border-[#e3eaf3] p-3 text-[13px] leading-[1.7] text-[#41556e]">어제 오후 3시쯤 학생회관에서 검은색 카드지갑을 잃어버렸어요. 안에 학생증이 있습니다.</p>
    {tagList}
  </div>
  <div className="relative flex flex-col items-center py-2 text-center md:w-[170px] md:pt-[52px]">
    <svg viewBox="0 0 170 64" className="absolute left-0 top-[20px] hidden h-16 w-[170px] md:block" fill="none" aria-hidden="true">
      <defs><marker id="guide-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L8 5 L0 9" stroke="#3f8cff" strokeWidth="1.6" fill="none" /></marker></defs>
      <path d="M2 20 C 30 6, 52 16, 58 50" stroke="#3f8cff" strokeWidth="1.6" strokeDasharray="4 4" markerEnd="url(#guide-arrow)" />
      <path d="M168 20 C 140 6, 118 16, 112 50" stroke="#3f8cff" strokeWidth="1.6" strokeDasharray="4 4" markerEnd="url(#guide-arrow)" />
    </svg>
    <Sparkles size={20} className="text-[var(--blue)]" aria-hidden="true" />
    <span className="mt-1 flex size-16 items-center justify-center rounded-full bg-[var(--blue)] text-[22px] font-extrabold text-white shadow-[0_10px_24px_rgba(0,122,255,.25)]">AI</span>
    <p className="mt-3 text-[15px] font-bold text-[var(--navy)]">멀티모달 AI가</p>
    <p className="mt-0.5 break-keep text-[14px] leading-6 text-[#5b6b80]">두 정보를 비교해<br />가장 비슷한 후보를 찾습니다.</p>
  </div>
  <div className={miniCard}>
    <p className="flex items-center gap-2.5 text-[15px] font-bold text-[var(--navy)]"><span className="flex size-9 items-center justify-center rounded-[10px] bg-[#e6f6f1] text-[#0f7a65]" aria-hidden="true"><Camera size={18} /></span>주운 분</p>
    <div className="mt-3 overflow-hidden rounded-[12px] bg-[#e8eff7]"><Image src="/wallet-lost.svg" alt="습득자가 올린 검은색 카드지갑 사진" width={800} height={600} className="h-[112px] w-full object-cover" /></div>
    {tagList}
  </div>
</figure>;

export default function GuidePage() {
  return <InfoPage eyebrow="HOW TO USE" title="이용 방법" aside={flowIllustration}
    intro={<p>잃어버린 물건은 기억나는 특징을 <strong className="font-semibold text-[var(--navy)]">글로</strong>,<br className="hidden sm:block" /> 주운 물건은 <strong className="font-semibold text-[var(--navy)]">사진으로</strong> 등록해주세요.<br className="hidden sm:block" /> 멀티모달 AI가 물건의 특징·시간·장소를 비교해<br className="hidden sm:block" /> 가장 비슷한 후보를 찾아드립니다.</p>}>
    <div className="grid gap-6 lg:grid-cols-2">
      {flows.map(({ id, title, subtitle, icon: Icon, href, cta, ctaIcon: CtaIcon, steps, iconBox, line, button }) => <section key={id} aria-labelledby={`${id}-title`} className="flex flex-col rounded-[24px] border border-[#e6edf5] bg-white p-6 shadow-[0_10px_30px_rgba(16,52,94,.05)] sm:p-7">
        <div className="flex items-center gap-5">
          <span className={`flex size-16 shrink-0 items-center justify-center rounded-[18px] ${iconBox}`} aria-hidden="true"><Icon size={30} /></span>
          <div><h2 id={`${id}-title`} className="text-[26px] font-bold tracking-tight text-[var(--navy)]">{title}</h2><p className="mt-1 break-keep text-[16px] text-[#5b6b80]">{subtitle}</p></div>
        </div>
        <ol className="mt-8 flex-1 space-y-7">
          {steps.map(({ label, detail, preview }, index) => <li key={label} className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-4 gap-y-4 xl:grid-cols-[40px_minmax(0,1fr)_minmax(0,210px)]">
            {index < steps.length - 1 && <span className={`absolute -bottom-5 left-[19px] top-12 border-l-2 border-dashed ${line}`} aria-hidden="true" />}
            <span className={`flex size-10 items-center justify-center rounded-full text-[15px] font-bold tabular-nums ${iconBox}`}>0{index + 1}</span>
            <div><h3 className="break-keep text-[18px] font-bold text-[var(--navy)]">{label}</h3><p className="mt-1.5 break-keep text-[15px] leading-[1.6] text-[#5b6b80]">{detail}</p></div>
            {preview && <div className="col-start-2 xl:col-start-3" aria-hidden="true">{preview}</div>}
          </li>)}
        </ol>
        <Link href={href} className={`mt-8 flex h-14 items-center justify-center gap-2.5 rounded-[14px] text-[17px] font-bold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)] ${button}`}><CtaIcon size={20} aria-hidden="true" />{cta}<ArrowRight size={20} aria-hidden="true" /></Link>
      </section>)}
    </div>
  </InfoPage>;
}
