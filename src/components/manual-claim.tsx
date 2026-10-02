"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage, getCatalogClaim, verifyCatalogClaim, type CatalogClaimChallenge } from "@/lib/api";

export function ManualClaim({ itemId }: { itemId: string }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [challenge, setChallenge] = useState<CatalogClaimChallenge | null>(null);
  const [pickupLocation, setPickupLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeModal = () => {
    setIsModalOpen(false);
    setIsVerified(false);
    setChallenge(null);
    setPickupLocation("");
    setError("");
    triggerRef.current?.focus();
  };

  const openModal = async () => {
    setIsVerified(false);
    setChallenge(null);
    setPickupLocation("");
    setError("");
    setLoading(true);
    setIsModalOpen(true);
    try {
      setChallenge(await getCatalogClaim(itemId));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isModalOpen]);

  const answer = async (choice: string) => {
    if (checking) return;
    setChecking(true);
    setError("");
    try {
      const result = await verifyCatalogClaim(itemId, choice);
      if (result.verified && result.pickup_location) {
        setPickupLocation(result.pickup_location);
        setIsVerified(true);
      } else {
        window.alert("틀렸습니다.");
        closeModal();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="mt-6" aria-label="소유권 인증">
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#007AFF] px-4 py-3 text-center text-sm font-bold text-white shadow-[0_12px_24px_rgba(0,122,255,.22)] transition hover:bg-[#006ce0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] sm:text-base"
      >
        🙋‍♂️ 이거 제 물건 같아요 (소유권 인증하기)
      </button>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-claim-title"
            aria-describedby="manual-claim-description"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[26px] bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex justify-end">
              <button
                ref={closeRef}
                type="button"
                aria-label="소유권 인증 창 닫기"
                onClick={closeModal}
                className="flex size-9 items-center justify-center rounded-full bg-[#f1f5f9] text-lg text-[#52657a] transition hover:bg-[#e5edf5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF]"
              >
                ×
              </button>
            </div>

            {isVerified ? (
              <div className="pb-2 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#e7f8f1] text-3xl" aria-hidden="true">✅</div>
                <h2 id="manual-claim-title" className="mt-5 text-xl font-extrabold tracking-tight text-[var(--navy)]">✅ 소유권이 확인되었습니다!</h2>
                <p id="manual-claim-description" className="mt-2 text-sm leading-6 text-[var(--muted)]">습득자가 물건을 맡겨둔 장소를 안내합니다.</p>
                <div className="mt-6 rounded-2xl bg-[#f3f6f9] p-4 text-left text-sm font-bold leading-6 text-[var(--navy)]">📍 보관 장소: {pickupLocation}</div>
                <p className="mt-3 text-xs leading-5 text-[#91a0af]">시연용 확인 결과입니다. 실제 수령 시에는 보관소에서 별도 확인이 필요합니다.</p>
                <button type="button" onClick={closeModal} className="mt-6 min-h-12 w-full rounded-xl bg-[#007AFF] px-4 text-sm font-bold text-white transition hover:bg-[#006ce0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF]">닫기</button>
              </div>
            ) : (
              <div className="pb-2">
                <span className="rounded-full bg-[#eaf4ff] px-3 py-1 text-xs font-bold text-[#007AFF]">소유권 확인 퀴즈</span>
                <h2 id="manual-claim-title" className="mt-4 text-xl font-extrabold tracking-tight text-[var(--navy)]">정말 본인 물건이 맞나요?</h2>
                <p id="manual-claim-description" className="mt-2 text-sm leading-6 text-[var(--muted)]">{challenge?.question ?? (loading ? "소유 확인 문제를 불러오고 있어요." : "문제를 불러오지 못했습니다.")}</p>
                {loading && <div role="status" className="mt-6 rounded-xl bg-[#f3f7fb] p-4 text-center text-sm text-[var(--muted)]">잠시만 기다려주세요...</div>}
                {challenge && <div className="mt-6 grid gap-3">
                  {challenge.choices.map((choice, index) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => answer(choice)}
                      disabled={checking}
                      className="flex min-h-13 w-full items-center gap-3 rounded-xl border border-[#dce8f4] bg-[#fbfdff] px-4 text-left text-sm font-bold text-[var(--navy)] transition hover:border-[#8fc2ff] hover:bg-[#f0f7ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007AFF] disabled:cursor-wait disabled:opacity-60"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eaf4ff] text-xs text-[#007AFF]">{index + 1}</span>
                      {choice}
                    </button>
                  ))}
                </div>}
                {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
                <p className="mt-5 text-center text-xs leading-5 text-[#91a0af]">시연용 목록의 인증 화면입니다.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
