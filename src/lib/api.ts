// Back2U FastAPI 클라이언트. 타입은 backend/schemas.py 기준.

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export type ItemType = "LOST" | "FOUND";

export type ItemFeatures = {
  category: string | null;
  color: string | null;
  material: string | null;
  brand: string | null;
  location: string | null;
  time_text: string | null;
  ocr_text: string | null;
  keywords: string[];
  distinctive_features: string[];
};

export type Item = {
  id: string;
  type: ItemType;
  raw_text: string | null;
  image_filename: string | null;
  // Supabase 모드의 만료 시간 있는 사진 URL. memory 모드면 null.
  image_url?: string | null;
  features: ItemFeatures;
  created_at: string;
  // 소유 확인 질문만 내려온다. 정답/해시는 어떤 응답에도 없다.
  verification_question?: string | null;
  verification_required?: boolean;
};

export type ItemResponse = { success: boolean; item: Item };

// 공개 목록/상세용 (GET /api/v1/items). 소유 확인 정보·분실 설명 원문·연락처는 오지 않는다.
// 예전에 저장된 데이터는 features 일부가 비어 있을 수 있어 화면에서는 선택적으로 읽는다.
export type PublicItem = {
  id: string;
  type: ItemType;
  // 습득자가 입력한 습득물명 (FOUND만)
  name: string | null;
  image_url: string | null;
  features: Partial<ItemFeatures> | null;
  created_at: string;
};

export type ItemListResponse = { items: PublicItem[] };

export type ReasonKey = "category" | "features" | "color" | "ocr" | "location" | "time";

export type MatchCandidate = {
  item_id: string;
  type: ItemType;
  match_score: number;
  // null = 비교할 정보 없음 (0점과 다름)
  reasons: Record<ReasonKey, number | null>;
  features: ItemFeatures;
  image_url?: string | null;
  // 이 후보 쌍의 분실물 쪽 소유 확인 상태 (verified는 이 습득물로 확인된 경우만 true)
  verification_required?: boolean;
  verification_question?: string | null;
  // 습득자가 만든 소유 확인 질문 (분실물 화면에서만 온다). 정답/해시는 오지 않는다.
  verification_questions?: VerificationQuestion[] | null;
  verified?: boolean;
};

// 습득자가 FOUND 등록 때 만든 질문 3개 중 하나 (분실자에게는 질문 문장만 보여준다)
export type VerificationQuestion = { id: string; question: string };

// storage_location은 소유 확인에 성공했을 때만 온다 (보관 장소가 없는 예전 습득물은 null).
export type VerifyResponse = { verified: boolean; message: string; storage_location?: string | null };
export type CatalogClaimChallenge = { question: string; choices: string[] };
export type CatalogClaimResponse = { verified: boolean; pickup_location: string | null };

export type MatchResponse = { source_item_id: string; source_item: Item; matches: MatchCandidate[] };

type ApiErrorKind = "network" | "bad-request" | "not-found" | "rate-limit" | "ai" | "storage" | "server" | "unknown";

// 화면에는 아래 문구만 보여주고, 서버가 보낸 원문(예외·provider 응답 등)은 콘솔에만 남긴다.
const SERVER_UNREACHABLE = "서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요. 서버가 처음 시작되는 경우 잠시 걸릴 수 있어요.";

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init });
  } catch (error) {
    console.error("[api] network error", path, error);
    throw new ApiError("network", SERVER_UNREACHABLE);
  }

  if (response.ok) return (await response.json()) as T;

  let body: { detail?: unknown; code?: unknown } | undefined;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const detail = body?.detail;
  console.error("[api] request failed", path, response.status, detail);

  // 400/413 detail은 백엔드가 사용자용으로 작성한 문구이므로 그대로 보여준다.
  if ((response.status === 400 || response.status === 413) && typeof detail === "string") {
    throw new ApiError("bad-request", detail, response.status);
  }
  if (response.status === 400 || response.status === 422) {
    throw new ApiError("bad-request", "입력 내용을 다시 확인해주세요.", response.status);
  }
  if (response.status === 404) {
    throw new ApiError("not-found", "등록된 물건을 찾을 수 없어요.", response.status);
  }
  if (response.status === 429) {
    throw new ApiError("rate-limit", "소유 확인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.", response.status);
  }
  // 백엔드가 code로 AI 분석 실패와 저장소 실패를 알려준다 (둘 다 503일 수 있다).
  if (body?.code === "ai_failed") {
    throw new ApiError("ai", "물건 정보를 분석하지 못했어요. 잠시 후 다시 시도해주세요.", response.status);
  }
  if (body?.code === "storage_failed") {
    throw new ApiError("storage", "저장소에 연결하지 못했어요. 잠시 후 다시 시도해주세요.", response.status);
  }
  // 그 밖의 5xx는 서버가 시작 중이거나 배포 중인 경우가 대부분이다.
  if (response.status >= 500) {
    throw new ApiError("server", SERVER_UNREACHABLE, response.status);
  }
  throw new ApiError("unknown", "요청을 처리하지 못했어요. 다시 시도해주세요.", response.status);
}

