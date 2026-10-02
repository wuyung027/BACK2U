import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Back2U | 다시 만나는 내 물건",
  description: "잃어버린 물건을 글로, 주운 물건을 사진으로 등록하고 매칭 후보를 확인하세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
