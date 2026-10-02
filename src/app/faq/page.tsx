import Image from "next/image";
import { Camera, ChartColumn, ChevronDown, CircleHelp, EyeOff, FileText, Lock, ShieldCheck, UserRound } from "lucide-react";
import { InfoPage } from "@/components/info-page";

const faqs = [
  { icon: UserRound, q: "로그인이 필요한가요?", a: "현재는 별도의 로그인 없이 분실물이나 습득물을 등록하고 AI 매칭 결과를 바로 확인할 수 있어요. 다만, 정확한 소유 확인을 위해 일부 기능에서는 추가 정보 입력이 필요할 수 있어요." },
  { icon: Camera, q: "어떤 사진을 올릴 수 있나요?", a: "JPG·PNG·WEBP 형식, 최대 20MB까지 올릴 수 있어요. 물건 전체가 밝고 선명하게 보이는 사진일수록 AI가 특징을 정확하게 인식해요." },
  { icon: ChartColumn, q: "일치도(%)는 무엇인가요?", a: "물품 종류·특징·색상·적힌 글자·장소·시간을 비교한 근거를 종합한 점수예요. 정보가 없는 항목은 계산에서 빠져요. 점수가 높을수록 비슷하다는 뜻이지만 같은 물건이라는 확정은 아니어서, 소유 확인 절차를 함께 거쳐요." },
  { icon: ShieldCheck, q: "소유 확인은 어떻게 하나요?", a: "분실물을 등록할 때 본인만 아는 질문과 정답을 선택해서 정할 수 있어요. 매칭 결과 화면에서 그 질문에 맞는 답을 입력하면 실제 주인인지 확인돼요." },
  { icon: FileText, q: "소유 확인 정답은 그대로 저장되나요?", a: "아니요. 정답은 원문 그대로 저장하지 않고 알아볼 수 없는 형태(해시)로 바꿔 저장해요. 화면이나 응답에도 정답은 나타나지 않아요." },
  { icon: EyeOff, q: "올린 사진은 누구나 볼 수 있나요?", a: "사진은 비공개 저장소에 보관되고, 매칭 결과 화면에서만 일정 시간 동안 유효한 링크로 보여요. 사진 속 6자리 이상의 긴 숫자는 AI가 특징을 정리할 때 가려서 저장해요." },
  { icon: CircleHelp, q: "매칭 후보가 없다고 나와요.", a: "아직 비슷한 물건이 등록되지 않았을 수 있어요. 매칭은 결과를 볼 때마다 그 시점에 등록된 물건과 다시 비교해요." },
];

const chips = [
  { icon: UserRound, text: "어떤 사진을 올리면 좋을까요?", pos: "left-[8px] top-[20px]" },
  { icon: ChartColumn, text: "일치도(%)는 무엇인가요?", pos: "left-0 top-[150px]" },
  { icon: ShieldCheck, text: "소유 확인은 어떻게 하나요?", pos: "right-0 top-[82px]" },
  { icon: Lock, text: "로그인이 필요한가요?", pos: "right-[16px] top-[192px]" },
];

// 장식용 일러스트 (질문 목록은 아래에 있으므로 스크린리더에서는 숨김)
const faqIllustration = <div className="relative hidden h-[290px] w-[690px] xl:block" aria-hidden="true">
  <div className="absolute left-[205px] top-[18px] h-[250px] w-[320px] -rotate-12 rounded-[48%] bg-[#e9f1fb]" />
  <Image src="/wallet-cutout.svg" alt="" width={670} height={480} className="absolute left-[248px] top-[66px] w-[232px]" />
  <svg viewBox="0 0 40 40" className="absolute left-[468px] top-[28px] size-10" fill="none"><path d="M10 4 L6 14 M24 14 L34 9 M22 26 L34 28" stroke="#3f8cff" strokeWidth="3" strokeLinecap="round" /></svg>
  {chips.map(({ icon: Icon, text, pos }) => <p key={text} className={`absolute flex items-center gap-2.5 rounded-[14px] bg-white px-3.5 py-2.5 text-[14px] font-semibold text-[var(--navy)] shadow-[0_10px_30px_rgba(16,52,94,.08)] ${pos}`}><span className="flex size-8 items-center justify-center rounded-full bg-[#eef4fc] text-[var(--blue)]"><Icon size={17} /></span>{text}</p>)}
</div>;

export default function FaqPage() {
  return <InfoPage eyebrow="FAQ" title="자주 묻는 질문" aside={faqIllustration} intro={<p>Back2U를 이용하면서 궁금한 점을 모아두었어요.<br /> 질문을 누르면 자세한 답변을 볼 수 있어요.</p>}>
    <div className="space-y-3">
      {faqs.map(({ icon: Icon, q, a }, index) => <details key={q} open={index === 0} className="group rounded-[18px] border border-[#e6edf5] bg-white shadow-[0_4px_14px_rgba(16,52,94,.03)]">
        <summary className="flex cursor-pointer list-none items-center gap-4 rounded-[18px] px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)] sm:gap-6 sm:px-7 [&::-webkit-details-marker]:hidden">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eef4fc] text-[var(--blue)] sm:size-12" aria-hidden="true"><Icon size={22} /></span>
          <span className="flex-1 break-keep text-[17px] font-bold text-[var(--navy)] sm:text-[19px]">{q}</span>
          <ChevronDown size={20} className="shrink-0 text-[#3f78bd] transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <p className="mx-5 mb-5 break-keep rounded-[14px] bg-[#f4f7fb] px-5 py-4 text-[16px] leading-[1.75] text-[#5b6b80] sm:mb-6 sm:ml-[100px] sm:mr-7">{a}</p>
      </details>)}
    </div>
  </InfoPage>;
}
