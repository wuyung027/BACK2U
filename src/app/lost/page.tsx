"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, BookOpen, CalendarClock, CheckCircle2, MapPin, Palette, Shapes, Sparkles, Tag, WandSparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ProgressSteps } from "@/components/progress-steps";
import { ActionButton } from "@/components/action-button";
import { useRegistrationStore } from "@/store/use-registration-store";
import { createLostItem, errorMessage, type Item } from "@/lib/api";

const example = "어제 오후 3시쯤 학생회관 1층에서 검은색 카드지갑을 잃어버렸어요. 안에 학생증이랑 체크카드가 들어있고, 금색 로고가 붙어 있어요.";

// 공용 ActionButton 위에 이 화면의 글자 크기와 비활성 모양만 덧씌운다.
const ctaClass = "text-[17px]! disabled:opacity-100! disabled:bg-[#b4c3d4]! disabled:shadow-none!";

function ResultRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="flex items-start gap-3 border-b border-[#e9eef4] py-3.5 last:border-0">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#edf5ff] text-[var(--blue)]">{icon}</span>
    <span className="w-[84px] shrink-0 pt-1.5 text-sm font-semibold text-[var(--muted)]">{label}</span>
    <span className="min-w-0 flex-1 break-keep pt-1 text-[15px] font-bold leading-6 text-[var(--navy)]">{value}</span>
  </div>;
}

