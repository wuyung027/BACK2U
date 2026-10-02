import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "back2u_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionUser = { id: string; nickname: string };
type SessionPayload = SessionUser & { expiresAt: number };

function sessionSecret() {
  const value = process.env.KAKAO_SESSION_SECRET;
  return value && value.length >= 32 ? value : null;
}

export function signSession(user: SessionUser) {
  const secret = sessionSecret();
  if (!secret) throw new Error("KAKAO_SESSION_SECRET is missing or too short");
  const payload: SessionPayload = { id: user.id, nickname: user.nickname, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function readSession(value: string | undefined): SessionUser | null {
  const secret = sessionSecret();
  if (!value || !secret) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  try {
    const expected = createHmac("sha256", secret).update(encoded).digest();
    const received = Buffer.from(signature, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.id !== "string" || typeof payload.nickname !== "string" || typeof payload.expiresAt !== "number" || payload.expiresAt <= Date.now()) return null;
    return { id: payload.id, nickname: payload.nickname };
  } catch {
    return null;
  }
}
