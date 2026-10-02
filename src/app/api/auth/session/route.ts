import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { kakaoConfig } from "@/lib/auth/kakao";
import { readSession, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const user = readSession(cookieStore.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ user, configured: Boolean(kakaoConfig()) }, { headers: { "Cache-Control": "no-store" } });
}
