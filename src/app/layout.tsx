import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyTrip｜輕鬆旅行規劃",
  description:
    "建立旅程、安排每日停留點、檢查太趕的行程，旅行當天也能快速掌握下一步。",
  openGraph: {
    title: "EasyTrip｜輕鬆旅行規劃",
    description:
      "建立旅程、安排每日停留點、檢查太趕的行程，旅行當天也能快速掌握下一步。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
