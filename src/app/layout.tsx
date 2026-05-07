import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyTrip | Calm Travel Planner",
  description:
    "A responsive travel-planning MVP for creating trips, organizing daily stops, and keeping the next travel action clear.",
  openGraph: {
    title: "EasyTrip | Calm Travel Planner",
    description:
      "Create trips, organize itinerary stops, catch tight schedules, and switch into today mode while traveling.",
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
