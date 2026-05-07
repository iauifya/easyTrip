"use client";

import Link from "next/link";
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
import { categoryLabels, paceLabels } from "@/lib/trips/labels";
import { getSortedItems, getTightGapItemIds, minutesToTime, timeToMinutes } from "@/lib/time/itinerary";
import { getTodayTripDay, getTripDayStatus } from "@/lib/trips/today";
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
  note: "",
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
    note: item.note ?? "",
  };
}

export function ItineraryDayPlanner({ tripId, dayId }: { tripId: string; dayId: string }) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => getCurrentTimeString());
  const trips = useTripStore((state) => state.trips);
  const hasHydrated = useTripStore((state) => state.hasHydrated);
  const hydrateTrips = useTripStore((state) => state.hydrateTrips);
  const setSelectedTripId = useTripStore((state) => state.setSelectedTripId);
  const setSelectedDayId = useTripStore((state) => state.setSelectedDayId);
  const addItineraryItem = useTripStore((state) => state.addItineraryItem);
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

  const trip = trips.find((item) => item.id === tripId);
  const day = trip?.days.find((item) => item.id === dayId);
  const items = getSortedItems(day?.items ?? []);
  const tightGapItemIds = getTightGapItemIds(items);
  const dayWarnings = trip ? getDayWarnings(items, trip.pace) : [];
  const dayStatus = day ? getTripDayStatus(day.date) : "today";
  const nextStop = getNextStopInsight(items, currentTime);
  const editingItem = items.find((item) => item.id === editingItemId);
  const todayDay = getTodayTripDay(trip);
  const lastItemEndTime = items.at(-1)?.endTime ?? "08:00";
  const dayIdForDefaults = day?.id;

  function getDefaultTimesFromLastItem(type: ItineraryItemType = "attraction") {
    return {
      startTime: lastItemEndTime,
      endTime: minutesToTime(timeToMinutes(lastItemEndTime) + getDefaultStayMinutes(type)),
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
      const startTime = lastItemEndTime;

      setValue("type", suggestedType);
      setValue("startTime", startTime);
      setValue("endTime", minutesToTime(timeToMinutes(startTime) + getDefaultStayMinutes(suggestedType)));
    }
  }, [editingItemId, lastItemEndTime, setValue, title]);

  useEffect(() => {
    if (!editingItemId && dayIdForDefaults) {
      reset({
        ...fallbackValues,
        startTime: lastItemEndTime,
        endTime: minutesToTime(timeToMinutes(lastItemEndTime) + getDefaultStayMinutes("attraction")),
      });
    }
  }, [dayIdForDefaults, editingItemId, lastItemEndTime, reset]);

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

  function startEdit(item: ItineraryItem) {
    setEditingItemId(item.id);
    reset(toFormValues(item));
  }

  function cancelEdit() {
    setEditingItemId(null);
    reset({
      ...fallbackValues,
      ...getDefaultTimesFromLastItem(),
    });
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
    <main className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <section className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="border-b border-[var(--color-line)] pb-6">
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/trips"
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-[var(--color-mist)]"
            >
              回旅程列表
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-[var(--color-mist)]"
            >
              總覽
            </Link>
            <Link
              href={`/trips/${tripId}/today`}
              className={`inline-flex min-h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-bold shadow-sm transition ${
                todayDay
                  ? "bg-[var(--color-ink)] text-white hover:bg-[var(--color-teal)]"
                  : "pointer-events-none bg-white text-[var(--color-muted)]"
              }`}
            >
              {todayDay ? "今日模式" : "非今日行程"}
            </Link>
          </div>
          <p className="mt-8 text-sm font-semibold text-[var(--color-teal)]">
            {trip.destination} · {paceLabels[trip.pace]}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">{trip.title}</h1>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {trip.days.map((tripDay, index) => (
              <Link
                key={tripDay.id}
                href={`/trips/${trip.id}/day/${tripDay.id}`}
                className={`shrink-0 rounded-md px-4 py-2 text-sm font-bold transition ${
                  tripDay.id === day.id
                    ? "bg-[var(--color-ink)] text-white"
                    : "bg-white shadow-sm hover:bg-[var(--color-mist)]"
                }`}
              >
                {formatDayLabel(tripDay.date, index)}
              </Link>
            ))}
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <section>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-muted)]">單日時間軸</p>
                <h2 className="mt-1 text-2xl font-bold">{day.date}</h2>
              </div>
              <p className="text-sm font-semibold text-[var(--color-muted)]">
                {items.length} 站 · {dayWarnings.length} 則提醒
              </p>
            </div>

            <div className="mt-5 rounded-lg bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-[var(--color-muted)]">下一站卡片</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="text-2xl font-bold">
                    {nextStopTitle}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted)]">
                    {nextStopMessage}
                  </p>
                </div>
                <span className="w-fit rounded-md bg-[var(--color-sun)] px-4 py-2 text-sm font-bold">
                  {nextStopLabel}
                </span>
              </div>
            </div>

            {dayWarnings.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {dayWarnings.map((warning) => (
                  <div
                    key={warning.id}
                    className="rounded-lg border border-[var(--color-warn-line)] bg-[var(--color-warn)] p-4 text-[var(--color-warn-ink)]"
                  >
                    <p className="font-bold">{warning.title}</p>
                    <p className="mt-1 text-sm leading-6">{warning.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-mist)] p-4">
                <p className="font-bold text-[var(--color-teal)]">這一天的安排看起來剛好</p>
                <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                  目前沒有過多站點、過長停留或太短移動間隔。
                </p>
              </div>
            )}

            {items.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-[var(--color-line)] bg-white p-8 text-center">
                <h3 className="text-xl font-bold">這一天還是空的</h3>
                <p className="mt-2 text-[var(--color-muted)]">
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
                      className="rounded-lg border border-[var(--color-line)] bg-white p-5 shadow-sm"
                    >
                      <div className="flex gap-3 sm:gap-4">
                        <div className="flex flex-col items-center">
                          <span className="grid size-9 place-items-center rounded-md bg-[var(--color-ink)] text-sm font-bold text-white">
                            {index + 1}
                          </span>
                          {index < items.length - 1 ? (
                            <span className="mt-2 h-full min-h-10 w-px bg-[var(--color-line)]" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[var(--color-teal)]">
                                {item.startTime} - {item.endTime} · {item.stayMinutes} 分鐘
                              </p>
                              <h3 className="mt-1 text-xl font-bold">{item.title}</h3>
                            </div>
                            <span className="rounded-md bg-[var(--color-mist)] px-3 py-1 text-xs font-bold">
                              {categoryLabels[item.type]}
                            </span>
                          </div>
                          {isTight ? (
                            <p className="mt-3 rounded-md bg-[var(--color-warn)] px-3 py-2 text-sm font-bold text-[var(--color-warn-ink)]">
                              這站和上一站間隔太短，建議多留一點找路或排隊時間。
                            </p>
                          ) : null}
                          {item.note ? (
                            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                              {item.note}
                            </p>
                          ) : null}
                          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="min-h-10 rounded-md bg-[var(--color-ink)] px-3 py-2 text-sm font-bold text-white transition hover:bg-[var(--color-teal)]"
                            >
                              編輯
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteItineraryItem(tripId, dayId, item.id)}
                              className="min-h-10 rounded-md border border-[var(--color-line)] px-3 py-2 text-sm font-bold transition hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
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

          <aside className="rounded-lg bg-[var(--color-ink)] p-5 text-white shadow-sm sm:p-6 lg:sticky lg:top-6">
            <p className="text-sm font-semibold text-white/60">
              {editingItem ? "編輯行程點" : "新增行程點"}
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              {editingItem ? editingItem.title : "加入下一個地點"}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-bold">名稱</span>
                <input
                  {...register("title")}
                  placeholder="例如：赤崁樓"
                  className="rounded-md border border-white/15 bg-white px-3 py-3 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-sun)]"
                />
                {errors.title ? (
                  <span className="text-sm font-semibold text-[var(--color-sun)]">
                    {getFieldError(errors.title)}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold">類型</span>
                <select
                  {...register("type")}
                  className="rounded-md border border-white/15 bg-white px-3 py-3 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-sun)]"
                >
                  {itemTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-white/55">目前類型：{categoryLabels[selectedType]}</span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold">開始</span>
                  <input
                    type="time"
                    {...register("startTime")}
                    className="rounded-md border border-white/15 bg-white px-3 py-3 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-sun)]"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-bold">結束</span>
                  <input
                    type="time"
                    {...register("endTime")}
                    className="rounded-md border border-white/15 bg-white px-3 py-3 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-sun)]"
                  />
                </label>
              </div>
              {errors.startTime || errors.endTime ? (
                <span className="text-sm font-semibold text-[var(--color-sun)]">
                  {getFieldError(errors.startTime) ?? getFieldError(errors.endTime)}
                </span>
              ) : null}

              <label className="grid gap-2">
                <span className="text-sm font-bold">備註</span>
                <textarea
                  {...register("note")}
                  rows={4}
                  placeholder="例如：這裡容易迷路，先找 2 號出口。"
                  className="resize-none rounded-md border border-white/15 bg-white px-3 py-3 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-sun)]"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-[var(--color-sun)] px-4 py-3 text-sm font-bold text-[var(--color-ink)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {editingItem ? "儲存修改" : "+ 新增行程點"}
              </button>
              {editingItem ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md border border-white/15 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  取消編輯
                </button>
              ) : null}
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}
