"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getCurrentTimeString,
  getDayProgress,
  getDayWarnings,
  getNextStopInsight,
} from "@/lib/itinerary/day-insights";
import { categoryLabels, paceLabels } from "@/lib/trips/labels";
import { getSortedItems } from "@/lib/time/itinerary";
import { getLocalDateString, getTodayTripDay } from "@/lib/trips/today";
import { useTripStore } from "@/store/trip-store";

export function TodayMode({ tripId }: { tripId: string }) {
  const [currentTime, setCurrentTime] = useState(() => getCurrentTimeString());
  const trips = useTripStore((state) => state.trips);
  const hasHydrated = useTripStore((state) => state.hasHydrated);
  const hydrateTrips = useTripStore((state) => state.hydrateTrips);
  const setSelectedTripId = useTripStore((state) => state.setSelectedTripId);
  const setSelectedDayId = useTripStore((state) => state.setSelectedDayId);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(getCurrentTimeString());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      hydrateTrips();
    }
  }, [hasHydrated, hydrateTrips]);

  const trip = trips.find((item) => item.id === tripId);
  const day = getTodayTripDay(trip);

  useEffect(() => {
    setSelectedTripId(tripId);
    if (day) {
      setSelectedDayId(day.id);
    }
  }, [day, setSelectedDayId, setSelectedTripId, tripId]);

  const items = getSortedItems(day?.items ?? []);
  const nextStop = getNextStopInsight(items, currentTime);
  const progress = getDayProgress(items, currentTime);
  const warnings = trip ? getDayWarnings(items, trip.pace) : [];
  const nextItem = nextStop.item;
  const laterItems = nextItem
    ? items.filter((item) => item.startTime > nextItem.startTime).slice(0, 3)
    : [];

  if (!trip || !day) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-surface)] px-5 text-[var(--color-ink)]">
        <section className="max-w-md rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-[var(--color-teal)]">EasyTrip</p>
          <h1 className="mt-3 text-2xl font-bold">找不到今日行程</h1>
          <p className="mt-3 text-[var(--color-muted)]">
            今日模式只會在旅程中有 {getLocalDateString()} 這一天時開啟。
          </p>
          <Link
            href="/trips"
            className="mt-5 inline-flex rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-bold text-white"
          >
            回旅程列表
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex flex-col items-start justify-between gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/55">今日模式</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-4xl">{trip.title}</h1>
            <p className="mt-2 text-sm text-white/55">
              {day.date} · {paceLabels[trip.pace]}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link
              href={`/trips/${trip.id}/day/${day.id}`}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-bold text-[var(--color-ink)] transition hover:bg-[var(--color-sun)]"
            >
              編輯行程
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-4 py-2 text-sm font-bold transition hover:bg-white/10"
            >
              回首頁
            </Link>
          </div>
        </header>

        <div className="grid flex-1 gap-5 py-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <section className="rounded-lg bg-white p-5 text-[var(--color-ink)] shadow-sm sm:p-7">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--color-muted)]">現在 {currentTime}</p>
                <h2 className="mt-3 text-4xl font-bold leading-tight sm:text-6xl">
                  {nextItem?.title ??
                    (nextStop.status === "finished" ? "今天完成了" : "尚未安排")}
                </h2>
              </div>
              <span className="w-fit rounded-md bg-[var(--color-sun)] px-4 py-2 text-sm font-bold">
                {nextStop.actionLabel}
              </span>
            </div>

            <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--color-muted)]">
              {nextStop.message}
            </p>

            <div className="mt-8 grid border-t border-[var(--color-line)] pt-5 sm:grid-cols-3">
              <div className="border-b border-[var(--color-line)] py-4 sm:border-b-0 sm:border-r sm:pr-5">
                <p className="text-sm text-[var(--color-muted)]">建議時間</p>
                <p className="mt-1 text-2xl font-bold">{nextItem?.startTime ?? "--:--"}</p>
              </div>
              <div className="border-b border-[var(--color-line)] py-4 sm:border-b-0 sm:border-r sm:px-5">
                <p className="text-sm text-[var(--color-muted)]">完成進度</p>
                <p className="mt-1 text-2xl font-bold">
                  {progress.completed} / {progress.total}
                </p>
              </div>
              <div className="py-4 sm:pl-5">
                <p className="text-sm text-[var(--color-muted)]">提醒</p>
                <p className="mt-1 text-2xl font-bold">{warnings.length} 則</p>
              </div>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-[var(--color-mist)]">
              <div
                className="h-full rounded-full bg-[var(--color-teal)] transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </section>

          <aside className="grid gap-4">
            {warnings.length > 0 ? (
              <section className="rounded-lg border border-[var(--color-warn-line)] bg-[var(--color-warn)] p-4 text-[var(--color-warn-ink)]">
                <p className="font-bold">今天可能有點趕</p>
                <p className="mt-1 text-sm leading-6">{warnings[0].message}</p>
              </section>
            ) : (
              <section className="rounded-lg bg-white/10 p-4">
                <p className="font-bold">節奏看起來穩定</p>
                <p className="mt-1 text-sm leading-6 text-white/60">目前沒有偵測到明顯過滿安排。</p>
              </section>
            )}

            <section className="rounded-lg bg-white/10 p-4">
              <p className="text-sm font-semibold text-white/55">後面幾站</p>
              <div className="mt-4 grid gap-3">
                {laterItems.length > 0 ? (
                  laterItems.map((item) => (
                    <div key={item.id} className="border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                      <p className="text-sm text-white/55">
                        {item.startTime} · {categoryLabels[item.type]}
                      </p>
                      <p className="mt-1 font-bold">{item.title}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-white/60">沒有更多行程，保持輕鬆就好。</p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
