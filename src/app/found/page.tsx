"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, BookOpen, CalendarClock, Camera, Check, FileText, Hash, ImagePlus, Lock, MapPin, Package, Palette, ScanSearch, Shapes, ShieldCheck, Sparkles, Tag, UploadCloud, X } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { ProgressSteps } from "@/components/progress-steps";
import { PageHeading } from "@/components/page-heading";
import { ActionButton } from "@/components/action-button";
import { InfoRow } from "@/components/info-row";
import { useRegistrationStore } from "@/store/use-registration-store";
import { createFoundItem, errorMessage, type Item } from "@/lib/api";

type Phase = "idle" | "ready" | "analyzing" | "done";
const analysisSteps = [
  { label: "사진 업로드", icon: ImagePlus },
  { label: "물체 인식 중...", icon: ScanSearch },
  { label: "텍스트 추출 중...", icon: FileText },
];
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
// 습득자가 만드는 소유 확인 질문 3개 (분실자는 이 중 하나만 맞히면 된다)
const challengeExamples = [
  { question: "예: 텀블러 바닥에 붙은 스티커 색은?", answer: "예: 노란색" },
  { question: "예: 뚜껑 빨대는 무슨 색인가요?", answer: "예: 갈색" },
  { question: "예: 손잡이 안쪽에 적힌 글자는?", answer: "예: STANLEY" },
];
const emptyChallenges = () => challengeExamples.map(() => ({ question: "", answer: "" }));
const questionKey = (question: string) => question.replace(/\s+/g, " ").trim().toLowerCase();
// 모바일 확대 방지를 위해 입력 글자는 16px 이상
const fieldClass = "mt-2 h-12 w-full rounded-xl border border-[#dce6f1] bg-[#fbfdff] px-4 text-base text-[var(--navy)] outline-none transition placeholder:text-[#a8b5c4] focus:border-[var(--blue)] focus:ring-4 focus:ring-[#007aff]/10 disabled:opacity-60";
const unknown = "확인되지 않음";

