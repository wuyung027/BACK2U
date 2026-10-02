"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, FileText, ImageOff, Info, MapPin, RefreshCw, Search, SearchX, ShieldCheck, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MatchReasonBar, type MatchReason } from "@/components/match-reason-bar";
import { useRegistrationStore } from "@/store/use-registration-store";
import { ActionButton } from "@/components/action-button";
import { errorMessage, getMatches, verifyOwnership, type ItemFeatures, type MatchResponse, type ReasonKey, type VerificationQuestion } from "@/lib/api";

const reasonLabels: { key: ReasonKey; label: string; detail: string }[] = [
  { key: "category", label: "물품 종류", detail: "물건 종류가 의미상 얼마나 비슷한지" },
  { key: "features", label: "특징·키워드", detail: "설명과 사진 속 특징이 의미상 얼마나 비슷한지" },
  { key: "color", label: "색상", detail: "색상이 같은지" },
  { key: "ocr", label: "사진 속 글자", detail: "양쪽에 적힌 글자가 비슷한지" },
  { key: "location", label: "장소", detail: "같은 건물·위치 표현이면 매칭 근거로 활용해요. 다른 장소면 불일치 벌점 없이 '정보 없음'으로 제외해요." },
  { key: "time", label: "시간", detail: "분실 시각과 습득 시각의 간격을 비교해요. 선후를 판단할 수 없으면 '정보 없음'으로 제외해요." },
];

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; data: MatchResponse };

function itemTitle(features: ItemFeatures) {
  return [features.color, features.category].filter(Boolean).join(" ") || "물건";
}

function itemMeta(features: ItemFeatures) {
  return [features.location, features.time_text].filter(Boolean).join(" · ") || "장소·시간 정보 없음";
}

