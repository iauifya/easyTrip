"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  createAiItineraryPrompt,
  getAiItineraryImportDayAssignments,
  parseAiItineraryImport,
} from "@/lib/itinerary/ai-import";
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
  createGoogleMapsPlaceUrl,
  getGoogleMapsPlaceName,
  type GoogleMapsPreview,
} from "@/lib/places/google-maps";
import { categoryLabels, paceLabels } from "@/lib/trips/labels";
import { adjustTripSchedule } from "@/lib/trips/schedule";
import { getSortedItems, getTightGapItemIds, minutesToTime, timeToMinutes } from "@/lib/time/itinerary";
import { getTodayTripDay, getTripDayStatus } from "@/lib/trips/today";
import {
  getRouteEstimateStops,
  type RouteEstimatesResponse,
  type RouteTravelEstimate,
  type UnavailableRouteLeg,
} from "@/lib/routes/travel-estimates";
import { taiwanWindowPattern } from "@/lib/ui/taiwan-style";
import { RoutePreview } from "@/components/route-preview";
import { useTripStore } from "@/store/trip-store";
import type { ItineraryItem, ItineraryItemType, TripPace } from "@/types/trip";

const lateNightBoundaryMinutes = 20 * 60;
const earlyMorningBoundaryMinutes = 6 * 60;

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

const paceOptions: Array<{
  value: TripPace;
  label: string;
  helper: string;
}> = [
  { value: "relaxed", label: paceLabels.relaxed, helper: "最多 4 站，停留總長約 6 小時內" },
  { value: "normal", label: paceLabels.normal, helper: "最多 5 站，停留總長約 8 小時內" },
  { value: "packed", label: paceLabels.packed, helper: "最多 7 站，停留總長約 10 小時內" },
  { value: "unlimited", label: paceLabels.unlimited, helper: "不限制站數與停留總長" },
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

function getOpenGapRecommendation(
  items: ItineraryItem[],
  type: ItineraryItemType,
  editingItemId?: string | null,
) {
  const sortedItems = getSortedItems(items).filter((item) => item.id !== editingItemId);
  const stayMinutes = getDefaultStayMinutes(type);

  for (let index = 0; index < sortedItems.length - 1; index += 1) {
    const previous = sortedItems[index];
    const next = sortedItems[index + 1];
    const previousEnd = timeToMinutes(previous.endTime);
    const nextStart = timeToMinutes(next.startTime);
    const gapMinutes = nextStart - previousEnd;

    if (gapMinutes > 90) {
      const startMinutes = previousEnd + 30;
      const latestEndMinutes = nextStart - 30;
      const endMinutes = Math.min(startMinutes + stayMinutes, latestEndMinutes);

      if (startMinutes < endMinutes) {
        return {
          startTime: minutesToTime(startMinutes),
          endTime: minutesToTime(endMinutes),
          previousTitle: previous.title,
          nextTitle: next.title,
        };
      }
    }
  }

  return undefined;
}

function getNextScheduleConflict(
  items: ItineraryItem[],
  startTime: string | undefined,
  endTime: string | undefined,
  editingItemId?: string | null,
) {
  if (!startTime || !endTime) {
    return undefined;
  }

  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
    return undefined;
  }

  const nextItem = getSortedItems(items)
    .filter((item) => item.id !== editingItemId)
    .find((item) => timeToMinutes(item.startTime) > startMinutes);

  if (!nextItem) {
    return undefined;
  }

  const minutesBeforeNext = timeToMinutes(nextItem.startTime) - endMinutes;

  if (minutesBeforeNext < 30) {
    return {
      nextTitle: nextItem.title,
      nextStartTime: nextItem.startTime,
    };
  }

  return undefined;
}

function getCrossDayOffsetForNewItem(
  values: ItineraryItemInput,
  items: ItineraryItem[],
) {
  const startMinutes = timeToMinutes(values.startTime);
  const endMinutes = timeToMinutes(values.endTime);
  const lastEndMinutes = items.length > 0 ? timeToMinutes(items.at(-1)?.endTime ?? "00:00") : 0;
  const itemCrossesMidnight = endMinutes <= startMinutes;
  const followsLateNightItem =
    items.length > 0 &&
    lastEndMinutes >= lateNightBoundaryMinutes &&
    startMinutes < earlyMorningBoundaryMinutes;

  return itemCrossesMidnight || followsLateNightItem ? 1 : 0;
}

