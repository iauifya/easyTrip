"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getCurrentTimeString,
  getDayProgress,
  getDayWarnings,
  getNextStopInsight,
} from "@/lib/itinerary/day-insights";
import {
  formatDistanceMeters,
  getRouteTravelMethodLabel,
  getRouteEstimateStops,
  type RouteEstimatesResponse,
  type RouteTravelEstimate,
} from "@/lib/routes/travel-estimates";
import { createGoogleMapsPlaceUrl } from "@/lib/places/google-maps";
import { categoryLabels, paceLabels } from "@/lib/trips/labels";
import { getSortedItems, timeToMinutes } from "@/lib/time/itinerary";
import { getLocalDateString, getTodayTripDay } from "@/lib/trips/today";
import { taiwanButton, taiwanGoldButton, taiwanTilePattern } from "@/lib/ui/taiwan-style";
import { useTripStore } from "@/store/trip-store";
import type { ItineraryItem } from "@/types/trip";

function getItemStatus(item: ItineraryItem, currentTime: string) {
  const currentMinutes = timeToMinutes(currentTime);
  const startMinutes = timeToMinutes(item.startTime);
  const endMinutes = timeToMinutes(item.endTime);

  if (currentMinutes < startMinutes) {
    return "upcoming";
  }

  if (currentMinutes > endMinutes) {
    return "done";
  }

  return "active";
}

function getItemGoogleMapsUrl(item: ItineraryItem) {
  if (
    !item.place ||
    !(
      item.place.googlePlaceId ||
      (typeof item.place.lat === "number" && typeof item.place.lng === "number") ||
      item.place.googleMapsUrl ||
      item.place.address
    )
  ) {
    return undefined;
  }

  return createGoogleMapsPlaceUrl({
    title: item.title,
    address: item.place.address,
    googlePlaceId: item.place.googlePlaceId,
    googleMapsUrl: item.place.googleMapsUrl,
    lat: item.place.lat,
    lng: item.place.lng,
  });
}

function getStatusLabel(status: string) {
  if (status === "active") {
    return "進行中";
  }

  if (status === "done") {
    return "完成";
  }

  return "待出發";
}

function getStatusClass(status: string) {
  if (status === "active") {
    return "border-[#b43c2f] bg-[#fff7d8] text-[#b43c2f]";
  }

  if (status === "done") {
    return "border-[#1a5b4f] bg-[#e9efe7] text-[#1a5b4f]";
  }

  return "border-[#d8cbb6] bg-[#fffdf7] text-[#53635f]";
}

function getMoveLegId(items: ItineraryItem[], nextIndex: number, nextStatus: string) {
  if (nextIndex < 0) {
    return undefined;
  }

  if (nextStatus === "active" && items[nextIndex + 1]) {
    return `${items[nextIndex].id}-${items[nextIndex + 1].id}`;
  }

  if (nextStatus === "upcoming" && items[nextIndex - 1]) {
    return `${items[nextIndex - 1].id}-${items[nextIndex].id}`;
  }

  return undefined;
}

function getBestEstimate(estimates: RouteTravelEstimate[], legId: string | undefined) {
  if (!legId) {
    return undefined;
  }

  return estimates
    .filter((estimate) => estimate.id === legId)
    .sort((first, second) => first.estimatedMinutes - second.estimatedMinutes)[0];
}