// action="register": 등록 화면에서는 저장소 오류를 등록 실패로 안내한다.
export function errorMessage(error: unknown, action?: "register") {
  if (!(error instanceof ApiError)) return "알 수 없는 오류가 발생했어요. 다시 시도해주세요.";
  if (action === "register" && error.kind === "storage") return "등록하지 못했어요. 입력 내용을 확인하고 다시 시도해주세요.";
  return error.message;
}

// verification은 예전 분실자 단일 질문용(deprecated). 새 화면은 보내지 않는다.
export function createLostItem(rawText: string, verification?: { question: string; answer: string }) {
  return request<ItemResponse>("/api/v1/items/lost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      raw_text: rawText,
      ...(verification ? { verification_question: verification.question, verification_answer: verification.answer } : {}),
    }),
  });
}

const IMAGE_EXTENSIONS: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

export function createFoundItem({ image, itemName, location, timeText, storageLocation, verificationQuestions }: { image: File; itemName?: string; location?: string; timeText?: string; storageLocation?: string; verificationQuestions?: { question: string; answer: string }[] }) {
  const form = new FormData();
  // 백엔드는 파일 확장자로 형식을 검사하므로, 확장자가 없거나 다른 이름이면 MIME 기준으로 맞춘다.
  const ext = IMAGE_EXTENSIONS[image.type];
  const hasExt = /\.(jpe?g|png|webp)$/i.test(image.name);
  form.append("image", image, hasExt || !ext ? image.name : `${image.name.replace(/\.[^.]*$/, "") || "photo"}${ext}`);
  if (itemName?.trim()) form.append("item_name", itemName.trim());
  if (location?.trim()) form.append("location", location.trim());
  if (timeText?.trim()) form.append("time_text", timeText.trim());
  if (storageLocation?.trim()) form.append("storage_location", storageLocation.trim());
  // 정답은 백엔드에서 바로 해시로 바뀌고 평문은 저장되지 않는다.
  if (verificationQuestions?.length) form.append("verification_questions", JSON.stringify(verificationQuestions));
  return request<ItemResponse>("/api/v1/items/found", { method: "POST", body: form });
}

// 최신 등록순. 화면에 들어올 때마다 새로 받아오도록 request는 cache: "no-store"를 쓴다.
export function listItems({ type, limit }: { type?: ItemType; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return request<ItemListResponse>(`/api/v1/items${query ? `?${query}` : ""}`);
}

export function getItem(itemId: string) {
  return request<PublicItem>(`/api/v1/items/${encodeURIComponent(itemId)}`);
}

export function deleteItem(itemId: string) {
  return request<{ deleted: boolean; item_id: string }>(`/api/v1/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}

export function getMatches(itemId: string) {
  return request<MatchResponse>(`/api/v1/items/match/${encodeURIComponent(itemId)}`);
}

export function verifyOwnership({ lostItemId, foundItemId, answer, questionId }: { lostItemId: string; foundItemId: string; answer: string; questionId?: string }) {
  return request<VerifyResponse>("/api/v1/items/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lost_item_id: lostItemId, found_item_id: foundItemId, answer, ...(questionId ? { question_id: questionId } : {}) }),
  });
}

export function getCatalogClaim(itemId: string) {
  return request<CatalogClaimChallenge>(`/api/v1/catalog-claims/${encodeURIComponent(itemId)}`);
}

export function verifyCatalogClaim(itemId: string, answer: string) {
  return request<CatalogClaimResponse>(`/api/v1/catalog-claims/${encodeURIComponent(itemId)}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
}
