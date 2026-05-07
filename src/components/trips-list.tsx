"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { paceLabels } from "@/lib/trips/labels";
import { hasTodayTripDay } from "@/lib/trips/today";
import { useTripStore } from "@/store/trip-store";
import type { Trip } from "@/types/trip";

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

  useEffect(() => {
    if (!hasHydrated) {
      hydrateTrips();
    }
  }, [hasHydrated, hydrateTrips]);

  function openTrip(tripId: string) {
    setSelectedTripId(tripId);
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <section className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-[var(--color-line)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-teal)]">EasyTrip</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">旅程列表</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
              選一趟旅程，首頁會切換成那趟旅程的總覽。也可以先建立一趟新的旅程，再慢慢加入每天的行程點。
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-[var(--color-mist)]"
            >
              回總覽
            </Link>
            <Link
              href="/trips/new"
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-teal)]"
            >
              + 建立旅程
            </Link>
          </div>
        </header>

        <div className="mt-6 grid gap-4">
          {trips.map((trip) => {
            const stats = getTripStats(trip);
            const isSelected = trip.id === selectedTripId;
            const canOpenTodayMode = hasTodayTripDay(trip);

            return (
              <article
                key={trip.id}
                className="rounded-lg border border-[var(--color-line)] bg-white p-5 shadow-sm transition hover:border-[var(--color-teal)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold">{trip.title}</h2>
                      {isSelected ? (
                        <span className="rounded-md bg-[var(--color-sun)] px-3 py-1 text-xs font-bold">
                          目前選取
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-teal)]">
                      {trip.destination} · {formatDateRange(trip)}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3 border-t border-[var(--color-line)] pt-4 sm:min-w-72 sm:gap-4 sm:border-t-0 sm:pt-0">
                    <div>
                      <p className="text-xs text-[var(--color-muted)]">節奏</p>
                      <p className="mt-1 font-bold">{paceLabels[trip.pace]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-muted)]">天數</p>
                      <p className="mt-1 font-bold">{stats.days} 天</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-muted)]">行程</p>
                      <p className="mt-1 font-bold">{stats.items} 站</p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => openTrip(trip.id)}
                    className="min-h-10 rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--color-teal)]"
                  >
                    查看總覽
                  </button>
                  <Link
                    href={`/trips/${trip.id}/day/${trip.days[0]?.id ?? ""}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-bold transition hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
                  >
                    編輯行程
                  </Link>
                  {canOpenTodayMode ? (
                    <Link
                      href={`/trips/${trip.id}/today`}
                      className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-bold transition hover:border-[var(--color-teal)] hover:text-[var(--color-teal)]"
                    >
                      今日模式
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-bold text-[var(--color-muted)]">
                      非今日行程
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
