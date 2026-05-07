"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { createTripFromInput, createTripSchema, type CreateTripInput } from "@/lib/trips/create-trip";
import { paceLabels } from "@/lib/trips/labels";
import { useTripStore } from "@/store/trip-store";
import type { TripPace } from "@/types/trip";

const paceOptions: Array<{
  value: TripPace;
  label: string;
  description: string;
}> = [
  {
    value: "relaxed",
    label: paceLabels.relaxed,
    description: "保留比較多休息和找路時間。",
  },
  {
    value: "normal",
    label: paceLabels.normal,
    description: "適合一天 3 到 5 個主要停留點。",
  },
  {
    value: "packed",
    label: paceLabels.packed,
    description: "行程比較滿，之後會更需要時間提醒。",
  },
];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getFieldError(error: unknown) {
  return typeof error === "object" && error && "message" in error
    ? String(error.message)
    : undefined;
}

export function CreateTripForm() {
  const router = useRouter();
  const addTrip = useTripStore((state) => state.addTrip);
  const hasHydrated = useTripStore((state) => state.hasHydrated);
  const hydrateTrips = useTripStore((state) => state.hydrateTrips);

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    control,
    register,
    setError,
  } = useForm<CreateTripInput>({
    defaultValues: {
      title: "",
      destination: "",
      startDate: getToday(),
      endDate: getToday(),
      pace: "relaxed",
    },
  });

  useEffect(() => {
    if (!hasHydrated) {
      hydrateTrips();
    }
  }, [hasHydrated, hydrateTrips]);

  function applySchemaErrors(error: z.ZodError<CreateTripInput>) {
    for (const issue of error.issues) {
      const field = issue.path[0];

      if (typeof field === "string") {
        setError(field as keyof CreateTripInput, {
          type: "manual",
          message: issue.message,
        });
      }
    }
  }

  function onSubmit(values: CreateTripInput) {
    const result = createTripSchema.safeParse(values);

    if (!result.success) {
      applySchemaErrors(result.error);
      return;
    }

    const trip = createTripFromInput(result.data);

    addTrip(trip);
    router.push("/");
  }

  const selectedPace = useWatch({
    control,
    name: "pace",
  });

  return (
    <main className="min-h-screen bg-[var(--color-surface)] text-[var(--color-ink)]">
      <section className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="border-b border-[var(--color-line)] pb-6">
          <Link
            href="/trips"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-[var(--color-mist)]"
          >
            回旅程列表
          </Link>
          <p className="mt-8 text-sm font-semibold text-[var(--color-teal)]">新增旅程</p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal sm:text-5xl">
            先決定去哪裡，時間交給 EasyTrip 協助整理。
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
            這裡只需要填最少資訊。建立後會產生空白行程日，下一步再新增每天的行程點。
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="rounded-lg bg-white p-5 shadow-sm sm:p-6">
            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-bold">旅程名稱</span>
                <input
                  {...register("title")}
                  placeholder="例如：台南週末小旅行"
                  className="rounded-md border border-[var(--color-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--color-teal)]"
                />
                {errors.title ? (
                  <span className="text-sm font-semibold text-[var(--color-danger)]">
                    {getFieldError(errors.title)}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold">目的地</span>
                <input
                  {...register("destination")}
                  placeholder="例如：台南"
                  className="rounded-md border border-[var(--color-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--color-teal)]"
                />
                {errors.destination ? (
                  <span className="text-sm font-semibold text-[var(--color-danger)]">
                    {getFieldError(errors.destination)}
                  </span>
                ) : null}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-bold">開始日期</span>
                  <input
                    type="date"
                    {...register("startDate")}
                    className="rounded-md border border-[var(--color-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--color-teal)]"
                  />
                  {errors.startDate ? (
                    <span className="text-sm font-semibold text-[var(--color-danger)]">
                      {getFieldError(errors.startDate)}
                    </span>
                  ) : null}
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold">結束日期</span>
                  <input
                    type="date"
                    {...register("endDate")}
                    className="rounded-md border border-[var(--color-line)] bg-white px-4 py-3 outline-none transition focus:border-[var(--color-teal)]"
                  />
                  {errors.endDate ? (
                    <span className="text-sm font-semibold text-[var(--color-danger)]">
                      {getFieldError(errors.endDate)}
                    </span>
                  ) : null}
                </label>
              </div>
            </div>
          </section>

          <aside className="rounded-lg bg-[var(--color-ink)] p-5 text-white shadow-sm sm:p-6 lg:sticky lg:top-6">
            <p className="text-sm font-semibold text-white/60">旅遊節奏</p>
            <div className="mt-4 grid gap-3">
              {paceOptions.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-md border p-4 transition ${
                    selectedPace === option.value
                      ? "border-[var(--color-sun)] bg-white/10"
                      : "border-white/15 hover:bg-white/5"
                  }`}
                >
                  <input
                    {...register("pace")}
                    type="radio"
                    value={option.value}
                    className="sr-only"
                  />
                  <span className="block font-bold">{option.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-white/60">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 w-full rounded-md bg-[var(--color-sun)] px-4 py-3 text-sm font-bold text-[var(--color-ink)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              + 建立旅程
            </button>
          </aside>
        </form>
      </section>
    </main>
  );
}
