import type { PublicItem } from "./api";

// 공개 목록(/items, 홈 최근 물건, 상세)에서 함께 쓰는 표시용 helper.
// AI가 정리한 features는 자유 문장이고 예전 데이터는 일부가 비어 있을 수 있으므로 모두 안전하게 읽는다.

export type ItemGroup = "지갑·카드" | "전자기기" | "생활용품" | "기타";
export const itemGroups: Array<"전체" | ItemGroup> = ["전체", "지갑·카드", "전자기기", "생활용품", "기타"];

const groupRules: Array<[Exclude<ItemGroup, "기타">, RegExp]> = [
  ["지갑·카드", /지갑|카드|학생증|신분증/],
  ["전자기기", /이어폰|에어팟|버즈|헤드폰|헤드셋|폰|전화|노트북|태블릿|아이패드|충전|배터리|시계|워치|마우스|키보드|usb|카메라|전자/i],
  ["생활용품", /우산|가방|백팩|에코백|파우치|텀블러|물병|컵|옷|외투|자켓|재킷|후드|모자|안경|목도리|장갑|필통|열쇠|키링/],
];

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "") : [];
}

export function itemCategoryText(item: PublicItem) {
  return [text(item.features?.category), ...list(item.features?.keywords)].join(" ");
}

export function itemGroup(item: PublicItem): ItemGroup {
  const source = `${itemCategoryText(item)} ${text(item.name)}`;
  return groupRules.find(([, rule]) => rule.test(source))?.[0] ?? "기타";
}

export function itemTitle(item: PublicItem) {
  const name = text(item.name);
  if (name) return name;
  const color = text(item.features?.color);
  const category = text(item.features?.category);
  if (category) return color && !category.includes(color) ? `${color} ${category}` : category;
  return item.type === "FOUND" ? "등록된 습득물" : "등록된 분실물";
}

export function itemCategoryLabel(item: PublicItem) {
  return text(item.features?.category) || itemGroup(item);
}

export function itemLocation(item: PublicItem) {
  return text(item.features?.location) || "장소 정보 없음";
}

export function itemHighlights(item: PublicItem) {
  return [...new Set([text(item.features?.color), text(item.features?.material), ...list(item.features?.keywords), ...list(item.features?.distinctive_features)].filter(Boolean))];
}

const seoulDay = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric" });
const seoulMonthDay = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
const seoulTime = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });

// 등록 시각: 오늘이면 "오늘 오후 3:30", 아니면 "10월 2일"
export function itemRegisteredAt(item: PublicItem) {
  const date = new Date(item.created_at);
  if (Number.isNaN(date.getTime())) return "등록일 정보 없음";
  return seoulDay.format(date) === seoulDay.format(new Date()) ? `오늘 ${seoulTime.format(date)}` : seoulMonthDay.format(date);
}

export function itemSearchText(item: PublicItem) {
  return [itemTitle(item), itemCategoryText(item), text(item.features?.location), ...itemHighlights(item)].join(" ").toLocaleLowerCase("ko");
}
