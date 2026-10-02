"use client";

import { useEffect, useState } from "react";

type SessionUser = { id: string; nickname: string };
type SessionResponse = { user: SessionUser | null; configured: boolean };

const authMessages: Record<string, string> = {
  "not-configured": "카카오 로그인을 사용하려면 개발자 키 설정이 필요합니다.",
  cancelled: "카카오 로그인이 취소되었습니다.",
  "invalid-state": "로그인 요청을 확인할 수 없습니다. 다시 시도해 주세요.",
  failed: "카카오 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
};

export function AuthStatus() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("auth");
    if (status && authMessages[status]) {
      setMessage(authMessages[status]);
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    }
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json() as Promise<SessionResponse>)
      .then(setSession)
      .catch(() => setMessage("로그인 상태를 확인하지 못했습니다."));
  }, []);

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout failed");
      setSession((current) => ({ user: null, configured: current?.configured ?? false }));
      setMessage("");
    } catch {
      setMessage("로그아웃하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      {session?.user ? (
        <>
          <span className="max-w-24 truncate text-xs font-bold text-[var(--navy)] sm:max-w-40 sm:text-sm" title={session.user.nickname}>{session.user.nickname}님</span>
          <button type="button" onClick={logout} disabled={busy} className="rounded-full border border-[#d8e6f5] bg-white px-3 py-2 text-xs font-bold text-[var(--navy)] disabled:opacity-50">로그아웃</button>
        </>
      ) : (
        <a href="/api/auth/kakao/login" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FEE500] px-4 text-xs font-extrabold text-[#191919] shadow-sm transition hover:bg-[#f4dc00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#191919]">
          <span aria-hidden="true" className="text-sm">●</span> 카카오 로그인
        </a>
      )}
      {message && <div role="status" className="absolute right-0 top-full z-10 mt-2 w-64 rounded-xl border border-[#d8e6f5] bg-white p-3 text-xs leading-5 text-[var(--navy)] shadow-lg">{message}</div>}
    </div>
  );
}