// 분실자 화면 전용. 습득자가 만든 질문 3개 중 하나를 골라 답한다 (예전 데이터는 분실물의 단일 질문).
function OwnershipVerification({ lostId, foundId, required, question, questions, initiallyVerified }: { lostId: string; foundId: string; required: boolean; question: string | null; questions: VerificationQuestion[] | null; initiallyVerified: boolean }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  // 연타·Enter가 다음 렌더링 전에 들어와도 확인 요청은 한 번만 보낸다.
  const submitting = useRef(false);
  const [verified, setVerified] = useState(initiallyVerified);
  const [selected, setSelected] = useState(questions?.[0]?.id ?? "");
  // 보관 장소는 이 화면에서 정답을 맞혔을 때만 받는다 (매칭 조회 응답에는 없음 → 새로고침하면 다시 확인).
  const [revealed, setRevealed] = useState<{ location: string | null } | null>(null);
  const [mismatch, setMismatch] = useState(false);
  const [error, setError] = useState("");
  const multi = Boolean(questions?.length);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!answer.trim() || submitting.current || (multi && !selected)) return;
    submitting.current = true;
    setBusy(true);
    setMismatch(false);
    setError("");
    try {
      const result = await verifyOwnership({ lostItemId: lostId, foundItemId: foundId, answer, questionId: multi ? selected : undefined });
      if (result.verified) { setVerified(true); setRevealed({ location: result.storage_location?.trim() || null }); setAnswer(""); } else setMismatch(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return <section className="subtle-card mt-5 p-5 sm:p-6"><h2 className="flex items-center gap-2 text-sm font-extrabold"><span className="flex size-8 items-center justify-center rounded-lg bg-[#eaf4ff] text-[var(--blue)]"><ShieldCheck size={17} /></span> 소유 확인</h2>
    {revealed ? <div role="status" className="mt-4 rounded-xl bg-[#e9f9f2] p-4"><p className="flex items-center gap-2 text-[15px] font-extrabold text-[#218c68]"><CheckCircle2 size={18} /> 소유 확인이 완료됐어요</p>
        {revealed.location ? <div className="mt-3 flex items-start gap-3 rounded-xl bg-white p-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eaf4ff] text-[var(--blue)]" aria-hidden="true"><MapPin size={18} /></span><div className="min-w-0"><p className="text-[13px] font-semibold text-[#5b6b80]">물건이 보관된 장소</p><p className="mt-0.5 break-keep text-[17px] font-bold leading-snug text-[var(--navy)] [overflow-wrap:anywhere]">{revealed.location}</p><p className="mt-2 break-keep text-[13px] leading-5 text-[#5b6b80]">직접 방문해 물건을 확인해주세요. 방문 전 해당 장소의 운영 여부를 확인해주세요.</p></div></div>
          : <p className="mt-2 text-sm leading-6 text-[#2f8a69]">소유 확인은 완료됐지만 등록된 보관 장소가 없어요.</p>}</div>
      : !multi && !required ? <p className="mt-3 rounded-xl bg-[#f6f9fc] p-4 text-sm leading-6 text-[var(--muted)]">등록된 소유 확인 질문이 없어요.</p>
      : <form onSubmit={submit}>{verified ? <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#e9f9f2] p-3 text-[13px] leading-5 text-[#2f8a69]"><CheckCircle2 size={16} className="mt-0.5 shrink-0" /> 이미 소유 확인을 완료한 물건이에요. 보관 장소를 보려면 정답을 한 번 더 입력해주세요.</p>
          : <p className="mt-2 break-keep text-sm leading-6 text-[var(--muted)]">{multi ? "물건의 주인만 알 수 있는 질문에 답해주세요. 기억나는 질문 하나만 맞혀도 확인할 수 있어요." : "등록된 질문에 답하면 실제 소유자인지 확인하고, 물건이 보관된 장소를 알려드려요."}</p>}
        {multi ? <fieldset className="mt-4 space-y-2"><legend className="sr-only">답할 질문 선택</legend>
            {questions!.map((q) => <label key={q.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition ${selected === q.id ? "border-[var(--blue)] bg-[#f2f8ff] font-bold text-[var(--navy)]" : "border-[#e3eaf3] bg-white text-[#41556e] hover:border-[#c5d6ea]"}`}><input type="radio" name="verification-question" value={q.id} checked={selected === q.id} onChange={() => { setSelected(q.id); setMismatch(false); }} disabled={busy} className="size-4 shrink-0 accent-[var(--blue)]" /><span className="break-keep">{q.question}</span></label>)}
          </fieldset>
          : <p className="mt-4 rounded-xl bg-[#f6f9fc] p-3 text-sm font-bold">Q. {question}</p>}
        <input value={answer} onChange={(event) => { setAnswer(event.target.value); setMismatch(false); }} disabled={busy} maxLength={100} autoComplete="off" spellCheck={false} aria-label="소유 확인 답변" placeholder="답을 입력하세요" className="mt-3 h-12 w-full rounded-xl border border-[#dce6f1] bg-[#fbfdff] px-4 text-base text-[var(--navy)] outline-none transition placeholder:text-[#a8b5c4] focus:border-[var(--blue)] focus:ring-4 focus:ring-[#007aff]/10 disabled:opacity-60" />
        <ActionButton type="submit" disabled={!answer.trim() || busy || (multi && !selected)} className="mt-3">{busy ? "확인 중..." : "소유 확인하기"}</ActionButton>
        {mismatch && <p role="alert" className="mt-3 break-keep text-sm font-semibold text-red-600">{multi ? "답이 일치하지 않아요. 다른 질문을 선택해 다시 확인해보세요." : "입력한 정보가 일치하지 않아요."}</p>}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </form>}
  </section>;
}

// 일치도는 AI 확신도가 아니라 단서별 점수를 합친 값이다. 너무 낮은 후보는 서버가 아예 내려주지 않는다.
// 운영 데이터 실측: 같은 물건 쌍은 79점 이상, 같은 계열의 다른 물건은 47점 이하.
const STRONG_MATCH_SCORE = 70;

function scoreTier(score: number) {
  return score >= STRONG_MATCH_SCORE
    ? { strong: true, title: "가장 닮은 물건을 찾았어요", message: "여러 단서가 비슷해요." }
    : { strong: false, title: "확인해볼 만한 후보가 있어요", message: "일부 단서가 비슷해요. 직접 확인해보세요." };
}

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const foundPreview = useRegistrationStore((s) => s.foundPreview);
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ok", data: await getMatches(id) });
    } catch (err) {
      setState({ status: "error", message: errorMessage(err) });
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const shell = (children: React.ReactNode) => <div className="app-shell"><AppHeader back="/" step="STEP 03 · 매칭 결과" /><main className="mx-auto max-w-5xl px-5 pb-16 pt-2 sm:px-8"><div className="mx-auto max-w-3xl">{children}</div></main></div>;

  if (state.status === "loading") return shell(<div className="phone-panel mt-8 flex min-h-[320px] flex-col items-center justify-center rounded-[26px] px-5 text-center" aria-live="polite"><span className="flex size-14 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[var(--blue)]"><Sparkles size={27} className="animate-pulse" /></span><p className="mt-4 text-sm font-bold">Back2U가 가장 유사한 물건을 찾고 있어요...</p><p className="mt-2 text-xs text-[var(--muted)]">등록된 물건들과 단서를 비교하는 중이에요.</p></div>);

  if (state.status === "error") return shell(<div className="phone-panel mt-8 flex min-h-[320px] flex-col items-center justify-center rounded-[26px] px-5 text-center" role="alert"><span className="flex size-14 items-center justify-center rounded-2xl bg-[#fff1f1] text-red-500"><Info size={27} /></span><p className="mt-4 text-sm font-bold">{state.message}</p><p className="mt-2 text-xs leading-5 text-[var(--muted)]">서버를 다시 시작하면 이전에 등록한 물건은 사라질 수 있어요.</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => void load()} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#cddbeb] bg-white px-4 text-xs font-bold text-[var(--navy)]"><RefreshCw size={15} /> 다시 시도</button><Link href="/" className="flex min-h-11 items-center rounded-xl bg-[var(--navy)] px-4 text-xs font-bold text-white">홈으로</Link></div></div>);

  const { source_item: source, matches } = state.data;
  const opposite = source.type === "FOUND" ? "분실물" : "습득물";

  if (matches.length === 0) return shell(<div className="phone-panel mt-8 flex min-h-[320px] flex-col items-center justify-center rounded-[26px] px-5 text-center"><span className="flex size-14 items-center justify-center rounded-2xl bg-[#eaf4ff] text-[var(--blue)]"><SearchX size={27} /></span><p className="mt-4 text-sm font-bold">아직 충분히 비슷한 물건을 찾지 못했어요.</p><p className="mt-2 break-keep text-xs leading-5 text-[var(--muted)]">현재 등록된 물건 중 일치하는 후보가 없습니다.<br />새로운 {opposite}이 등록되면 다시 확인해보세요.</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => void load()} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#cddbeb] bg-white px-4 text-xs font-bold text-[var(--navy)]"><RefreshCw size={15} /> 다시 확인하기</button><Link href="/" className="flex min-h-11 items-center rounded-xl bg-[var(--navy)] px-4 text-xs font-bold text-white">홈으로</Link></div></div>);

  const top = matches[0];
  const lost = source.type === "LOST" ? { id: source.id, features: source.features } : { id: top.item_id, features: top.features };
  const found = source.type === "FOUND" ? { id: source.id, features: source.features, imageUrl: source.image_url } : { id: top.item_id, features: top.features, imageUrl: top.image_url };
  // 서버 저장 사진(Signed URL)을 우선 쓰고, 없으면 이번 세션의 미리보기를 쓴다.
  const foundImage = found.imageUrl || (foundPreview?.itemId === found.id ? foundPreview.url : null);
  const cards = [
    { key: "lost", subtitle: source.type === "LOST" ? "내가 잃어버린 물건" : "등록된 분실물", features: lost.features, image: null, placeholder: "글로 등록된 분실물" },
    { key: "found", subtitle: source.type === "FOUND" ? "내가 주운 물건" : "등록된 습득물", features: found.features, image: foundImage, placeholder: "사진은 등록한 기기에서만 보여요" },
  ];
  const reasons: MatchReason[] = reasonLabels.map(({ key, label, detail }) => ({ label, detail, score: top.reasons[key] ?? null }));
  const tier = scoreTier(top.match_score);

  return shell(<>
    <div className="text-center"><span className="eyebrow"><Sparkles size={13} className="mr-1.5" /> SIMILAR ITEMS</span><h1 className="mt-4 text-[29px] font-extrabold tracking-[-0.06em] sm:text-4xl">{tier.title}</h1><p className="mt-2 text-sm text-[var(--muted)]">{source.type === "FOUND" ? "주운 물건과 등록된 분실물의 단서를 비교했어요." : "내 분실물과 습득물의 단서를 비교했어요."}</p></div>
    <div className={`mt-7 flex items-center gap-4 rounded-[22px] bg-gradient-to-r px-5 py-5 sm:px-7 ${tier.strong ? "from-[#dcf9ec] to-[#e6f8f5]" : "from-[#fff4df] to-[#fff9ef]"}`}><span className={`hidden size-14 shrink-0 items-center justify-center rounded-full text-white min-[360px]:flex ${tier.strong ? "bg-[#32bd91] shadow-[0_8px_18px_rgba(37,170,123,.2)]" : "bg-[#f0a43a] shadow-[0_8px_18px_rgba(214,140,40,.2)]"}`}>{tier.strong ? <Check size={30} /> : <Search size={27} />}</span><div className="min-w-0"><div className={`whitespace-nowrap text-[29px] font-black leading-none tracking-[-0.06em] sm:text-4xl ${tier.strong ? "text-[#159a70]" : "text-[#a86200]"}`}>일치도 {Math.round(top.match_score)}%</div><p className={`mt-1.5 text-xs font-semibold ${tier.strong ? "text-[#4f8679]" : "text-[#8a6534]"}`}>{tier.message}</p></div></div>
    <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-5">{cards.map((card) => <section className="subtle-card overflow-hidden" key={card.key}><div className="p-3 pb-0 sm:p-4 sm:pb-0"><span className="rounded-full bg-[#edf5ff] px-2.5 py-1 text-[10px] font-bold text-[var(--blue)]">{card.subtitle}</span></div><div className="relative m-3 mt-3 h-32 overflow-hidden rounded-xl bg-[#edf2f6] sm:m-4 sm:h-52">{card.image ? <Image src={card.image} alt={itemTitle(card.features)} fill unoptimized sizes="(max-width: 640px) 45vw, 320px" className="object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-center text-[#8ea2b7]">{card.key === "lost" ? <FileText size={30} strokeWidth={1.6} /> : <ImageOff size={30} strokeWidth={1.6} />}<span className="text-[10px] font-semibold sm:text-xs">{card.placeholder}</span></div>}</div><div className="px-3 pb-4 sm:px-4 sm:pb-5"><h2 className="break-keep text-sm font-extrabold sm:text-base">{itemTitle(card.features)}</h2><p className="mt-1 flex items-center gap-1 break-keep text-[10px] text-[var(--muted)] sm:text-xs"><MapPin size={12} className="shrink-0" /> {itemMeta(card.features)}</p></div></section>)}</div>
    <section className="subtle-card mt-6 p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-extrabold sm:text-lg">AI 매칭 근거</h2><p className="mt-1 text-xs text-[var(--muted)]">각 단서가 얼마나 비슷한지 살펴보세요.</p></div><span className="rounded-full bg-[#eef6ff] px-2.5 py-1 text-[10px] font-bold text-[var(--blue)]">상세 보기</span></div><div className="mt-6 space-y-5">{reasons.map((reason) => <MatchReasonBar key={reason.label} reason={reason} />)}</div><div className="mt-6 flex gap-2 rounded-xl bg-[#f0f7ff] p-3 text-xs leading-5 text-[#4d718d]"><Info size={17} className="mt-0.5 shrink-0 text-[var(--blue)]" /><span>정보가 있는 단서만 종합한 결과이며, &apos;정보 없음&apos; 항목은 점수에 포함되지 않아요. 최종 소유권은 별도 확인이 필요해요.</span></div></section>
    {/* 소유 확인(정답 입력 → 보관 장소 공개)은 분실자 화면에서만. 습득자 화면에는 안내만 둔다. */}
    {source.type === "LOST" ? <OwnershipVerification key={`${lost.id}:${found.id}`} lostId={lost.id} foundId={found.id} required={Boolean(top.verification_required)} question={top.verification_question ?? null} questions={top.verification_questions ?? null} initiallyVerified={Boolean(top.verified)} />
      : <section className="subtle-card mt-5 p-5 sm:p-6"><h2 className="flex items-center gap-2 text-sm font-extrabold"><span className="flex size-8 items-center justify-center rounded-lg bg-[#eaf4ff] text-[var(--blue)]"><ShieldCheck size={17} /></span> 소유 확인</h2><p className="mt-3 break-keep rounded-xl bg-[#f6f9fc] p-4 text-sm leading-6 text-[#5b6b80]">분실자가 소유 확인을 완료하면 반환이 진행됩니다. 등록하신 보관 장소는 소유 확인을 마친 분실자에게만 안내돼요.</p></section>}
    {matches.length > 1 && <section className="subtle-card mt-5 p-5 sm:p-6"><h2 className="text-sm font-extrabold">다른 후보 {matches.length - 1}개</h2><ul className="mt-3 divide-y divide-[#e9eef4]">{matches.slice(1).map((match) => <li key={match.item_id} className="flex items-center justify-between gap-3 py-3 text-xs"><span className="min-w-0 truncate font-bold">{itemTitle(match.features)} <span className="font-semibold text-[var(--muted)]">· {itemMeta(match.features)}</span></span><strong className="shrink-0 text-[var(--navy)]">일치도 {Math.round(match.match_score)}%</strong></li>)}</ul></section>}
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#dce9f7] bg-white p-4 text-xs leading-5 text-[#5a7088]"><ShieldCheck size={20} className="shrink-0 text-[var(--blue)]" /> 개인정보 보호를 위해 습득자 연락처는 소유권 확인 후 안내됩니다.</div>
    <div className="mt-7 grid gap-3 sm:grid-cols-2"><Link href={source.type === "FOUND" ? "/found" : "/lost"} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#cddbeb] bg-white text-sm font-bold text-[var(--navy)]"><ArrowLeft size={17} /> 다시 등록하기</Link><Link href="/" className="flex min-h-12 items-center justify-center rounded-xl bg-[var(--navy)] text-sm font-bold text-white">홈으로 돌아가기 →</Link></div>
    <p className="mt-5 text-center text-[11px] text-[#94a4b6]">등록 번호: {source.id.slice(0, 8)}</p>
  </>);
}