function getWarningDetail(warningId: string, pace: TripPace) {
  const paceLabel = paceLabels[pace];
  const matchedPace = paceOptions.find((option) => option.value === pace);

  if (warningId === "too-many-stops") {
    return `目前使用「${paceLabel}」判斷，${matchedPace?.helper ?? "會依節奏限制站點數"}。如果你本來就想走緊湊路線，可以調成更充實的節奏。`;
  }

  if (warningId === "too-long") {
    return `這個提醒看的是當天所有停留時間加總，不含移動時間。目前「${paceLabel}」的基準是 ${matchedPace?.helper ?? "依節奏判斷停留總長"}。`;
  }

  if (warningId === "tight-gaps") {
    return "這個提醒會檢查相鄰行程之間是否少於 20 分鐘，避免沒有足夠時間找路、排隊或移動。";
  }

  return undefined;
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

type AiImportMode = "replace" | "append";

function createAiImportBatchId() {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getLatestAiImportBatchId(trip?: { days: Array<{ items: ItineraryItem[] }> }) {
  const batchIds = new Set(trip?.days
    .flatMap((tripDay) => tripDay.items)
    .filter((item) => item.source === "ai_import" && item.importBatchId)
    .map((item) => item.importBatchId as string) ?? []);

  return Array.from(batchIds).sort().at(-1);
}

function isAiImportBatchItem(item: ItineraryItem, batchId?: string) {
  return item.source === "ai_import" && Boolean(batchId) && item.importBatchId === batchId;
}

export function ItineraryDayPlanner({ tripId, dayId }: { tripId: string; dayId: string }) {
  const router = useRouter();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => getCurrentTimeString());
  const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
  const [pendingCrossDayItem, setPendingCrossDayItem] = useState<ItineraryItem | null>(null);
  const [crossDayDaysToAdd, setCrossDayDaysToAdd] = useState(1);
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [googleMapsLookupMessage, setGoogleMapsLookupMessage] = useState("");
  const [routeEstimates, setRouteEstimates] = useState<RouteTravelEstimate[]>([]);
  const [unavailableRouteLegs, setUnavailableRouteLegs] = useState<UnavailableRouteLeg[]>([]);
  const [routeEstimateMessage, setRouteEstimateMessage] = useState("");
  const [isEstimatingRoute, setIsEstimatingRoute] = useState(false);
  const [aiImportText, setAiImportText] = useState("");
  const [aiImportMessage, setAiImportMessage] = useState("");
  const [aiPromptMessage, setAiPromptMessage] = useState("");
  const [aiImportMode, setAiImportMode] = useState<AiImportMode>("replace");
  const [selectedAiImportItemIds, setSelectedAiImportItemIds] = useState<Set<string>>(new Set());
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
    getValues,
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
  const selectedStartTime = useWatch({
    control,
    name: "startTime",
  });
  const selectedEndTime = useWatch({
    control,
    name: "endTime",
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
  const dayIndex = trip?.days.findIndex((item) => item.id === dayId) ?? -1;
  const items = getSortedItems(day?.items ?? []);
  const routeEstimateStopsJson = JSON.stringify(getRouteEstimateStops(items, day?.date));
  const visibleRouteEstimates = items.length >= 2 ? routeEstimates : [];
  const visibleUnavailableRouteLegs = items.length >= 2 ? unavailableRouteLegs : [];
  const visibleRouteEstimateMessage = items.length >= 2 ? routeEstimateMessage : "";
  const tightGapItemIds = getTightGapItemIds(items);
  const dayWarnings = trip ? getDayWarnings(items, trip.pace) : [];
  const dayStatus = day ? getTripDayStatus(day.date) : "today";
  const nextStop = getNextStopInsight(items, currentTime);
  const editingItem = items.find((item) => item.id === editingItemId);
  const todayDay = getTodayTripDay(trip);
  const aiItineraryPrompt = trip && day ? createAiItineraryPrompt(trip, day) : "";
  const aiImportPreview = useMemo(() => parseAiItineraryImport(aiImportText), [aiImportText]);
  const latestAiImportBatchId = getLatestAiImportBatchId(trip);
  const latestAiImportItemCount =
    trip?.days.reduce(
      (count, tripDay) =>
        count + tripDay.items.filter((item) => isAiImportBatchItem(item, latestAiImportBatchId)).length,
      0,
    ) ?? 0;
  const baseItemsForAiImport =
    aiImportMode === "replace"
      ? items.filter((item) => !isAiImportBatchItem(item, latestAiImportBatchId))
      : items;
  const aiImportAssignments = getAiItineraryImportDayAssignments(
    aiImportPreview.items,
    baseItemsForAiImport,
  );
  const selectedAiImportAssignments = aiImportAssignments.filter(({ item }) =>
    selectedAiImportItemIds.has(item.id),
  );
  const lastItemEndTime = items.at(-1)?.endTime ?? "08:00";
  const nextDefaultStartTime = items.length > 0 ? minutesToTime(timeToMinutes(lastItemEndTime) + 30) : "08:00";
  const openGapRecommendation = getOpenGapRecommendation(items, selectedType, editingItemId);
  const scheduleConflict = getNextScheduleConflict(
    items,
    selectedStartTime,
    selectedEndTime,
    editingItemId,
  );
  const dayIdForDefaults = day?.id;
  const placeSearchPreview = createGoogleMapsPreview({
    title: title ?? "",
    address: address ?? "",
    googlePlaceId: googlePlaceId ?? "",
    googleMapsUrl: isMobileEditorOpen ? "" : googleMapsUrl ?? "",
    lat,
    lng,
  });
  const suggestedGooglePlaceName = !isMobileEditorOpen && googleMapsUrl ? getGoogleMapsPlaceName(googleMapsUrl) : undefined;
  const visibleGoogleMapsLookupMessage = !isMobileEditorOpen && googleMapsUrl?.trim() ? googleMapsLookupMessage : "";

  useEffect(() => {
    setSelectedAiImportItemIds(new Set(aiImportPreview.items.map((item) => item.id)));
  }, [aiImportPreview.items]);

  function getDefaultTimesFromLastItem(type: ItineraryItemType = "attraction") {
    return {
      startTime: nextDefaultStartTime,
      endTime: minutesToTime(timeToMinutes(nextDefaultStartTime) + getDefaultStayMinutes(type)),
    };
  }

  function clearPlaceSearch() {
    setValue("title", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("googleMapsUrl", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("address", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("googlePlaceId", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("lat", undefined, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("lng", undefined, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setGoogleMapsLookupMessage("");
  }

  function applyOpenGapRecommendation() {
    if (!openGapRecommendation) {
      return;
    }

    setValue("startTime", openGapRecommendation.startTime, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("endTime", openGapRecommendation.endTime, {
      shouldDirty: true,
      shouldValidate: true,
    });
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
    if (suggestedGooglePlaceName && getValues("title") !== suggestedGooglePlaceName) {
      setValue("title", suggestedGooglePlaceName, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [getValues, setValue, suggestedGooglePlaceName]);

  useEffect(() => {
    const trimmedUrl = googleMapsUrl?.trim();

    if (isMobileEditorOpen || !trimmedUrl) {
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

        if (place.displayName && getValues("title") !== place.displayName) {
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
  }, [getValues, googleMapsUrl, isMobileEditorOpen, setValue]);

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
    const pace = String(formData.get("pace") ?? trip.pace) as TripPace;

    try {
      updateTrip({
        ...adjustTripSchedule(trip, startDate, dayCount),
        pace,
      });
      setScheduleMessage("行程日期與節奏已更新");
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : "行程日期更新失敗");
    }
  }

  function addItemToDay(item: ItineraryItem, targetDayIndex: number, daysToAdd = 0) {
    if (!trip) {
      return false;
    }

    try {
      const nextDayCount = Math.max(trip.days.length, trip.days.length + daysToAdd, targetDayIndex + 1);
      const scheduledTrip =
        nextDayCount > trip.days.length
          ? adjustTripSchedule(trip, trip.startDate, nextDayCount)
          : trip;
      const targetDay = scheduledTrip.days[targetDayIndex];

      if (!targetDay) {
        return false;
      }

      updateTrip({
        ...scheduledTrip,
        days: scheduledTrip.days.map((tripDay) =>
          tripDay.id === targetDay.id
            ? { ...tripDay, items: [...tripDay.items, item] }
            : tripDay,
        ),
      });
      setSelectedDayId(targetDay.id);
      router.push(`/trips/${tripId}/day/${targetDay.id}`);
      return true;
    } catch (error) {
      setScheduleMessage(error instanceof Error ? error.message : "新增隔天行程失敗，請再試一次。");
      return false;
    }
  }

  function confirmCrossDayAdd() {
    if (!pendingCrossDayItem || dayIndex < 0) {
      return;
    }

    const targetDayIndex = dayIndex + 1;
    const daysToAdd = Math.max(1, Math.min(13, crossDayDaysToAdd));

    if (addItemToDay(pendingCrossDayItem, targetDayIndex, daysToAdd)) {
      setPendingCrossDayItem(null);
      setCrossDayDaysToAdd(1);
      cancelEdit();
    }
  }

  async function copyAiItineraryPrompt() {
    if (!aiItineraryPrompt) {
      return;
    }

    try {
      await navigator.clipboard.writeText(aiItineraryPrompt);
      setAiPromptMessage("已複製規劃提示。");
    } catch {
      setAiPromptMessage("複製失敗，請手動選取規劃提示。");
    }
  }

  function confirmAiItineraryImport() {
    if (!trip || dayIndex < 0) {
      return;
    }

    if (aiImportAssignments.length === 0) {
      setAiImportMessage(aiImportPreview.error ?? "沒有可匯入的有效行程。");
      return;
    }

    if (selectedAiImportAssignments.length === 0) {
      setAiImportMessage("請至少勾選一個要匯入的行程點。");
      return;
    }

    const maxDayOffset = Math.max(...selectedAiImportAssignments.map((assignment) => assignment.dayOffset));
    const nextDayCount = Math.max(trip.days.length, dayIndex + maxDayOffset + 1);

    if (nextDayCount > 14) {
      setAiImportMessage("這次匯入需要超過 14 天，請縮短 AI 結果後再試一次。");
      return;
    }

    try {
      const scheduledTrip =
        nextDayCount > trip.days.length
          ? adjustTripSchedule(trip, trip.startDate, nextDayCount)
          : trip;
      const itemsByDayId = new Map<string, ItineraryItem[]>();
      const importBatchId = createAiImportBatchId();

      for (const assignment of selectedAiImportAssignments) {
        const targetDay = scheduledTrip.days[dayIndex + assignment.dayOffset];

        if (!targetDay) {
          continue;
        }

        itemsByDayId.set(targetDay.id, [
          ...(itemsByDayId.get(targetDay.id) ?? []),
          {
            ...assignment.item,
            source: "ai_import",
            importBatchId,
          },
        ]);
      }

      const removedItemCount = aiImportMode === "replace" ? latestAiImportItemCount : 0;

      updateTrip({
        ...scheduledTrip,
        days: scheduledTrip.days.map((tripDay) => {
          const importedItems = itemsByDayId.get(tripDay.id);
          const retainedItems =
            aiImportMode === "replace"
              ? tripDay.items.filter((item) => !isAiImportBatchItem(item, latestAiImportBatchId))
              : tripDay.items;

          return importedItems || retainedItems.length !== tripDay.items.length
            ? { ...tripDay, items: [...retainedItems, ...(importedItems ?? [])] }
            : tripDay;
        }),
      });

      const affectedDayCount = itemsByDayId.size;

      setAiImportMessage(
        aiImportMode === "replace"
          ? `已移除上次 AI 匯入 ${removedItemCount} 筆，匯入這次勾選的 ${selectedAiImportAssignments.length} 筆，分布於 ${affectedDayCount} 天。`
          : `已追加 ${selectedAiImportAssignments.length} 個行程點，分布於 ${affectedDayCount} 天。`,
      );
      setAiImportText("");
      setSelectedAiImportItemIds(new Set());
    } catch (error) {
      setAiImportMessage(error instanceof Error ? error.message : "匯入失敗，請再試一次。");
    }
  }

  function onSubmit(values: ItineraryItemInput) {
    const isMobileSubmission = shouldUseMobileEditor();
    const normalizedValues = isMobileSubmission
      ? {
          ...values,
          googleMapsUrl: "",
          googlePlaceId: "",
          lat: undefined,
          lng: undefined,
        }
      : values;

    if (isMobileSubmission && !normalizedValues.address?.trim()) {
      setError("address", {
        type: "manual",
        message: "手機版請填寫完整地址",
      });
      return;
    }

    const result = itineraryItemSchema.safeParse(normalizedValues);

    if (!result.success) {
      applySchemaErrors(result.error);
      return;
    }

    const itineraryItem = createItineraryItemFromInput(result.data, editingItem);

    if (editingItem) {
      updateItineraryItem(tripId, dayId, itineraryItem);
    } else {
      const crossDayOffset = getCrossDayOffsetForNewItem(result.data, items);

      if (trip && dayIndex >= 0 && crossDayOffset > 0) {
        const targetDayIndex = dayIndex + crossDayOffset;
        const missingDayCount = Math.max(0, targetDayIndex + 1 - trip.days.length);

        if (trip.days.length === 1 && missingDayCount > 0) {
          setPendingCrossDayItem(itineraryItem);
          setCrossDayDaysToAdd(missingDayCount);
          setIsMobileEditorOpen(false);
          return;
        }

        if (addItemToDay(itineraryItem, targetDayIndex, missingDayCount)) {
          cancelEdit();
        }
        return;
      }

      addItineraryItem(tripId, dayId, itineraryItem);
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

      <PlaceSearchPreview preview={placeSearchPreview} />
      {title?.trim() || googleMapsUrl?.trim() || address?.trim() || googlePlaceId || lat || lng ? (
        <button
          type="button"
          onClick={clearPlaceSearch}
          className="w-fit border border-white/25 px-2 py-1 text-[11px] font-black text-white/85 transition hover:bg-white/10 hover:text-white"
        >
          重新搜尋地點
        </button>
      ) : null}

      <label className="grid gap-2">
        <span className="text-sm font-black">完整地址</span>
        <input
          {...register("address")}
          placeholder="例如：台北市萬華區廣州街211號"
          className="border-2 border-white/20 bg-white px-3 py-3 text-[#183833] outline-none transition focus:border-[#f2d179]"
        />
        {errors.address ? (
          <span className="text-sm font-black text-[#f2d179]">
            {getFieldError(errors.address)}
          </span>
        ) : null}
        <span className="text-xs font-bold text-white/65 lg:hidden">
          手機版請填寫完整地址，不使用 Google Maps 短連結。
        </span>
        <span className="hidden text-xs font-bold text-white/65 lg:block">
          可填完整地址，或改貼下方 Google Maps 連結，兩者擇一即可。
        </span>
      </label>

      <label className="hidden gap-2 lg:grid">
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
        {errors.type ? (
          <span className="text-sm font-black text-[#f2d179]">
            {getFieldError(errors.type)}
          </span>
        ) : null}
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
          {errors.startTime ? (
            <span className="text-sm font-black text-[#f2d179]">
              {getFieldError(errors.startTime)}
            </span>
          ) : null}
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-black">結束</span>
          <input
            type="time"
            {...register("endTime")}
            className="border-2 border-white/20 bg-white px-3 py-3 text-[#183833] outline-none transition focus:border-[#f2d179]"
          />
          {errors.endTime ? (
            <span className="text-sm font-black text-[#f2d179]">
              {getFieldError(errors.endTime)}
            </span>
          ) : null}
        </label>
      </div>
      {!editingItemId && openGapRecommendation ? (
        <div className="border-2 border-[#f2d179] bg-[#f2d179]/10 p-3 text-xs font-bold leading-5 text-white">
          <p className="font-black text-[#f2d179]">推薦時間</p>
          <p className="mt-1">
            {openGapRecommendation.previousTitle} 和 {openGapRecommendation.nextTitle} 之間有空檔，建議安排{" "}
            {openGapRecommendation.startTime} - {openGapRecommendation.endTime}。
          </p>
          <button
            type="button"
            onClick={applyOpenGapRecommendation}
            className="mt-2 border border-[#f2d179] px-2 py-1 text-[11px] font-black text-[#f2d179] transition hover:bg-[#f2d179] hover:text-[#183833]"
          >
            套用推薦時間
          </button>
        </div>
      ) : null}
      {scheduleConflict ? (
        <p className="border-2 border-[#f2d179] bg-[#f2d179]/10 px-3 py-2 text-xs font-black leading-5 text-[#f2d179]">
          結束時間距離「{scheduleConflict.nextTitle}」開始時間 {scheduleConflict.nextStartTime} 不到 30 分鐘，建議調整時間。
        </p>
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
    <main className="min-h-screen overflow-x-hidden bg-[#f6f3ea] text-[#183833]">
      <section className="relative overflow-hidden border-b border-[#d8cbb6] bg-[#fbf8f0]">
        <div className="absolute inset-0 opacity-80" style={taiwanWindowPattern} />
        <div className="relative mx-auto w-full max-w-[88rem] px-3 py-6 sm:px-8 lg:px-10">
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
              className="mt-5 grid gap-4 border-2 border-[#183833] bg-[#fffdf7] p-4 shadow-[5px_5px_0_#d8cbb6] lg:grid-cols-[1fr_120px_180px_140px] lg:items-end"
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
              <label className="grid gap-2">
                <span className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">旅遊節奏</span>
                <select
                  name="pace"
                  defaultValue={trip.pace}
                  className="min-h-11 border-2 border-[#d8cbb6] bg-white px-3 py-2 text-sm font-black text-[#183833] outline-none focus:border-[#1a5b4f]"
                >
                  {paceOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="min-h-11 border-2 border-[#183833] bg-[#d9b75f] px-4 py-2 text-sm font-black text-[#183833] shadow-[3px_3px_0_#183833] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#183833]"
              >
                更新日期
              </button>
              {scheduleMessage ? (
                <p className="text-sm font-black text-[#1a5b4f] lg:col-span-4">{scheduleMessage}</p>
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

            <section className="mt-5 max-w-full overflow-hidden border-2 border-[#183833] bg-[#fffdf7] p-5 shadow-[8px_8px_0_#d9b75f] sm:p-6">
              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="min-w-0">
                  <p className="text-sm font-black tracking-[0.18em] text-[#b43c2f]">
                    行程匯入
                  </p>
                  <h3 className="mt-2 text-2xl font-black">跟機器人一起規劃!</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyAiItineraryPrompt}
                      className="min-h-10 border-2 border-[#183833] bg-[#d9b75f] px-3 py-2 text-sm font-black text-[#183833] shadow-[3px_3px_0_#183833] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#183833]"
                    >
                      複製規劃提示
                    </button>
                    <a
                      href="https://chatgpt.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center border-2 border-[#d8cbb6] bg-white px-3 py-2 text-sm font-black text-[#183833] transition hover:border-[#183833]"
                    >
                      ChatGPT
                    </a>
                    <a
                      href="https://claude.ai/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center border-2 border-[#d8cbb6] bg-white px-3 py-2 text-sm font-black text-[#183833] transition hover:border-[#183833]"
                    >
                      Claude
                    </a>
                    <a
                      href="https://gemini.google.com/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center border-2 border-[#d8cbb6] bg-white px-3 py-2 text-sm font-black text-[#183833] transition hover:border-[#183833]"
                    >
                      Gemini
                    </a>
                  </div>
                  {aiPromptMessage ? (
                    <p className="mt-2 text-sm font-black text-[#1a5b4f]">{aiPromptMessage}</p>
                  ) : null}
                  <details className="mt-4 border-2 border-[#d8cbb6] bg-[#fbf8f0]">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-black text-[#7c4b32]">
                      規劃提示預覽
                    </summary>
                    <textarea
                      readOnly
                      value={aiItineraryPrompt}
                      rows={10}
                      className="block w-full resize-none border-t-2 border-[#d8cbb6] bg-white px-3 py-3 font-mono text-xs leading-5 text-[#183833] outline-none"
                    />
                  </details>
                </div>

                <div className="grid min-w-0 gap-3">
                  <label className="grid min-w-0 gap-2">
                    <span className="text-sm font-black text-[#1a5b4f]">貼上 AI JSON 結果</span>
                    <textarea
                      value={aiImportText}
                      onChange={(event) => {
                        setAiImportText(event.target.value);
                        setAiImportMessage("");
                      }}
                      rows={10}
                      placeholder='{"version":1,"items":[{"title":"Taipei 101","address":"Taipei 101","startTime":"10:00","endTime":"11:30","type":"attraction","note":"Book tickets ahead."}]}'
                      className="max-w-full resize-none overflow-x-hidden whitespace-normal break-all border-2 border-[#d8cbb6] bg-white px-3 py-3 font-mono text-xs leading-5 text-[#183833] outline-none transition [line-break:anywhere] [overflow-wrap:anywhere] [word-break:break-all] focus:border-[#1a5b4f]"
                    />
                  </label>

                  {aiImportText.trim() && aiImportPreview.error ? (
                    <p className="border-2 border-[#b43c2f] bg-[#fff4ef] px-3 py-2 text-sm font-black text-[#b43c2f]">
                      {aiImportPreview.error}
                    </p>
                  ) : null}

                  {aiImportAssignments.length > 0 ? (
                    <div className="min-w-0 overflow-hidden border-2 border-[#1a5b4f] bg-[#e9efe7] p-3">
                      <div className="grid min-w-0 gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-[#1a5b4f]">
                            可匯入：{selectedAiImportAssignments.length}/{aiImportAssignments.length} 筆
                          </p>
                          <p className="mt-1 text-xs font-bold leading-5 text-[#53635f]">
                            {aiImportMode === "replace"
                              ? latestAiImportItemCount > 0
                                ? `會先移除上次 AI 匯入的 ${latestAiImportItemCount} 筆，再加入這次勾選項目。`
                                : "目前沒有可覆蓋的 AI 匯入批次，會直接加入這次勾選項目。"
                              : "會保留現有行程，將這次勾選項目追加到後面。"}
                          </p>
                        </div>
                        <div className="grid min-w-0 grid-cols-2 border-2 border-[#183833] bg-[#fffdf7] text-center text-xs font-black">
                          <button
                            type="button"
                            onClick={() => setAiImportMode("replace")}
                            className={`border-r-2 border-[#183833] px-3 py-2 ${
                              aiImportMode === "replace"
                                ? "bg-[#183833] text-white"
                                : "text-[#183833] hover:bg-[#f1eadb]"
                            }`}
                          >
                            更新上次匯入
                          </button>
                          <button
                            type="button"
                            onClick={() => setAiImportMode("append")}
                            className={`px-3 py-2 ${
                              aiImportMode === "append"
                                ? "bg-[#183833] text-white"
                                : "text-[#183833] hover:bg-[#f1eadb]"
                            }`}
                          >
                            追加到現有行程
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAiImportItemIds(new Set(aiImportAssignments.map(({ item }) => item.id)))
                            }
                            className="border-2 border-[#d8cbb6] bg-white px-3 py-1.5 text-xs font-black text-[#183833] transition hover:border-[#183833]"
                          >
                            全選
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedAiImportItemIds(new Set())}
                            className="border-2 border-[#d8cbb6] bg-white px-3 py-1.5 text-xs font-black text-[#183833] transition hover:border-[#b43c2f] hover:text-[#b43c2f]"
                          >
                            全部取消
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid gap-2">
                        {aiImportAssignments.map(({ item, dayOffset }) => (
                          <label
                            key={item.id}
                            className={`grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 border bg-white px-3 py-2 text-sm transition ${
                              selectedAiImportItemIds.has(item.id)
                                ? "border-[#1a5b4f] shadow-[2px_2px_0_#b8c8c0]"
                                : "border-[#b8c8c0] opacity-70"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedAiImportItemIds.has(item.id)}
                              onChange={(event) => {
                                setSelectedAiImportItemIds((current) => {
                                  const next = new Set(current);

                                  if (event.target.checked) {
                                    next.add(item.id);
                                  } else {
                                    next.delete(item.id);
                                  }

                                  return next;
                                });
                                setAiImportMessage("");
                              }}
                              className="mt-1 size-4 accent-[#1a5b4f]"
                            />
                            <span className="min-w-0">
                              <span className="block max-w-full whitespace-normal break-all font-black [line-break:anywhere] [overflow-wrap:anywhere] [word-break:break-all]">
                                {item.startTime} - {item.endTime} · {item.title}
                              </span>
                              <span className="mt-1 block max-w-full whitespace-normal break-all text-xs font-bold text-[#53635f] [line-break:anywhere] [overflow-wrap:anywhere] [word-break:break-all]">
                                {dayOffset === 0 ? "目前日期" : `後續第 ${dayOffset} 天`} ·{" "}
                                {categoryLabels[item.type]} · {item.place?.address}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {aiImportPreview.invalidRows.length > 0 ? (
                    <div className="border-2 border-[#d9b75f] bg-[#fff7d8] p-3 text-sm text-[#6f4e00]">
                      <p className="font-black">已略過：{aiImportPreview.invalidRows.length} 筆</p>
                      <div className="mt-2 grid gap-1">
                        {aiImportPreview.invalidRows.map((row) => (
                          <p key={row.index} className="text-xs font-bold leading-5">
                            第 {row.index + 1} 筆：{row.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={confirmAiItineraryImport}
                      disabled={selectedAiImportAssignments.length === 0}
                      className="min-h-10 border-2 border-[#183833] bg-[#183833] px-4 py-2 text-sm font-black text-white shadow-[3px_3px_0_#d9b75f] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#d9b75f] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {aiImportMode === "replace" ? "套用更新匯入" : "追加勾選行程"}
                    </button>
                    {aiImportText ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAiImportText("");
                          setAiImportMessage("");
                        }}
                        className="min-h-10 border-2 border-[#d8cbb6] bg-white px-4 py-2 text-sm font-black text-[#183833] transition hover:border-[#b43c2f] hover:text-[#b43c2f]"
                      >
                        清除
                      </button>
                    ) : null}
                  </div>
                  {aiImportMessage ? (
                    <p className="text-sm font-black text-[#1a5b4f]">{aiImportMessage}</p>
                  ) : null}
                </div>
              </div>
            </section>

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
                    <div className="border-t-2 border-[#d9b75f] px-4 py-3 text-sm leading-6">
                      <p>{warning.message}</p>
                      {getWarningDetail(warning.id, trip.pace) ? (
                        <details className="group/tip mt-3 w-fit">
                          <summary className="inline-flex cursor-pointer list-none border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-xs font-black text-[#7c4b32] shadow-[2px_2px_0_#d8cbb6] marker:hidden [&::-webkit-details-marker]:hidden">
                            <span className="group-open/tip:hidden">查看判斷方式</span>
                            <span className="hidden group-open/tip:inline">收合判斷方式</span>
                          </summary>
                          <p className="mt-2 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-xs font-bold leading-5 text-[#7c4b32] shadow-[2px_2px_0_#d8cbb6]">
                            {getWarningDetail(warning.id, trip.pace)}
                          </p>
                        </details>
                      ) : null}
                      {warning.id === "too-many-stops" || warning.id === "too-long" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsScheduleEditorOpen(true);
                            setScheduleMessage("可在上方調整旅遊節奏，提醒門檻會跟著更新。");
                          }}
                          className="mt-3 border-2 border-[#183833] bg-[#d9b75f] px-3 py-2 text-xs font-black text-[#183833] shadow-[2px_2px_0_#183833] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#183833]"
                        >
                          調整旅遊節奏
                        </button>
                      ) : null}
                    </div>
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
                  const itemGoogleMapsUrl = getItemGoogleMapsUrl(item);

                  return (
                    <article
                      key={item.id}
                      className="relative overflow-hidden border-2 border-[#183833] bg-[#fbf8f0] p-3 shadow-[3px_3px_0_rgba(24,56,51,0.16)] sm:p-5 sm:shadow-[6px_6px_0_rgba(24,56,51,0.16)]"
                    >
                      <span className="absolute right-3 top-3 grid size-7 place-items-center border-2 border-[#183833] bg-[#b43c2f] text-xs font-black text-white shadow-[1px_1px_0_#183833] sm:hidden">
                        {index + 1}
                      </span>
                      <div className="flex min-w-0 gap-2 sm:gap-4">
                        <div className="hidden shrink-0 flex-col items-center sm:flex">
                          <span className="grid size-10 place-items-center border-2 border-[#183833] bg-[#b43c2f] text-sm font-black text-white shadow-[2px_2px_0_#183833]">
                            {index + 1}
                          </span>
                          {index < items.length - 1 ? (
                            <span className="mt-2 h-full min-h-10 w-1 bg-[#1a5b4f]" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1 overflow-hidden pr-9 sm:pr-0">
                              <p className="max-w-full whitespace-normal break-all text-sm font-black text-[#1a5b4f] [line-break:anywhere] [overflow-wrap:anywhere] [word-break:break-all]">
                                {item.startTime} - {item.endTime} · {item.stayMinutes} 分鐘
                              </p>
                              <h3 className="mt-1 max-w-full whitespace-normal break-all text-2xl font-black leading-tight [hyphens:auto] [line-break:anywhere] [overflow-wrap:anywhere] [word-break:break-all]">
                                {item.title}
                              </h3>
                              <p className="mt-1 max-w-full whitespace-normal break-all text-xs font-black leading-5 tracking-normal text-[#7c4b32] [hyphens:auto] [line-break:anywhere] [overflow-wrap:anywhere] [word-break:break-all] sm:tracking-[0.14em]">
                                {item.place?.address ??
                                  (item.place?.googleMapsUrl ? "已連結 Google Maps" : placeNotes[index] ?? "等待地點定位")}
                              </p>
                            </div>
                            <span className="w-fit shrink-0 border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-1 text-xs font-black">
                              {categoryLabels[item.type]}
                            </span>
                          </div>
                          {isTight ? (
                            <p className="mt-3 max-w-full whitespace-normal break-all border-2 border-[#d9b75f] bg-[#fff7d8] px-3 py-2 text-sm font-black text-[#6f4e00] [line-break:anywhere] [overflow-wrap:anywhere] [word-break:break-all]">
                              這站和上一站間隔太短，建議多留一點找路或排隊時間。
                            </p>
                          ) : null}
                          {item.note ? (
                            <p className="mt-3 max-w-full whitespace-normal break-all text-sm leading-6 text-[#53635f] [line-break:anywhere] [overflow-wrap:anywhere] [word-break:break-all]">
                              {item.note}
                            </p>
                          ) : null}
                          {itemGoogleMapsUrl ? (
                            <a
                              href={itemGoogleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex max-w-full items-center justify-center whitespace-normal break-all border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-sm font-black text-[#1a5b4f] transition [line-break:anywhere] [overflow-wrap:anywhere] [word-break:break-all] hover:border-[#1a5b4f]"
                            >
                              開啟 Google Maps
                            </a>
                          ) : null}
                          <div className="mt-4 grid w-full max-w-full gap-2 sm:flex sm:flex-wrap">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="min-h-10 min-w-0 max-w-full border-2 border-[#183833] bg-[#183833] px-3 py-2 text-sm font-black text-white shadow-[2px_2px_0_#d9b75f] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#d9b75f] sm:shadow-[3px_3px_0_#d9b75f]"
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItineraryItem(tripId, dayId, item.id)}
                              className="min-h-10 min-w-0 max-w-full border-2 border-[#d8cbb6] bg-[#fffdf7] px-3 py-2 text-sm font-black transition hover:border-[#b43c2f] hover:text-[#b43c2f]"
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
              {!editingItem ? (
                <p className="mt-2 text-xs font-bold leading-5 text-white/70">
                  可在名稱內搜尋想去的地方，或直接在 Google Maps 連結貼上網址自動帶入名稱。
                </p>
              ) : null}
              {renderItineraryForm()}
            </section>
          </aside>
        </div>
        </div>
      </section>
      {pendingCrossDayItem ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#183833]/65 px-4">
          <section className="w-full max-w-md border-2 border-[#183833] bg-[#fffdf7] p-5 text-[#183833] shadow-[8px_8px_0_#d9b75f]">
            <p className="text-xs font-black tracking-[0.18em] text-[#b43c2f]">跨日行程</p>
            <h2 className="mt-2 text-2xl font-black">即將新增隔天行程</h2>
            <p className="mt-3 text-sm font-bold leading-6 text-[#53635f]">
              這個行程時間已經超過晚上 12:00。確認後會先替這趟旅程新增天數，並把「{pendingCrossDayItem.title}」放到隔天。
            </p>
            <label className="mt-5 grid gap-2">
              <span className="text-xs font-black tracking-[0.16em] text-[#7c4b32]">要新增幾天</span>
              <input
                type="number"
                min={1}
                max={13}
                value={crossDayDaysToAdd}
                onChange={(event) => setCrossDayDaysToAdd(Number(event.target.value))}
                className="min-h-11 border-2 border-[#d8cbb6] bg-white px-3 py-2 text-sm font-black text-[#183833] outline-none focus:border-[#1a5b4f]"
              />
            </label>
            <div className="mt-5 grid gap-2 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setPendingCrossDayItem(null);
                  setCrossDayDaysToAdd(1);
                }}
                className="min-h-11 border-2 border-[#d8cbb6] bg-[#fffdf7] px-4 py-2 text-sm font-black transition hover:border-[#b43c2f] hover:text-[#b43c2f]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmCrossDayAdd}
                className="min-h-11 border-2 border-[#183833] bg-[#d9b75f] px-4 py-2 text-sm font-black text-[#183833] shadow-[3px_3px_0_#183833] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_#183833]"
              >
                確認新增
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
                  {!editingItem ? (
                    <p className="mt-2 text-xs font-bold leading-5 text-white/70">
                      可在名稱內搜尋想去的地方，或直接在 Google Maps 連結貼上網址自動帶入名稱。
                    </p>
                  ) : null}
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