export function TodayMode({ tripId }: { tripId: string }) {
  const [currentTime, setCurrentTime] = useState(() => getCurrentTimeString());
  const [routeEstimates, setRouteEstimates] = useState<RouteTravelEstimate[]>([]);
  const [routeEstimateMessage, setRouteEstimateMessage] = useState("");
  const [isEstimatingRoute, setIsEstimatingRoute] = useState(false);
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
  const routeEstimateStopsJson = JSON.stringify(getRouteEstimateStops(items, day?.date));
  const nextStop = getNextStopInsight(items, currentTime);
  const progress = getDayProgress(items, currentTime);
  const warnings = trip ? getDayWarnings(items, trip.pace) : [];
  const nextItem = nextStop.item;
  const moveLegId = getMoveLegId(items, nextStop.itemIndex, nextStop.status);
  const moveEstimate = getBestEstimate(routeEstimates, moveLegId);
  const remainingItems = items.filter((item) => getItemStatus(item, currentTime) !== "done");

  useEffect(() => {
    if (items.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsEstimatingRoute(true);

      try {
        const response = await fetch("/api/routes/estimate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stops: JSON.parse(routeEstimateStopsJson),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("route_estimate_failed");
        }

        const result = (await response.json()) as RouteEstimatesResponse;

        setRouteEstimates(result.estimates);
        setRouteEstimateMessage(result.message ?? "");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRouteEstimates([]);
          setRouteEstimateMessage("暫時無法估算今日移動時間。");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsEstimatingRoute(false);
        }
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [items.length, routeEstimateStopsJson]);

  if (!trip || !day) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f3ea] px-5 text-[#183833]">
        <section className="border-2 border-[#183833] bg-[#fffdf7] p-6 text-center shadow-[8px_8px_0_#1a5b4f]">
          <p className="text-sm font-black tracking-[0.2em] text-[#b43c2f]">EasyTrip</p>
          <h1 className="mt-3 text-2xl font-black">今天沒有這趟旅程</h1>
          <p className="mt-3 text-[#53635f]">
            今天是 {getLocalDateString()}，這趟旅程沒有對應的單日行程。
          </p>
          <Link href="/trips" className={`${taiwanButton} mt-5`}>
            回旅程列表
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#183833] text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-15" style={taiwanTilePattern} />
        <div className="relative mx-auto flex min-h-screen w-full max-w-[80rem] flex-col px-5 py-5 sm:px-8 lg:px-10">
          <header className="flex flex-col items-start justify-between gap-3 border-b-2 border-[#f2d179] pb-5 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="text-sm font-black tracking-[0.24em] text-[#f2d179]">TODAY MODE</p>
              <h1 className="mt-1 text-3xl font-black sm:text-5xl">{trip.title}</h1>
              <p className="mt-2 text-sm font-bold text-white/65">
                {day.date} · {paceLabels[trip.pace]} · 目前 {currentTime}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              <Link href={`/trips/${trip.id}/day/${day.id}`} className={taiwanGoldButton}>
                編輯今日行程
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-10 items-center justify-center border-2 border-white/25 px-4 py-2 text-sm font-black transition hover:bg-white/10"
              >
                回總覽
              </Link>
            </div>
          </header>

          <div className="grid flex-1 gap-5 py-6 lg:grid-cols-[1fr_380px] lg:items-start">
            <section className="border-2 border-[#183833] bg-[#fbf8f0] p-5 text-[#183833] shadow-[8px_8px_0_#b43c2f] sm:p-7">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#1a5b4f]">
                    {nextStop.status === "active" ? "現在停留" : "下一站"}
                  </p>
                  <h2 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">
                    {nextItem?.title ?? (nextStop.status === "finished" ? "今日完成" : "還沒有行程")}
                  </h2>
                </div>
                <span className="w-fit rotate-[-4deg] border-2 border-[#b43c2f] px-4 py-2 text-sm font-black text-[#b43c2f]">
                  {nextStop.actionLabel}
                </span>
              </div>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#53635f]">{nextStop.message}</p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="min-w-0 border-l-4 border-[#d9b75f] bg-[#f1eadb] px-4 py-3">
                  <p className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">開始時間</p>
                  <p className="mt-1 text-2xl font-black">{nextItem?.startTime ?? "--:--"}</p>
                </div>
                <div className="min-w-0 border-l-4 border-[#d9b75f] bg-[#f1eadb] px-4 py-3">
                  <p className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">下一段移動</p>
                  <p className="mt-1 text-2xl font-black">
                    {moveEstimate ? `${moveEstimate.estimatedMinutes} 分` : isEstimatingRoute ? "估算中" : "--"}
                  </p>
                  {moveEstimate ? (
                    <p className="mt-1 text-xs font-black text-[#7c4b32]">
                      {getRouteTravelMethodLabel(moveEstimate.method)} · {formatDistanceMeters(moveEstimate.distanceMeters)}
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0 border-l-4 border-[#d9b75f] bg-[#f1eadb] px-4 py-3">
                  <p className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">今日進度</p>
                  <p className="mt-1 text-2xl font-black">
                    {progress.completed} / {progress.total}
                  </p>
                </div>
              </div>

              {routeEstimateMessage ? (
                <p className="mt-4 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-sm font-black text-[#53635f]">
                  {routeEstimateMessage}
                </p>
              ) : null}

              <div className="mt-6 h-4 overflow-hidden border-2 border-[#183833] bg-[#e9efe7]">
                <div className="h-full bg-[#1a5b4f] transition-all" style={{ width: `${progress.percent}%` }} />
              </div>
            </section>

            <aside className="grid gap-4">
              {warnings.length > 0 ? (
                <section className="border-2 border-[#d9b75f] bg-[#fff7d8] p-4 text-[#6f4e00] shadow-[5px_5px_0_#b43c2f]">
                  <p className="font-black">{warnings[0].title}</p>
                  <p className="mt-1 text-sm leading-6">{warnings[0].message}</p>
                </section>
              ) : (
                <section className="border-2 border-white/20 bg-white/10 p-4">
                  <p className="font-black">今日節奏穩定</p>
                  <p className="mt-1 text-sm leading-6 text-white/65">目前沒有過密或過長的安排提醒。</p>
                </section>
              )}

              <section className="border-2 border-white/20 bg-white/10 p-4">
                <p className="text-sm font-black tracking-[0.18em] text-[#f2d179]">接下來</p>
                <div className="mt-4 grid gap-3">
                  {remainingItems.length > 0 ? (
                    remainingItems.map((item) => {
                      const status = getItemStatus(item, currentTime);
                      const itemGoogleMapsUrl = getItemGoogleMapsUrl(item);

                      return (
                        <div key={item.id} className="border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-white/60">
                                {item.startTime} - {item.endTime} · {categoryLabels[item.type]}
                              </p>
                              <p className="mt-1 font-black">{item.title}</p>
                              {itemGoogleMapsUrl ? (
                                <a
                                  href={itemGoogleMapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex border border-white/25 px-2 py-1 text-xs font-black text-[#f2d179]"
                                >
                                  開啟 Maps
                                </a>
                              ) : null}
                            </div>
                  <span className={`shrink-0 whitespace-nowrap border px-2 py-1 text-xs font-black ${getStatusClass(status)}`}>
                              {getStatusLabel(status)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm leading-6 text-white/65">今天剩下的行程已經走完，可以放慢收尾。</p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
