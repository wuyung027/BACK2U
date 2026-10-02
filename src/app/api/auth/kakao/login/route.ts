import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { kakaoConfig, OAUTH_STATE_COOKIE } from "@/lib/auth/kakao";

export async function GET(request: NextRequest) {
  const config = kakaoConfig();
  if (!config) return NextResponse.redirect(new URL("/?auth=not-configured", request.url));

  const state = randomBytes(32).toString("base64url");
  const authorize = new URL("https://kauth.kakao.com/oauth/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("state", state);

  const response = NextResponse.redirect(authorize);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: new URL(config.redirectUri).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
