"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTripStore } from "@/store/trip-store";
import { categoryLabels, paceLabels } from "@/lib/trips/labels";
import {
  getCurrentTimeString,
  getDayWarnings,
  getNextStopInsight,
} from "@/lib/itinerary/day-insights";
import { getSortedItems } from "@/lib/time/itinerary";
import { getTodayTripDay, getTripDayStatus } from "@/lib/trips/today";

export function HomeDashboard() {
  const [currentTime, setCurrentTime] = useState(() => getCurrentTimeString());
  const trips = useTripStore((state) => state.trips);
  const selectedTripId = useTripStore((state) => state.selectedTripId);
  const selectedDayId = useTripStore((state) => state.selectedDayId);
  const hasHydrated = useTripStore((state) => state.hasHydrated);
  const hydrateTrips = useTripStore((state) => state.hydrateTrips);

  useEffect(() => {
    if (!hasHydrated) {
      hydrateTrips();
    }
  }, [hasHydrated, hydrateTrips]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(getCurrentTimeString());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const trip = trips.find((item) => item.id === selectedTripId) ?? trips[0];
  const selectedDay = trip?.days.find((day) => day.id === selectedDayId) ?? trip?.days[0];
  const items = getSortedItems(selectedDay?.items ?? []);
  const dayStatus = selectedDay ? getTripDayStatus(selectedDay.date) : "today";
  const nextStop = getNextStopInsight(items, currentTime);
  const nextItem = nextStop.item;
  const dayWarnings = trip ? getDayWarnings(items, trip.pace) : [];
  const todayDay = getTodayTripDay(trip);
  const statusTitle =
    dayStatus === "upcoming"
      ? "即將到來"
      : dayStatus === "past"
        ? "行程已結束"
        : nextItem?.title ?? (nextStop.status === "finished" ? "今天完成了" : "今天先慢慢來");
  const statusMessage =
    dayStatus === "upcoming"
      ? `${selectedDay?.date} 的行程還沒開始，可以先檢查路線與時間安排。`
      : dayStatus === "past"
        ? "這一天已經過了，仍可以回顧或編輯行程內容。"
        : nextStop.message;
  const statusLabel =
    dayStatus === "upcoming" ? "即將到來" : dayStatus === "past" ? "已結束" : nextStop.actionLabel;

  if (!trip || !selectedDay) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-surface)] px-5 text-[var(--color-ink)]">
        <section className="max-w-md rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-[var(--color-teal)]">EasyTrip</p>
          <h1 className="mt-3 text-2xl font-bold">還沒有旅程</h1>
          <p className="mt-3 text-[var(--color-muted)]">
            建立第一趟旅程後，這裡會顯示行程路線。
          </p>
          <Link
            href="/trips"
            className="mt-5 inline-flex rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-bold text-white"
          >
            前往旅程列表
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-teal)]">EasyTrip</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">{trip.title}</h1>
          </div>
          <Link
            href="/trips"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-[var(--color-mist)] sm:w-auto"
          >
            所有旅程
          </Link>
        </header>

        <div className="grid flex-1 gap-5 py-8 lg:grid-cols-[1fr_380px] lg:items-center">
          <section className="rounded-lg bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-muted)]">下一站</p>
                <h2 className="mt-2 text-3xl font-bold">{statusTitle}</h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-[var(--color-muted)]">
                  {statusMessage}
                </p>
              </div>
              <span className="w-fit rounded-md bg-[var(--color-sun)] px-4 py-2 text-sm font-bold">
                {statusLabel}
              </span>
            </div>
            {dayWarnings.length > 0 ? (
              <div className="mt-5 rounded-lg border border-[var(--color-warn-line)] bg-[var(--color-warn)] p-4 text-[var(--color-warn-ink)]">
                <p className="text-sm font-bold">這天可能有點趕</p>
                <p className="mt-1 text-sm leading-6">{dayWarnings[0].message}</p>
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-mist)] p-4">
                <p className="text-sm font-bold text-[var(--color-teal)]">這天的節奏看起來穩定</p>
                <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                  目前沒有偵測到過短間隔或過滿安排。
                </p>
              </div>
            )}
            <Link
              href={`/trips/${trip.id}/day/${selectedDay.id}`}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[var(--color-ink)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-teal)] sm:w-auto"
            >
              編輯這一天
            </Link>
            {todayDay ? (
              <Link
                href={`/trips/${trip.id}/today`}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[var(--color-line)] px-4 py-3 text-sm font-bold transition hover:border-[var(--color-teal)] hover:text-[var(--color-teal)] sm:ml-3 sm:mt-6 sm:w-auto"
              >
                開啟今日模式
              </Link>
            ) : null}

            <div className="mt-8 grid border-t border-[var(--color-line)] pt-5 sm:grid-cols-3">
              <div className="border-b border-[var(--color-line)] py-4 sm:border-b-0 sm:border-r sm:pr-5">
                <p className="text-sm text-[var(--color-muted)]">目前時間</p>
                <p className="mt-1 text-2xl font-bold">{currentTime}</p>
              </div>
              <div className="border-b border-[var(--color-line)] py-4 sm:border-b-0 sm:border-r sm:px-5">
                <p className="text-sm text-[var(--color-muted)]">建議抵達</p>
                <p className="mt-1 text-2xl font-bold">
                  {dayStatus === "today" ? nextItem?.startTime ?? "--:--" : selectedDay.date}
                </p>
              </div>
              <div className="py-4 sm:pl-5">
                <p className="text-sm text-[var(--color-muted)]">提醒</p>
                <p className="mt-1 text-2xl font-bold">{dayWarnings.length} 則</p>
              </div>
            </div>
          </section>

          <aside className="rounded-lg bg-[var(--color-ink)] p-5 text-white shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-white/60">行程路線</p>
              <span className="rounded-md bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
                {paceLabels[trip.pace]}
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="grid size-8 place-items-center rounded-md bg-white text-sm font-bold text-[var(--color-ink)]">
                      {index + 1}
                    </span>
                    {index < items.length - 1 ? <span className="h-full w-px bg-white/20" /> : null}
                  </div>
                  <div className="pb-5">
                    <p className="text-sm text-white/55">
                      {item.startTime} - {item.endTime} · {categoryLabels[item.type]}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">{item.title}</h3>
                    {item.note ? <p className="mt-1 text-sm text-white/60">{item.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
