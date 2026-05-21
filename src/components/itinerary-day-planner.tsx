"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  createItineraryItemFromInput,
  itineraryItemSchema,
  type ItineraryItemInput,
} from "@/lib/itinerary/create-itinerary-item";
import {
  getCurrentTimeString,
  getDayWarnings,
  getNextStopInsight,
} from "@/lib/itinerary/day-insights";
import { getDefaultStayMinutes, suggestItemType } from "@/lib/itinerary/item-suggestions";
import {
  createGoogleMapsPreview,
  getGoogleMapsPlaceName,
  type GoogleMapsPreview,
} from "@/lib/places/google-maps";
import { categoryLabels, paceLabels } from "@/lib/trips/labels";
import { adjustTripSchedule } from "@/lib/trips/schedule";
import { getSortedItems, getTightGapItemIds, minutesToTime, timeToMinutes } from "@/lib/time/itinerary";
import { getTodayTripDay, getTripDayStatus } from "@/lib/trips/today";
import {
  getRouteEstimateStop,
  type RouteEstimatesResponse,
  type RouteTravelEstimate,
  type UnavailableRouteLeg,
} from "@/lib/routes/travel-estimates";
import { RoutePreview } from "@/components/route-preview";
import { useTripStore } from "@/store/trip-store";
import type { ItineraryItem, ItineraryItemType } from "@/types/trip";

const itemTypeOptions: Array<{
  value: ItineraryItemType;
  label: string;
}> = [
  { value: "attraction", label: categoryLabels.attraction },
  { value: "food", label: categoryLabels.food },
  { value: "hotel", label: categoryLabels.hotel },
  { value: "transport", label: categoryLabels.transport },
  { value: "shopping", label: categoryLabels.shopping },
  { value: "rest", label: categoryLabels.rest },
];

const fallbackValues: ItineraryItemInput = {
  title: "",
  type: "attraction",
  startTime: "08:00",
  endTime: "09:30",
  address: "",
  googleMapsUrl: "",
  note: "",
};

const placeNotes = [
  "捷運中山站 2 號出口",
  "巷口騎樓下，午後人潮較多",
  "紅磚立面，適合慢慢逛",
  "入口從民生西路側進去",
];

const windowPattern = {
  backgroundImage:
    "linear-gradient(45deg, rgba(26, 91, 79, 0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(26, 91, 79, 0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(26, 91, 79, 0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(26, 91, 79, 0.08) 75%)",
  backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
  backgroundSize: "24px 24px",
};

function getFieldError(error: unknown) {
  return typeof error === "object" && error && "message" in error
    ? String(error.message)
    : undefined;
}

function formatDayLabel(date: string, index: number) {
  return `Day ${index + 1} · ${date}`;
}

function toFormValues(item: ItineraryItem): ItineraryItemInput {
  return {
    title: item.title,
    type: item.type,
    startTime: item.startTime,
    endTime: item.endTime,
    address: item.place?.address ?? "",
    googlePlaceId: item.place?.googlePlaceId ?? "",
    googleMapsUrl: item.place?.googleMapsUrl ?? "",
    lat: item.place?.lat,
    lng: item.place?.lng,
    note: item.note ?? "",
  };
}