export default function FoundPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [itemName, setItemName] = useState("");
  const [location, setLocation] = useState("");
  const [timeText, setTimeText] = useState("");
  // 보관 장소: 소유 확인에 성공한 분실자에게만 공개된다. 화면 로컬 state에만 두고 브라우저 저장소에 남기지 않는다.
  const [storageLocation, setStorageLocation] = useState("");
  // 정답은 이 화면 로컬 state에만 두고 등록이 끝나면 바로 비운다 (브라우저 저장소에 남기지 않음).
  const [challenges, setChallenges] = useState(emptyChallenges);
  const [phase, setPhase] = useState<Phase>("idle");
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // 등록에 성공한 미리보기는 매칭 화면에서 쓰도록 store로 넘기고, 여기서는 해제하지 않는다.
  const previewUrl = useRef<string | null>(null);
  const setFoundPhotoName = useRegistrationStore((s) => s.setFoundPhotoName);
  const setFoundPreview = useRegistrationStore((s) => s.setFoundPreview);
  const busy = phase === "analyzing";
  // phase는 다음 렌더링 전까지 반영되지 않아 연타가 그 사이에 들어올 수 있다. 요청 중인지는 ref로 바로 막는다.
  const submitting = useRef(false);
  const missingMessage = !itemName.trim() ? "습득물명을 입력해주세요."
    : !location.trim() ? "물건을 처음 발견한 장소를 입력해주세요."
    : !timeText.trim() ? "물건을 발견한 시간을 입력해주세요."
    : !storageLocation.trim() ? "현재 물건을 보관하고 있는 장소를 입력해주세요."
    : challenges.some((c) => !c.question.trim() || !c.answer.trim()) ? "소유 확인 질문 3개와 정답을 모두 입력해주세요."
    : new Set(challenges.map((c) => questionKey(c.question))).size < challenges.length ? "서로 다른 질문을 입력해주세요." : "";
  const detailsFilled = !missingMessage;

  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  const updateChallenge = (index: number, key: "question" | "answer", value: string) =>
    setChallenges((current) => current.map((c, i) => (i === index ? { ...c, [key]: value } : c)));

  const clearPreview = () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  };

  const reset = () => {
    clearPreview();
    setPreview(null);
    setFile(null);
    setItem(null);
    setPhase("idle");
    setError("");
    setFoundPhotoName(null);
    if (inputRef.current) inputRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const select = (selected?: File) => {
    if (!selected || busy) return;
    if (!ACCEPTED_TYPES.includes(selected.type)) { setError("지원하지 않는 이미지입니다. JPG, PNG, WEBP 사진을 선택해주세요."); return; }
    if (selected.size > 10 * 1024 * 1024) { setError("10MB 이하의 이미지를 선택해주세요."); return; }
    setError("");
    clearPreview();
    const url = URL.createObjectURL(selected);
    previewUrl.current = url;
    setPreview(url);
    setFile(selected);
    setItem(null);
    setFoundPhotoName(selected.name);
    setPhase("ready");
  };

  const submit = async () => {
    if (!file || !detailsFilled || submitting.current) return;
    submitting.current = true;
    setPhase("analyzing");
    setError("");
    try {
      const { item } = await createFoundItem({ image: file, itemName, location, timeText, storageLocation, verificationQuestions: challenges.map((c) => ({ question: c.question.trim(), answer: c.answer })) });
      setItem(item);
      setChallenges((current) => current.map((c) => ({ ...c, answer: "" })));
      if (previewUrl.current) {
        setFoundPreview({ itemId: item.id, url: previewUrl.current });
        previewUrl.current = null;
      }
      setPhase("done");
    } catch (err) {
      setError(errorMessage(err, "register"));
      setPhase("ready");
    } finally {
      submitting.current = false;
    }
  };

  const features = item?.features;

  return <div className="app-shell"><AppHeader back="/" step="STEP 01 · 습득 등록" />
    <main className="mx-auto max-w-5xl px-5 pb-16 pt-2 sm:px-8"><ProgressSteps current={phase === "idle" || phase === "ready" ? 1 : 2} /><PageHeading eyebrow="FOUND ITEM" title="어떤 물건을 주우셨나요?">사진 한 장만 올려주세요. 물건의 특징을 정리해드릴게요.</PageHeading>
      <div className="mx-auto mt-9 grid max-w-4xl items-start gap-6 lg:grid-cols-[1.08fr_.92fr]">
        <section className="phone-panel rounded-[26px] p-5 sm:p-7"><h2 className="text-sm font-extrabold">습득물 사진</h2><p className="mt-1 text-xs text-[var(--muted)]">물건이 잘 보이도록 밝은 곳에서 찍어주세요.</p>
          <input ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(",")} className="sr-only" id="found-photo" onChange={(event) => select(event.target.files?.[0])} />
          <input ref={cameraRef} type="file" accept={ACCEPTED_TYPES.join(",")} capture="environment" className="sr-only" id="found-camera" onChange={(event) => select(event.target.files?.[0])} />
          {preview ? <div className="relative mt-5 overflow-hidden rounded-2xl bg-[#edf3f9]"><Image src={preview} alt="선택한 습득물 사진" width={800} height={600} unoptimized className="h-[280px] w-full object-contain" /><button type="button" onClick={reset} disabled={busy} aria-label="사진 삭제" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-white text-[var(--navy)] shadow-md disabled:opacity-50"><X size={18} /></button></div> : <><label htmlFor="found-photo" className="mt-5 flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#bdd7f4] bg-[#f8fbff] px-5 text-center transition hover:bg-[#eef7ff]"><span className="flex size-16 items-center justify-center rounded-2xl bg-[#e4f2ff] text-[var(--blue)]"><UploadCloud size={32} /></span><strong className="mt-4 text-sm">여기를 눌러 사진을 업로드하세요</strong><small className="mt-2 text-xs text-[var(--muted)]">JPG, PNG, WEBP · 최대 10MB</small></label><label htmlFor="found-camera" className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#cbdff3] text-xs font-bold text-[var(--blue)]"><Camera size={16} /> 카메라로 바로 촬영하기</label></>}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="text-xs font-bold">습득물명</span><input value={itemName} required aria-required="true" onChange={(event) => setItemName(event.target.value)} disabled={busy || phase === "done"} maxLength={50} placeholder="예: 검은색 카드지갑" className={fieldClass} /></label>
            <label className="block"><span className="text-xs font-bold">발견 장소</span><input value={location} required aria-required="true" aria-describedby="found-location-help" onChange={(event) => setLocation(event.target.value)} disabled={busy || phase === "done"} maxLength={100} placeholder="예: 공학관 앞 벤치" className={fieldClass} /><span id="found-location-help" className="mt-1.5 block text-[13px] text-[var(--muted)]">물건을 처음 발견한 위치를 입력해주세요.</span></label>
            <label className="block"><span className="text-xs font-bold">발견 시간</span><input value={timeText} required aria-required="true" onChange={(event) => setTimeText(event.target.value)} disabled={busy || phase === "done"} maxLength={100} placeholder="예: 오후 4시경" className={fieldClass} /></label>
            <label className="block sm:col-span-2"><span className="flex items-center gap-1.5 text-xs font-bold"><Lock size={13} className="text-[var(--blue)]" aria-hidden="true" />보관 장소</span><input value={storageLocation} required aria-required="true" aria-describedby="found-storage-help" onChange={(event) => setStorageLocation(event.target.value)} disabled={busy || phase === "done"} maxLength={200} autoComplete="off" placeholder="예: 학생회관 1층 안내데스크" className={fieldClass} /><span id="found-storage-help" className="mt-1.5 block break-keep text-[13px] leading-5 text-[var(--muted)]">현재 물건을 보관하고 있는 장소를 입력해주세요. 소유 확인을 완료한 분실자에게만 공개됩니다.</span></label>
          </div>
          <section aria-labelledby="challenge-title" className="mt-6 border-t border-[#e6edf5] pt-5">
            <h3 id="challenge-title" className="flex items-center gap-1.5 text-sm font-extrabold"><ShieldCheck size={16} className="text-[var(--blue)]" aria-hidden="true" />소유 확인 질문</h3>
            <p className="mt-1.5 break-keep text-[13px] leading-5 text-[var(--muted)]">실제 주인만 알 수 있는 특징을 질문해주세요. 분실자는 아래 질문 중 기억나는 하나만 맞혀도 보관 장소를 확인할 수 있어요.</p>
            <p className="mt-1 break-keep text-[13px] leading-5 text-[#9a6b12]">색상이나 발견 장소처럼 사진·공개 정보만 보고 알 수 있는 내용은 피해주세요.</p>
            <ol className="mt-4 space-y-4">
              {challenges.map((c, index) => <li key={index}>
                <p className="text-xs font-bold text-[var(--blue)]">질문 {index + 1}</p>
                <input value={c.question} onChange={(event) => updateChallenge(index, "question", event.target.value)} disabled={busy || phase === "done"} maxLength={200} required aria-required="true" aria-label={`소유 확인 질문 ${index + 1}`} placeholder={challengeExamples[index].question} className={fieldClass} />
                <input value={c.answer} onChange={(event) => updateChallenge(index, "answer", event.target.value)} disabled={busy || phase === "done"} maxLength={100} required aria-required="true" autoComplete="off" spellCheck={false} aria-label={`질문 ${index + 1}의 비공개 정답`} placeholder={phase === "done" ? "정답이 등록됐어요" : challengeExamples[index].answer} className={fieldClass} />
              </li>)}
            </ol>
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-[var(--muted)]"><Lock size={13} className="shrink-0" aria-hidden="true" />정답은 다른 사용자에게 공개되지 않아요.</p>
          </section>
          <ActionButton onClick={submit} disabled={!file || !detailsFilled || busy || phase === "done"} className="mt-5">{busy ? <><span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> 사진과 물건 정보를 분석하고 있어요...</> : phase === "done" ? "등록 완료" : "AI로 분석하고 등록하기 ✨"}</ActionButton>
          {busy && <p className="mt-3 text-center text-xs text-[var(--muted)]">처음 연결하는 경우 조금 더 걸릴 수 있어요.</p>}
          {file && !detailsFilled && phase !== "done" && <p className="mt-3 text-center text-xs text-[var(--muted)]">{missingMessage}</p>}
          {error && <p className="mt-3 text-xs font-semibold text-red-600" role="alert">{error}</p>}
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#f1f8ff] p-4"><Camera size={18} className="mt-0.5 shrink-0 text-[var(--blue)]" /><p className="text-xs leading-5 text-[#59728e]">학생증 번호나 연락처처럼 민감한 정보가 보이면 사진을 가린 뒤 올려주세요.</p></div>
        </section>
        <section className="subtle-card p-5 sm:p-6"><h2 className="flex items-center gap-2 text-sm font-extrabold"><span className="flex size-8 items-center justify-center rounded-lg bg-[#eaf4ff] text-[var(--blue)]"><Sparkles size={17} /></span> Back2U AI 분석</h2><p className="mt-2 text-xs leading-5 text-[var(--muted)]">업로드 후 진행 단계를 확인할 수 있어요.</p>
          <ol className="mt-6 space-y-4" aria-live="polite">{analysisSteps.map(({ label, icon: Icon }, index) => { const done = phase === "done" || (index === 0 && phase !== "idle"); const active = busy && index > 0; return <li key={label} className={`flex items-center gap-3 rounded-xl border p-3 ${active ? "border-[#b9d8ff] bg-[#f2f8ff]" : "border-[#e9eef4]"}`}><span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${done ? "bg-[#dcf6e9] text-[#20ac74]" : active ? "bg-[#e0efff] text-[var(--blue)]" : "bg-[#f0f4f8] text-[#a5b2c1]"}`}>{done ? <Check size={18} /> : <Icon size={18} className={active ? "animate-pulse" : ""} />}</span><span className={`text-xs font-bold ${done || active ? "text-[var(--navy)]" : "text-[#a5b2c1]"}`}>{label}</span>{active && <span className="ml-auto size-3 animate-spin rounded-full border-2 border-[var(--blue)] border-t-transparent" />}</li>; })}</ol>
          {item && features ? <><div className="mt-5 rounded-xl bg-[#eafaf1] p-4 text-xs font-semibold leading-5 text-[#238459]">사진 분석과 등록이 완료됐어요. 잃어버린 물건과 비교해볼게요.</div>
            <div className="mt-3">{item.raw_text && <InfoRow icon={<Package size={16} />} label="습득물명" value={item.raw_text} />}<InfoRow icon={<BookOpen size={16} />} label="물품 종류" value={features.category ?? unknown} /><InfoRow icon={<Palette size={16} />} label="색상" value={features.color ?? unknown} />{features.material && <InfoRow icon={<Shapes size={16} />} label="재질" value={features.material} />}{features.brand && <InfoRow icon={<BadgeCheck size={16} />} label="브랜드" value={features.brand} />}{features.ocr_text && <InfoRow icon={<FileText size={16} />} label="사진 속 글자" value={features.ocr_text} />}<InfoRow icon={<MapPin size={16} />} label="발견 장소" value={features.location ?? unknown} /><InfoRow icon={<CalendarClock size={16} />} label="발견 시간" value={features.time_text ?? unknown} />{features.keywords.length > 0 && <InfoRow icon={<Hash size={16} />} label="키워드" value={features.keywords.join(", ")} />}{features.distinctive_features.length > 0 && <InfoRow icon={<Tag size={16} />} label="주요 특징" value={features.distinctive_features.join(", ")} />}</div>
            <Link href={`/match/${item.id}`} className="mt-4 flex min-h-14 items-center justify-center rounded-2xl bg-[var(--navy)] px-5 text-sm font-bold text-white">매칭 결과 보기 →</Link></>
            : <div className="mt-5 rounded-xl bg-[#f6f9fc] p-4 text-xs leading-5 text-[var(--muted)]">{phase === "idle" ? "사진을 올리면 분석을 시작할 수 있어요." : busy ? "사진을 분석하고 있어요. 보통 10초 안팎 걸려요." : "습득물명, 발견 장소·시간, 보관 장소, 소유 확인 질문 3개를 적고 'AI로 분석하고 등록하기'를 눌러주세요."}</div>}
          <p className="mt-4 text-[11px] leading-5 text-[#95a4b4]">AI는 사진에 보이는 정보만 정리하며, 이름·학번 같은 개인정보는 저장하지 않아요.</p>
        </section>
      </div>
    </main></div>;
}
