"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { paceLabels } from "@/lib/trips/labels";
import { hasTodayTripDay } from "@/lib/trips/today";
import {
  taiwanButton,
  taiwanPrimaryButton,
  taiwanWindowPattern,
} from "@/lib/ui/taiwan-style";
import { useTripStore } from "@/store/trip-store";
import type { Trip } from "@/types/trip";
import { syncTripToCloud } from "@/app/collaboration/actions";

function formatDateRange(trip: Trip) {
  if (trip.startDate === trip.endDate) {
    return trip.startDate;
  }

  return `${trip.startDate} - ${trip.endDate}`;
}

function getTripStats(trip: Trip) {
  const totalItems = trip.days.reduce((sum, day) => sum + day.items.length, 0);

  return {
    days: trip.days.length,
    items: totalItems,
  };
}

export function TripsList() {
  const router = useRouter();
  const trips = useTripStore((state) => state.trips);
  const selectedTripId = useTripStore((state) => state.selectedTripId);
  const hasHydrated = useTripStore((state) => state.hasHydrated);
  const hydrateTrips = useTripStore((state) => state.hydrateTrips);
  const setSelectedTripId = useTripStore((state) => state.setSelectedTripId);
  const [syncingTripId, setSyncingTripId] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");

  useEffect(() => {
    if (!hasHydrated) {
      hydrateTrips();
    }
  }, [hasHydrated, hydrateTrips]);

  function openTrip(tripId: string) {
    setSelectedTripId(tripId);
    router.push("/");
  }

  async function openSharedIdeas(trip: Trip) {
    setSyncingTripId(trip.id);
    setCloudMessage("");
    const result = await syncTripToCloud(trip);
    setSyncingTripId("");
    if (!result.ok) {
      if (result.error === "請先登入。") {
        router.push(`/auth?next=${encodeURIComponent(`/trips/${trip.id}/ideas`)}`);
        return;
      }
      setCloudMessage(result.error);
      return;
    }
    router.push(`/trips/${trip.id}/ideas`);
  }

  return (
    <main className="min-h-screen bg-[#f6f3ea] text-[#183833]">
      <section className="relative overflow-hidden bg-[#fbf8f0]">
        <div className="absolute inset-0 opacity-80" style={taiwanWindowPattern} />
        <div className="relative mx-auto w-full max-w-[88rem] px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b-2 border-[#1a5b4f] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black tracking-[0.24em] text-[#b43c2f]">EASYTRIP</p>
            <h1 className="mt-2 text-4xl font-black leading-tight tracking-normal sm:text-6xl">旅程列表</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#53635f]">
              選一趟旅程，首頁會切換成那趟旅程的總覽。也可以先建立一趟新的旅程，再慢慢加入每天的行程點。
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link
              href="/"
              className={taiwanButton}
            >
              回總覽
            </Link>
            <Link
              href="/trips/new"
              className={taiwanPrimaryButton}
            >
              + 建立旅程
            </Link>
          </div>
        </header>

        {cloudMessage ? <p className="mt-5 border-2 border-[#b43c2f] bg-[#fff4ef] px-4 py-3 text-sm font-black text-[#b43c2f]">{cloudMessage}</p> : null}
        <div className="mt-6 grid gap-4">
          {trips.map((trip) => {
            const stats = getTripStats(trip);
            const isSelected = trip.id === selectedTripId;
            const canOpenTodayMode = hasTodayTripDay(trip);

            return (
              <article
                key={trip.id}
                className="border-2 border-[#183833] bg-[#fffdf7] p-5 shadow-[6px_6px_0_#d8cbb6] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[3px_3px_0_#d8cbb6]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-black">{trip.title}</h2>
                      {isSelected ? (
                        <span className="rotate-[-3deg] border-2 border-[#b43c2f] px-3 py-1 text-xs font-black text-[#b43c2f]">
                          目前選取
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-black text-[#1a5b4f]">
                      {trip.destination} · {formatDateRange(trip)}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 border-t-2 border-[#d8cbb6] pt-4 sm:min-w-72 sm:gap-4 sm:border-t-0 sm:pt-0">
                    <div className="border-l-4 border-[#d9b75f] bg-[#f1eadb] px-3 py-2">
                      <p className="text-xs font-black text-[#7c4b32]">節奏</p>
                      <p className="mt-1 font-black">{paceLabels[trip.pace]}</p>
                    </div>
                    <div className="border-l-4 border-[#d9b75f] bg-[#f1eadb] px-3 py-2">
                      <p className="text-xs font-black text-[#7c4b32]">天數</p>
                      <p className="mt-1 font-black">{stats.days} 天</p>
                    </div>
                    <div className="border-l-4 border-[#d9b75f] bg-[#f1eadb] px-3 py-2">
                      <p className="text-xs font-black text-[#7c4b32]">行程</p>
                      <p className="mt-1 font-black">{stats.items} 站</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => openTrip(trip.id)}
                    className={taiwanPrimaryButton}
                  >
                    查看總覽
                  </button>
                  <Link
                    href={`/trips/${trip.id}/day/${trip.days[0]?.id ?? ""}`}
                    className={taiwanButton}
                  >
                    編輯行程
                  </Link>
                  <button
                    type="button"
                    onClick={() => openSharedIdeas(trip)}
                    disabled={syncingTripId === trip.id}
                    className={`${taiwanButton} disabled:cursor-wait disabled:opacity-60`}
                  >
                    {syncingTripId === trip.id ? "同步中…" : "旅伴候選池"}
                  </button>
                  {canOpenTodayMode ? (
                    <Link
                      href={`/trips/${trip.id}/today`}
                      className={taiwanButton}
                    >
                      今日模式
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        </div>
      </section>
    </main>
  );
}
