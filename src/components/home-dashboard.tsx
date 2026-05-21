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
import {
  taiwanButton,
  taiwanPrimaryButton,
  taiwanTilePattern,
  taiwanWindowPattern,
} from "@/lib/ui/taiwan-style";

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
      <main className="grid min-h-screen place-items-center bg-[#f6f3ea] px-5 text-[#183833]">
        <section className="border-2 border-[#183833] bg-[#fffdf7] p-6 text-center shadow-[8px_8px_0_#1a5b4f]">
          <p className="text-sm font-black tracking-[0.2em] text-[#b43c2f]">EasyTrip</p>
          <h1 className="mt-3 text-2xl font-black">還沒有旅程</h1>
          <p className="mt-3 text-[#53635f]">
            建立第一趟旅程後，這裡會顯示行程路線。
          </p>
          <Link
            href="/trips"
            className={`${taiwanPrimaryButton} mt-5`}
          >
            前往旅程列表
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f3ea] text-[#183833]">
      <section className="relative overflow-hidden bg-[#fbf8f0]">
        <div className="absolute inset-0 opacity-80" style={taiwanWindowPattern} />
        <div className="relative mx-auto flex min-h-screen w-full max-w-[88rem] flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col items-start justify-between gap-4 border-b-2 border-[#1a5b4f] pb-5 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-black tracking-[0.24em] text-[#b43c2f]">EASYTRIP</p>
            <h1 className="mt-2 text-4xl font-black leading-tight tracking-normal sm:text-6xl">{trip.title}</h1>
          </div>
          <Link
            href="/trips"
            className={`${taiwanButton} w-full sm:w-auto`}
          >
            所有旅程
          </Link>
        </header>

        <div className="grid flex-1 gap-5 py-8 lg:grid-cols-[1fr_380px] lg:items-center">
          <section className="border-2 border-[#183833] bg-[#fffdf7] p-5 shadow-[8px_8px_0_#1a5b4f] sm:p-7">
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row">
              <div className="min-w-0">
                <p className="text-sm font-black text-[#1a5b4f]">下一站</p>
                <h2 className="mt-2 text-3xl font-black leading-tight sm:text-5xl">{statusTitle}</h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-[#53635f]">
                  {statusMessage}
                </p>
              </div>
              <span className="w-fit rotate-[-4deg] border-2 border-[#b43c2f] px-4 py-2 text-sm font-black text-[#b43c2f]">
                {statusLabel}
              </span>
            </div>
            {dayWarnings.length > 0 ? (
              <div className="mt-5 border-2 border-[#d9b75f] bg-[#fff7d8] p-4 text-[#6f4e00] shadow-[4px_4px_0_#d8cbb6]">
                <p className="text-sm font-black">這天可能有點趕</p>
                <p className="mt-1 text-sm leading-6">{dayWarnings[0].message}</p>
              </div>
            ) : (
              <div className="mt-5 border-2 border-[#1a5b4f] bg-[#e9efe7] p-4 shadow-[4px_4px_0_#d8cbb6]">
                <p className="text-sm font-black text-[#1a5b4f]">這天的節奏看起來穩定</p>
                <p className="mt-1 text-sm leading-6 text-[#53635f]">
                  目前沒有偵測到過短間隔或過滿安排。
                </p>
              </div>
            )}
            <Link
              href={`/trips/${trip.id}/day/${selectedDay.id}`}
              className={`${taiwanPrimaryButton} mt-6 w-full sm:w-auto`}
            >
              編輯這一天
            </Link>
            {todayDay ? (
              <Link
                href={`/trips/${trip.id}/today`}
                className={`${taiwanButton} mt-3 w-full sm:ml-3 sm:mt-6 sm:w-auto`}
              >
                開啟今日模式
              </Link>
            ) : null}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="border-l-4 border-[#d9b75f] bg-[#f1eadb] px-4 py-3">
                <p className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">目前時間</p>
                <p className="mt-1 text-2xl font-black">{currentTime}</p>
              </div>
              <div className="border-l-4 border-[#d9b75f] bg-[#f1eadb] px-4 py-3">
                <p className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">建議抵達</p>
                <p className="mt-1 text-2xl font-black">
                  {dayStatus === "today" ? nextItem?.startTime ?? "--:--" : selectedDay.date}
                </p>
              </div>
              <div className="border-l-4 border-[#d9b75f] bg-[#f1eadb] px-4 py-3">
                <p className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">提醒</p>
                <p className="mt-1 text-2xl font-black">{dayWarnings.length} 則</p>
              </div>
            </div>
          </section>

          <aside className="relative overflow-hidden border-2 border-[#183833] bg-[#0c4160] p-5 text-white shadow-[8px_8px_0_#b43c2f] sm:p-6">
            <div className="absolute inset-0 opacity-20" style={taiwanTilePattern} />
            <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-black tracking-[0.18em] text-[#f2d179]">行程路線</p>
              <span className="border-2 border-white/20 bg-white/10 px-3 py-1 text-xs font-black text-white/70">
                {paceLabels[trip.pace]}
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="grid size-9 place-items-center border-2 border-white bg-[#b43c2f] text-sm font-black text-white">
                      {index + 1}
                    </span>
                    {index < items.length - 1 ? <span className="h-full w-1 bg-white/25" /> : null}
                  </div>
                  <div className="pb-5">
                    <p className="text-sm text-white/55">
                      {item.startTime} - {item.endTime} · {categoryLabels[item.type]}
                    </p>
                    <h3 className="mt-1 text-lg font-black">{item.title}</h3>
                    {item.note ? <p className="mt-1 text-sm text-white/60">{item.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </aside>
        </div>
        </div>
      </section>
    </main>
  );
}
