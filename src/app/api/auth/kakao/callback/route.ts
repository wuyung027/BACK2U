import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { kakaoConfig, OAUTH_STATE_COOKIE } from "@/lib/auth/kakao";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/auth/session";

type KakaoToken = { access_token?: string };
type KakaoUser = { id?: number | string; kakao_account?: { profile?: { nickname?: string } } };

function sameState(expected: string | undefined, received: string | null) {
  if (!expected || !received) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function redirectHome(request: NextRequest, status: string) {
  const response = NextResponse.redirect(new URL(`/?auth=${status}`, request.url));
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const config = kakaoConfig();
  if (!config) return redirectHome(request, "not-configured");
  const query = request.nextUrl.searchParams;
  if (query.has("error")) return redirectHome(request, "cancelled");
  if (!sameState(request.cookies.get(OAUTH_STATE_COOKIE)?.value, query.get("state"))) return redirectHome(request, "invalid-state");
  const code = query.get("code");
  if (!code) return redirectHome(request, "failed");

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    });
    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) return redirectHome(request, "failed");
    const token = (await tokenResponse.json()) as KakaoToken;
    if (!token.access_token) return redirectHome(request, "failed");

    const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!userResponse.ok) return redirectHome(request, "failed");
    const kakaoUser = (await userResponse.json()) as KakaoUser;
    if (typeof kakaoUser.id !== "number" && typeof kakaoUser.id !== "string") return redirectHome(request, "failed");
    const nickname = kakaoUser.kakao_account?.profile?.nickname?.trim().slice(0, 30) || "카카오 사용자";

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.set(SESSION_COOKIE, signSession({ id: String(kakaoUser.id), nickname }), {
      httpOnly: true,
      secure: new URL(config.redirectUri).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch {
    return redirectHome(request, "failed");
  }
}
