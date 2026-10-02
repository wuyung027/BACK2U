export const OAUTH_STATE_COOKIE = "back2u_kakao_state";

export function kakaoConfig() {
  const clientId = process.env.KAKAO_REST_API_KEY;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET;
  const redirectUri = process.env.KAKAO_REDIRECT_URI;
  const sessionSecret = process.env.KAKAO_SESSION_SECRET;
  if (!clientId || !clientSecret || !redirectUri || !sessionSecret || sessionSecret.length < 32) return null;
  try {
    const parsed = new URL(redirectUri);
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) return null;
    return { clientId, clientSecret, redirectUri };
  } catch {
    return null;
  }
}