function PlaceSearchPreview({ preview }: { preview?: GoogleMapsPreview }) {
  if (!preview) {
    return (
      <div className="border-2 border-white/15 bg-white/10 p-3 text-sm font-bold text-white/65">
        輸入地點名稱或貼上 Google Maps 連結後，這裡會顯示搜尋預覽。
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-2 border-white/20 bg-white text-[#183833]">
      <iframe
        title="Google Maps place search preview"
        src={preview.mapPreviewUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-44 w-full border-0"
      />
      <div className="grid gap-2 border-t-2 border-[#d8cbb6] bg-[#fffdf7] p-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7c4b32]">
          {preview.source === "google_maps_url" ? "Google Maps URL" : "Place Search"}
        </p>
        <p className="break-words text-sm font-black">{preview.displayQuery}</p>
        <a
          href={preview.googleMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="w-fit border-2 border-[#183833] bg-[#d9b75f] px-3 py-2 text-xs font-black text-[#183833] shadow-[2px_2px_0_#183833]"
        >
          開啟 Google Maps
        </a>
      </div>
    </div>
  );
}

export function ItineraryDayPlanner({ tripId, dayId }: { tripId: string; dayId: string }) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => getCurrentTimeString());
  const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [googleMapsLookupMessage, setGoogleMapsLookupMessage] = useState("");
  const [routeEstimates, setRouteEstimates] = useState<RouteTravelEstimate[]>([]);
  const [unavailableRouteLegs, setUnavailableRouteLegs] = useState<UnavailableRouteLeg[]>([]);
  const [routeEstimateMessage, setRouteEstimateMessage] = useState("");
  const [isEstimatingRoute, setIsEstimatingRoute] = useState(false);
  const trips = useTripStore((state) => state.trips);
  const hasHydrated = useTripStore((state) => state.hasHydrated);
  const hydrateTrips = useTripStore((state) => state.hydrateTrips);
  const setSelectedTripId = useTripStore((state) => state.setSelectedTripId);
  const setSelectedDayId = useTripStore((state) => state.setSelectedDayId);
  const addItineraryItem = useTripStore((state) => state.addItineraryItem);
  const updateTrip = useTripStore((state) => state.updateTrip);
  const updateItineraryItem = useTripStore((state) => state.updateItineraryItem);
  const deleteItineraryItem = useTripStore((state) => state.deleteItineraryItem);

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = useForm<ItineraryItemInput>({
    defaultValues: fallbackValues,
  });

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

  useEffect(() => {
    setSelectedTripId(tripId);
    setSelectedDayId(dayId);
  }, [dayId, setSelectedDayId, setSelectedTripId, tripId]);

  const selectedType = useWatch({
    control,
    name: "type",
  });
  const title = useWatch({
    control,
    name: "title",
  });
  const address = useWatch({
    control,
    name: "address",
  });
  const googleMapsUrl = useWatch({
    control,
    name: "googleMapsUrl",
  });
  const googlePlaceId = useWatch({
    control,
    name: "googlePlaceId",
  });
  const lat = useWatch({
    control,
    name: "lat",
  });
  const lng = useWatch({
    control,
    name: "lng",
  });

  const trip = trips.find((item) => item.id === tripId);
  const day = trip?.days.find((item) => item.id === dayId);
  const items = getSortedItems(day?.items ?? []);
  const routeEstimateStopsJson = JSON.stringify(items.map(getRouteEstimateStop));
  const visibleRouteEstimates = items.length >= 2 ? routeEstimates : [];
  const visibleUnavailableRouteLegs = items.length >= 2 ? unavailableRouteLegs : [];
  const visibleRouteEstimateMessage = items.length >= 2 ? routeEstimateMessage : "";
  const tightGapItemIds = getTightGapItemIds(items);
  const dayWarnings = trip ? getDayWarnings(items, trip.pace) : [];
  const dayStatus = day ? getTripDayStatus(day.date) : "today";
  const nextStop = getNextStopInsight(items, currentTime);
  const editingItem = items.find((item) => item.id === editingItemId);
  const todayDay = getTodayTripDay(trip);
  const lastItemEndTime = items.at(-1)?.endTime ?? "08:00";
  const nextDefaultStartTime = items.length > 0 ? minutesToTime(timeToMinutes(lastItemEndTime) + 30) : "08:00";
  const dayIdForDefaults = day?.id;
  const placeSearchPreview = createGoogleMapsPreview({
    title: title ?? "",
    address: address ?? "",
    googlePlaceId: googlePlaceId ?? "",
    googleMapsUrl: googleMapsUrl ?? "",
    lat,
    lng,
  });
  const suggestedGooglePlaceName = googleMapsUrl ? getGoogleMapsPlaceName(googleMapsUrl) : undefined;
  const visibleGoogleMapsLookupMessage = googleMapsUrl?.trim() ? googleMapsLookupMessage : "";

  function getDefaultTimesFromLastItem(type: ItineraryItemType = "attraction") {
    return {
      startTime: nextDefaultStartTime,
      endTime: minutesToTime(timeToMinutes(nextDefaultStartTime) + getDefaultStayMinutes(type)),
    };
  }

  const nextStopTitle =
    dayStatus === "upcoming"
      ? "即將到來"
      : dayStatus === "past"
        ? "行程已結束"
        : nextStop.item?.title ??
          (nextStop.status === "finished" ? "今天完成了" : "尚未安排行程");
  const nextStopMessage =
    dayStatus === "upcoming"
      ? `${day?.date} 的行程還沒開始，可以先把地點和移動緩衝排好。`
      : dayStatus === "past"
        ? "這一天已經過了，仍可以回顧或微調行程。"
        : nextStop.message;
  const nextStopLabel =
    dayStatus === "upcoming" ? "即將到來" : dayStatus === "past" ? "已結束" : nextStop.actionLabel;

  useEffect(() => {
    if (!editingItemId && title) {
      const suggestedType = suggestItemType(title);
      const startTime = nextDefaultStartTime;

      setValue("type", suggestedType);
      setValue("startTime", startTime);
      setValue("endTime", minutesToTime(timeToMinutes(startTime) + getDefaultStayMinutes(suggestedType)));
    }
  }, [editingItemId, nextDefaultStartTime, setValue, title]);

  useEffect(() => {
    if (!title?.trim() && suggestedGooglePlaceName) {
      setValue("title", suggestedGooglePlaceName, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [setValue, suggestedGooglePlaceName, title]);

  useEffect(() => {
    const trimmedUrl = googleMapsUrl?.trim();

    if (!trimmedUrl) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setGoogleMapsLookupMessage("正在解析 Google Maps 連結...");

      try {
        const response = await fetch("/api/places/resolve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: trimmedUrl }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("resolve_failed");
        }

        const place = (await response.json()) as {
          displayName?: string;
          formattedAddress?: string;
          googlePlaceId?: string;
          lat?: number;
          lng?: number;
        };

        if (!title?.trim() && place.displayName) {
          setValue("title", place.displayName, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (place.formattedAddress) {
          setValue("address", place.formattedAddress, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (place.googlePlaceId) {
          setValue("googlePlaceId", place.googlePlaceId, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (typeof place.lat === "number") {
          setValue("lat", place.lat, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        if (typeof place.lng === "number") {
          setValue("lng", place.lng, {
            shouldDirty: true,
            shouldValidate: true,
          });
        }

        setGoogleMapsLookupMessage(
          place.formattedAddress
            ? "已解析 Google 地點與正式地址。"
            : place.displayName
              ? "已自動帶入 Google 地點名稱。"
              : "已保留 Google Maps 連結。",
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setGoogleMapsLookupMessage("目前無法解析這個 Google Maps 連結。");
        }
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [googleMapsUrl, setValue, title]);

  useEffect(() => {
    if (!editingItemId && dayIdForDefaults) {
      reset({
        ...fallbackValues,
        startTime: nextDefaultStartTime,
        endTime: minutesToTime(timeToMinutes(nextDefaultStartTime) + getDefaultStayMinutes("attraction")),
      });
    }
  }, [dayIdForDefaults, editingItemId, nextDefaultStartTime, reset]);

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
        setUnavailableRouteLegs(result.unavailableLegs ?? []);
        setRouteEstimateMessage(result.message ?? "");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setRouteEstimates([]);
          setUnavailableRouteLegs([]);
          setRouteEstimateMessage("暫時無法估算移動時間。");
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

  function applySchemaErrors(error: z.ZodError<ItineraryItemInput>) {
    for (const issue of error.issues) {
      const field = issue.path[0];

      if (typeof field === "string") {
        setError(field as keyof ItineraryItemInput, {
          type: "manual",
          message: issue.message,
        });
      }
    }
  }

  function shouldUseMobileEditor() {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
  }

  function startEdit(item: ItineraryItem) {
    setEditingItemId(item.id);
    reset(toFormValues(item));
    setIsMobileEditorOpen(shouldUseMobileEditor());
  }

  function cancelEdit() {
    setEditingItemId(null);
    reset({
      ...fallbackValues,
      ...getDefaultTimesFromLastItem(),
    });
    setIsMobileEditorOpen(false);
  }

  function startAddItem() {
    setEditingItemId(null);
    reset({
      ...fallbackValues,
      ...getDefaultTimesFromLastItem(),
    });
    setIsMobileEditorOpen(shouldUseMobileEditor());
  }

  function updateSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trip) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const startDate = String(formData.get("startDate") ?? "");
    const dayCount = Number(formData.get("dayCount"));

    try {
      updateTrip(adjustTripSchedule(trip, startDate, dayCount));
      setScheduleMessage("行程日期已更新");
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : "行程日期更新失敗");
    }
  }

  function onSubmit(values: ItineraryItemInput) {
    const result = itineraryItemSchema.safeParse(values);

    if (!result.success) {
      applySchemaErrors(result.error);
      return;
    }

    if (editingItem) {
      updateItineraryItem(tripId, dayId, createItineraryItemFromInput(result.data, editingItem));
    } else {
      addItineraryItem(tripId, dayId, createItineraryItemFromInput(result.data));
    }

    cancelEdit();
  }

  function renderItineraryForm() {
    return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-5 grid gap-4">
      <label className="grid gap-2">
        <span className="text-sm font-black">名稱</span>
        <input
          {...register("title")}
          placeholder="例如：赤崁樓"
          className="border-2 border-white/20 bg-white px-3 py-3 text-[#183833] outline-none transition focus:border-[#f2d179]"
        />
        {errors.title ? (
          <span className="text-sm font-black text-[#f2d179]">
            {getFieldError(errors.title)}
          </span>
        ) : null}
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-black">Google Maps 連結</span>
        <input
          {...register("googleMapsUrl")}
          placeholder="貼上地點或路線網址"
          className="border-2 border-white/20 bg-white px-3 py-3 text-[#183833] outline-none transition focus:border-[#f2d179]"
        />
        {errors.googleMapsUrl ? (
          <span className="text-sm font-black text-[#f2d179]">
            {getFieldError(errors.googleMapsUrl)}
          </span>
        ) : null}
        {visibleGoogleMapsLookupMessage ? (
          <span className="text-xs font-bold text-white/70">{visibleGoogleMapsLookupMessage}</span>
        ) : null}
      </label>
      <input type="hidden" {...register("address")} />
      <input type="hidden" {...register("googlePlaceId")} />
      <input type="hidden" {...register("lat")} />
      <input type="hidden" {...register("lng")} />

      <label className="grid gap-2">
        <span className="text-sm font-black">類型</span>
        <select
          {...register("type")}
          className="border-2 border-white/20 bg-white px-3 py-3 text-[#183833] outline-none transition focus:border-[#f2d179]"
        >
          {itemTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="text-xs font-bold text-white/60">目前類型：{categoryLabels[selectedType]}</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="text-sm font-black">開始</span>
          <input
            type="time"
            {...register("startTime")}
            className="border-2 border-white/20 bg-white px-3 py-3 text-[#183833] outline-none transition focus:border-[#f2d179]"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">結束</span>
          <input
            type="time"
            {...register("endTime")}
            className="border-2 border-white/20 bg-white px-3 py-3 text-[#183833] outline-none transition focus:border-[#f2d179]"
          />
        </label>
      </div>
      {errors.startTime || errors.endTime ? (
        <span className="text-sm font-black text-[#f2d179]">
          {getFieldError(errors.startTime) ?? getFieldError(errors.endTime)}
        </span>
      ) : null}

      <label className="grid gap-2">
        <span className="text-sm font-black">備註</span>
        <textarea
          {...register("note")}
          rows={4}
          placeholder="例如：這裡容易迷路，先找 2 號出口。"
          className="resize-none border-2 border-white/20 bg-white px-3 py-3 text-[#183833] outline-none transition focus:border-[#f2d179]"
        />
      </label>

      <PlaceSearchPreview preview={placeSearchPreview} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="border-2 border-[#183833] bg-[#d9b75f] px-4 py-3 text-sm font-black text-[#183833] shadow-[4px_4px_0_#183833] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_#183833] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {editingItem ? "儲存修改" : "+ 新增行程點"}
      </button>
      {editingItem || isMobileEditorOpen ? (
        <button
          type="button"
          onClick={cancelEdit}
          className="border-2 border-white/25 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
        >
          {editingItem ? "取消編輯" : "關閉"}
        </button>
      ) : null}
    </form>
    );
  }

  if (!trip || !day) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-surface)] px-5 text-[var(--color-ink)]">
        <section className="max-w-md rounded-lg bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-semibold text-[var(--color-teal)]">EasyTrip</p>
          <h1 className="mt-3 text-2xl font-bold">找不到這一天</h1>
          <p className="mt-3 text-[var(--color-muted)]">回旅程列表選一趟旅程，再繼續編輯行程。</p>
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
    <main className="min-h-screen bg-[#f6f3ea] text-[#183833]">
      <section className="relative overflow-hidden border-b border-[#d8cbb6] bg-[#fbf8f0]">
        <div className="absolute inset-0 opacity-80" style={windowPattern} />
        <div className="relative mx-auto w-full max-w-[88rem] px-5 py-6 sm:px-8 lg:px-10">
        <header className="border-b-2 border-[#1a5b4f] pb-6">
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/trips"
              className="inline-flex min-h-10 items-center justify-center border-2 border-[#183833] bg-[#fffdf7] px-4 py-2 text-sm font-black shadow-[3px_3px_0_#d8cbb6] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#d8cbb6]"
            >
              回旅程列表
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center border-2 border-[#183833] bg-[#fffdf7] px-4 py-2 text-sm font-black shadow-[3px_3px_0_#d8cbb6] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#d8cbb6]"
            >
              總覽
            </Link>
            <Link
              href={`/trips/${tripId}/today`}
              className={`inline-flex min-h-10 items-center justify-center border-2 border-[#183833] px-4 py-2 text-sm font-black shadow-[3px_3px_0_#d9b75f] transition hover:translate-x-0.5 hover:translate-y-0.5 ${
                todayDay
                  ? "bg-[#183833] text-white"
                  : "pointer-events-none bg-[#fffdf7] text-[#53635f]"
              }`}
            >
              {todayDay ? "今日模式" : "非今日行程"}
            </Link>
          </div>
          <p className="mt-8 text-sm font-black tracking-[0.24em] text-[#b43c2f]">
            {trip.destination} · {paceLabels[trip.pace]}
          </p>
          <h1 className="mt-2 text-4xl font-black leading-tight tracking-normal sm:text-6xl">{trip.title}</h1>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {trip.days.map((tripDay, index) => (
              <Link
                key={tripDay.id}
                href={`/trips/${trip.id}/day/${tripDay.id}`}
                className={`shrink-0 border-2 border-[#183833] px-4 py-2 text-sm font-black transition ${
                  tripDay.id === day.id
                    ? "bg-[#183833] text-white shadow-[3px_3px_0_#d9b75f]"
                    : "bg-[#fffdf7] shadow-[3px_3px_0_#d8cbb6] hover:bg-[#f1eadb]"
                }`}
              >
                {formatDayLabel(tripDay.date, index)}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setIsScheduleEditorOpen((isOpen) => !isOpen)}
              className="shrink-0 border-2 border-[#183833] bg-[#fffdf7] px-4 py-2 text-sm font-black shadow-[3px_3px_0_#d8cbb6] transition hover:bg-[#f1eadb]"
            >
              {isScheduleEditorOpen ? "收合日期設定" : "編輯出發日期"}
            </button>
          </div>

          {isScheduleEditorOpen ? (
            <form
              key={`${trip.id}-${trip.startDate}-${trip.days.length}`}
              onSubmit={updateSchedule}
              className="mt-5 grid gap-4 border-2 border-[#183833] bg-[#fffdf7] p-4 shadow-[5px_5px_0_#d8cbb6] lg:grid-cols-[1fr_120px_140px] lg:items-end"
            >
              <label className="grid gap-2">
                <span className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">出發日期</span>
                <input
                  name="startDate"
                  type="date"
                  defaultValue={trip.startDate}
                  className="min-h-11 border-2 border-[#d8cbb6] bg-white px-3 py-2 text-sm font-black text-[#183833] outline-none focus:border-[#1a5b4f]"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">天數</span>
                <input
                  name="dayCount"
                  type="number"
                  min={1}
                  max={14}
                  defaultValue={trip.days.length}
                  className="min-h-11 border-2 border-[#d8cbb6] bg-white px-3 py-2 text-sm font-black text-[#183833] outline-none focus:border-[#1a5b4f]"
                />
              </label>
              <button
                type="submit"
                className="min-h-11 border-2 border-[#183833] bg-[#d9b75f] px-4 py-2 text-sm font-black text-[#183833] shadow-[3px_3px_0_#183833] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#183833]"
              >
                更新日期
              </button>
              {scheduleMessage ? (
                <p className="text-sm font-black text-[#1a5b4f] lg:col-span-3">{scheduleMessage}</p>
              ) : null}
            </form>
          ) : scheduleMessage ? (
            <p className="mt-3 text-sm font-black text-[#1a5b4f]">{scheduleMessage}</p>
          ) : null}
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-black tracking-[0.2em] text-[#1a5b4f]">DAY PLAN</p>
                <h2 className="mt-1 text-3xl font-black">{day.date}</h2>
              </div>
              <div className="grid gap-2 sm:flex sm:items-center sm:justify-end">
                <p className="border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-sm font-black text-[#53635f]">
                  {items.length} 站 · {dayWarnings.length} 則提醒
                </p>
                <button
                  type="button"
                  onClick={startAddItem}
                  className="min-h-11 border-2 border-[#183833] bg-[#d9b75f] px-4 py-2 text-sm font-black text-[#183833] shadow-[3px_3px_0_#183833] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#183833]"
                >
                  + 新增一站
                </button>
              </div>
            </div>

            <div className="mt-5 border-2 border-[#183833] bg-[#fffdf7] p-5 shadow-[8px_8px_0_#1a5b4f] sm:p-7">
              <p className="text-sm font-black text-[#1a5b4f]">下一站</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-3xl font-black leading-tight">
                    {nextStopTitle}
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[#53635f]">
                    {nextStopMessage}
                  </p>
                </div>
                <span className="w-fit rotate-[-4deg] border-2 border-[#b43c2f] px-4 py-2 text-sm font-black text-[#b43c2f]">
                  {nextStopLabel}
                </span>
              </div>
            </div>

            {dayWarnings.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {dayWarnings.map((warning) => (
                  <details
                    key={warning.id}
                    className="group border-2 border-[#d9b75f] bg-[#fff7d8] text-[#6f4e00] shadow-[4px_4px_0_#d8cbb6]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-black marker:hidden">
                      <span>{warning.title}</span>
                      <span className="shrink-0 text-xs tracking-[0.16em] text-[#7c4b32] group-open:hidden">
                        展開
                      </span>
                      <span className="hidden shrink-0 text-xs tracking-[0.16em] text-[#7c4b32] group-open:inline">
                        收合
                      </span>
                    </summary>
                    <p className="border-t-2 border-[#d9b75f] px-4 py-3 text-sm leading-6">
                      {warning.message}
                    </p>
                  </details>
                ))}
              </div>
            ) : (
              <div className="mt-5 border-2 border-[#1a5b4f] bg-[#e9efe7] p-4 shadow-[4px_4px_0_#d8cbb6]">
                <p className="font-black text-[#1a5b4f]">這一天的安排看起來剛好</p>
                <p className="mt-1 text-sm leading-6 text-[#53635f]">
                  目前沒有過多站點、過長停留或太短移動間隔。
                </p>
              </div>
            )}

            <div className="mt-6 lg:hidden">
              <RoutePreview
                estimateMessage={visibleRouteEstimateMessage}
                estimates={visibleRouteEstimates}
                unavailableLegs={visibleUnavailableRouteLegs}
                isEstimating={isEstimatingRoute}
                items={items}
              />
            </div>

            {items.length === 0 ? (
              <div className="mt-5 border-2 border-dashed border-[#183833] bg-[#fffdf7] p-8 text-center">
                <h3 className="text-xl font-black">這一天還是空的</h3>
                <p className="mt-2 text-[#53635f]">
                  先新增第一個地點。EasyTrip 會用時間軸幫你看出今天會不會太趕。
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {items.map((item, index) => {
                  const isTight = tightGapItemIds.has(item.id);

                  return (
                    <article
                      key={item.id}
                      className="border-2 border-[#183833] bg-[#fbf8f0] p-5 shadow-[6px_6px_0_rgba(24,56,51,0.16)]"
                    >
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex flex-col items-center">
                          <span className="grid size-10 place-items-center border-2 border-[#183833] bg-[#b43c2f] text-sm font-black text-white shadow-[2px_2px_0_#183833]">
                            {index + 1}
                          </span>
                          {index < items.length - 1 ? (
                            <span className="mt-2 h-full min-h-10 w-1 bg-[#1a5b4f]" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-[#1a5b4f]">
                                {item.startTime} - {item.endTime} · {item.stayMinutes} 分鐘
                              </p>
                              <h3 className="mt-1 text-2xl font-black">{item.title}</h3>
                              <p className="mt-1 text-xs font-black tracking-[0.14em] text-[#7c4b32]">
                                {item.place?.address ??
                                  (item.place?.googleMapsUrl ? "已連結 Google Maps" : placeNotes[index] ?? "等待地點定位")}
                              </p>
                            </div>
                            <span className="border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-1 text-xs font-black">
                              {categoryLabels[item.type]}
                            </span>
                          </div>
                          {isTight ? (
                            <p className="mt-3 border-2 border-[#d9b75f] bg-[#fff7d8] px-3 py-2 text-sm font-black text-[#6f4e00]">
                              這站和上一站間隔太短，建議多留一點找路或排隊時間。
                            </p>
                          ) : null}
                          {item.note ? (
                            <p className="mt-3 text-sm leading-6 text-[#53635f]">
                              {item.note}
                            </p>
                          ) : null}
                          {item.place?.googleMapsUrl ? (
                            <a
                              href={item.place.googleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-sm font-black text-[#1a5b4f] transition hover:border-[#1a5b4f]"
                            >
                              開啟 Google Maps
                            </a>
                          ) : null}
                          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="min-h-10 border-2 border-[#183833] bg-[#183833] px-3 py-2 text-sm font-black text-white shadow-[3px_3px_0_#d9b75f] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#d9b75f]"
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItineraryItem(tripId, dayId, item.id)}
                              className="min-h-10 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-sm font-black transition hover:border-[#b43c2f] hover:text-[#b43c2f]"
                            >
                              刪除
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="grid gap-5 lg:sticky lg:top-6">
            <div className="hidden lg:block">
              <RoutePreview
                estimateMessage={visibleRouteEstimateMessage}
                estimates={visibleRouteEstimates}
                unavailableLegs={visibleUnavailableRouteLegs}
                isEstimating={isEstimatingRoute}
                items={items}
              />
            </div>

            <section className="hidden border-2 border-[#183833] bg-[#0c4160] p-5 text-white shadow-[8px_8px_0_#b43c2f] sm:p-6 lg:block">
              <p className="text-sm font-black tracking-[0.18em] text-[#f2d179]">
                {editingItem ? "編輯行程點" : "新增行程點"}
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {editingItem ? editingItem.title : "加入下一個地點"}
              </h2>
              {renderItineraryForm()}
            </section>
          </aside>
        </div>
        </div>
      </section>
      {isMobileEditorOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" data-testid="mobile-editor-sheet">
          <button
            type="button"
            aria-label="收合背景遮罩"
            className="absolute inset-0 bg-[#183833]/55"
            onClick={cancelEdit}
          />
          <section className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto border-t-2 border-[#183833] bg-[#0c4160] p-5 text-white shadow-[0_-12px_30px_rgba(24,56,51,0.35)]">
            <div className="mx-auto max-w-xl">
              <div className="mx-auto mb-4 h-1.5 w-12 bg-[#f2d179]" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black tracking-[0.18em] text-[#f2d179]">
                    {editingItem ? "編輯行程點" : "新增行程點"}
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {editingItem ? editingItem.title : "加入下一個地點"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="border-2 border-white/25 px-3 py-1 text-xs font-black text-white"
                >
                  關閉
                </button>
              </div>
              {renderItineraryForm()}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