export default function LostPage() {
  // 작성 중인 설명과 이 화면에 보여줄 등록 결과는 화면 로컬 state라서, /lost에 새로 들어올 때마다 빈 폼으로 시작한다.
  // 등록된 분실물은 다음 단계(/waiting → /match)에서 쓰도록 store의 lostItem에만 따로 남긴다.
  const [description, setDescription] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const setRegisteredLostItem = useRegistrationStore((s) => s.setLostItem);
  const [busy, setBusy] = useState(false);
  // busy는 다음 렌더링 전까지 반영되지 않아 연타가 그 사이에 들어올 수 있다. 요청 중인지는 ref로 바로 막는다.
  const submitting = useRef(false);
  const [error, setError] = useState("");
  // 소유 확인 질문은 습득자가 FOUND 등록 때 만든다. 분실자는 설명만 쓰고 바로 등록한다.
  const resultRef = useRef<HTMLElement>(null);
  const features = item?.features;
  const highlights = features ? [...new Set([...features.keywords, ...features.distinctive_features])] : [];

  const register = async () => {
    if (!description.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const { item } = await createLostItem(description.trim());
      setItem(item);
      setRegisteredLostItem(item);
      // 한 줄 레이아웃(모바일)에서는 결과 카드가 아래에 있으므로 바로 보이게 스크롤한다.
      if (window.innerWidth < 1024) requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(errorMessage(err, "register"));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  // 같은 /lost 안에서 새 등록을 시작할 때: 폼 state만 비운다 (이미 등록된 lostItem은 대기 화면용으로 유지).
  const restart = () => {
    setItem(null);
    setDescription("");
    setError("");
  };

  return <div className="app-shell"><AppHeader back="/" step="STEP 01 · 분실 등록" />
    <main className="mx-auto max-w-6xl px-5 pb-16 sm:px-8"><ProgressSteps compact current={item ? 2 : 1} />
      <div className="mt-3 text-center"><h1 className="break-keep text-[28px] font-extrabold leading-tight tracking-[-0.05em] text-[var(--navy)] sm:text-[40px]">어떤 물건을 잃어버렸나요?</h1><p className="mx-auto mt-3 max-w-xl break-keep text-[15px] leading-7 text-[var(--muted)] sm:text-[17px]">기억나는 만큼 편하게 적어주세요. AI가 필요한 정보를 정리해드릴게요.</p></div>
      <div className="mx-auto mt-8 grid max-w-[1100px] items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="phone-panel rounded-[26px] p-5 sm:p-8">
          <div className="flex items-center justify-between"><label htmlFor="lost-description" className="text-[17px] font-extrabold">분실물 설명</label><span className="text-sm text-[#8b9bb0]">{description.length}/500</span></div>
          <textarea id="lost-description" maxLength={500} value={description} disabled={busy || Boolean(item)} onChange={(event) => { setDescription(event.target.value); setError(""); }} placeholder="예: 어제 오후 학생회관에서 검은색 카드지갑을 잃어버렸어요. 안에 학생증이 있어요." className="mt-3 min-h-[180px] w-full resize-y rounded-2xl border border-[#d5e1ee] bg-[#fbfdff] p-4 text-base leading-7 text-[var(--navy)] outline-none transition placeholder:text-[#8b9bb0] focus:border-[var(--blue)] focus:ring-4 focus:ring-[#007aff]/10 disabled:text-[#4f6680] sm:min-h-[220px]" />
          <p className="mt-3 flex items-start gap-2 break-keep text-sm leading-6 text-[var(--muted)]"><Sparkles size={16} className="mt-1 shrink-0 text-[var(--blue)]" /> 색상, 장소, 시간, 특징을 함께 적으면 더 정확하게 찾을 수 있어요.</p>
          {!item && <button type="button" disabled={busy} onClick={() => { setDescription(example); setError(""); }} className="ml-6 mt-1 rounded-lg text-sm font-bold text-[var(--blue)] underline underline-offset-4 disabled:opacity-50">예시 문장 채우기</button>}

          {item ? <><p role="status" className="mt-7 flex items-center justify-center gap-2 rounded-2xl bg-[#e9f9f2] px-4 py-4 text-base font-bold text-[#1f8a63]"><CheckCircle2 size={20} /> 등록이 완료됐어요</p>
            <button type="button" onClick={restart} className="mx-auto mt-4 block text-sm font-bold text-[var(--blue)] underline underline-offset-4">다른 분실물 등록하기</button></>
            : <><ActionButton onClick={register} disabled={!description.trim() || busy} className={`mt-7 ${ctaClass}`}>{busy ? <><span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> AI가 분석하고 있어요...</> : "AI로 분석하고 등록하기 ✨"}</ActionButton>
              {busy && <p className="mt-3 text-center text-sm text-[var(--muted)]">처음 연결하는 경우 조금 더 걸릴 수 있어요.</p>}</>}
          {error && <p className="mt-4 break-keep rounded-xl bg-[#fff2f2] px-4 py-3 text-sm font-semibold text-red-600" role="alert">{error}</p>}
        </section>

        <section ref={resultRef} className="subtle-card scroll-mt-4 overflow-hidden p-5 sm:p-7" aria-live="polite"><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-[17px] font-extrabold"><span className="flex size-9 items-center justify-center rounded-lg bg-[#eaf4ff] text-[var(--blue)]"><WandSparkles size={18} /></span> AI 분석 결과</h2>{item && <span className="rounded-full bg-[#e7f8f1] px-2.5 py-1 text-xs font-bold text-[#24946f]">등록 완료</span>}</div>
          {features ? <><div className="mt-3">
              {features.category && <ResultRow icon={<BookOpen size={17} />} label="물품 종류" value={features.category} />}
              {features.color && <ResultRow icon={<Palette size={17} />} label="색상" value={features.color} />}
              {features.material && <ResultRow icon={<Shapes size={17} />} label="재질" value={features.material} />}
              {features.brand && <ResultRow icon={<BadgeCheck size={17} />} label="브랜드" value={features.brand} />}
              {features.location && <ResultRow icon={<MapPin size={17} />} label="분실 장소" value={features.location} />}
              {features.time_text && <ResultRow icon={<CalendarClock size={17} />} label="분실 시간" value={features.time_text} />}
              {highlights.length > 0 && <ResultRow icon={<Tag size={17} />} label="주요 특징" value={highlights.join(", ")} />}
            </div>
            <Link href="/waiting" className="mt-5 flex min-h-13 items-center justify-center rounded-xl bg-[#e9f4ff] text-base font-bold text-[var(--blue)] transition hover:bg-[#d7ebff]">매칭 대기 화면으로 →</Link>
            <p className="mt-4 text-sm text-[#8b9bb0]">분석 결과와 함께 등록됐어요 · 등록 번호 {item?.id.slice(0, 8)}</p></>
            : <div className="mt-5 flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d6e3f1] bg-[#f9fcff] px-5 py-8 text-center"><span className="flex size-12 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[var(--blue)]"><WandSparkles size={24} className={busy ? "animate-pulse" : ""} /></span>
              <p className="mt-4 break-keep text-[15px] font-bold leading-6">{busy ? "설명을 분석하고 있어요" : <>설명을 분석하면<br />물품의 특징을 정리해드려요.</>}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{busy ? "보통 10초 안팎 걸려요." : "종류 · 색상 · 장소 · 시간 · 특징"}</p></div>}
        </section>
      </div>
    </main></div>;
}
