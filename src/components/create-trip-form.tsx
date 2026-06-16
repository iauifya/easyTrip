"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { createTripFromInput, createTripSchema, type CreateTripInput } from "@/lib/trips/create-trip";
import { paceLabels } from "@/lib/trips/labels";
import {
  taiwanButton,
  taiwanGoldButton,
  taiwanWindowPattern,
} from "@/lib/ui/taiwan-style";
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
  {
    value: "unlimited",
    label: paceLabels.unlimited,
    description: "不限制站數與停留總長，適合自行掌控緊湊行程。",
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
    <main className="min-h-screen bg-[#f6f3ea] text-[#183833]">
      <section className="relative overflow-hidden bg-[#fbf8f0]">
        <div className="absolute inset-0 opacity-80" style={taiwanWindowPattern} />
        <div className="relative mx-auto w-full max-w-[72rem] px-5 py-6 sm:px-8 lg:px-10">
        <header className="border-b-2 border-[#1a5b4f] pb-6">
          <Link
            href="/trips"
            className={taiwanButton}
          >
            回旅程列表
          </Link>
          <p className="mt-8 text-sm font-black tracking-[0.24em] text-[#b43c2f]">新增旅程</p>
          <h1 className="mt-2 text-4xl font-black leading-tight tracking-normal sm:text-6xl">
            先決定去哪裡，時間交給 EasyTrip 協助整理。
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#53635f]">
            這裡只需要填最少資訊。建立後會產生空白行程日，下一步再新增每天的行程點。
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="border-2 border-[#183833] bg-[#fffdf7] p-5 shadow-[8px_8px_0_#1a5b4f] sm:p-6">
            <div className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-black">旅程名稱</span>
                <input
                  {...register("title")}
                  placeholder="例如：台南週末小旅行"
                  className="border-2 border-[#d8cbb6] bg-white px-4 py-3 outline-none transition focus:border-[#1a5b4f]"
                />
                {errors.title ? (
                  <span className="text-sm font-black text-[#b43c2f]">
                    {getFieldError(errors.title)}
                  </span>
                ) : null}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black">目的地</span>
                <input
                  {...register("destination")}
                  placeholder="例如：台南"
                  className="border-2 border-[#d8cbb6] bg-white px-4 py-3 outline-none transition focus:border-[#1a5b4f]"
                />
                {errors.destination ? (
                  <span className="text-sm font-black text-[#b43c2f]">
                    {getFieldError(errors.destination)}
                  </span>
                ) : null}
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black">開始日期</span>
                  <input
                    type="date"
                    {...register("startDate")}
                    className="border-2 border-[#d8cbb6] bg-white px-4 py-3 outline-none transition focus:border-[#1a5b4f]"
                  />
                  {errors.startDate ? (
                    <span className="text-sm font-black text-[#b43c2f]">
                      {getFieldError(errors.startDate)}
                    </span>
                  ) : null}
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">結束日期</span>
                  <input
                    type="date"
                    {...register("endDate")}
                    className="border-2 border-[#d8cbb6] bg-white px-4 py-3 outline-none transition focus:border-[#1a5b4f]"
                  />
                  {errors.endDate ? (
                    <span className="text-sm font-black text-[#b43c2f]">
                      {getFieldError(errors.endDate)}
                    </span>
                  ) : null}
                </label>
              </div>
            </div>
          </section>

          <aside className="border-2 border-[#183833] bg-[#0c4160] p-5 text-white shadow-[8px_8px_0_#b43c2f] sm:p-6 lg:sticky lg:top-6">
            <p className="text-sm font-black tracking-[0.18em] text-[#f2d179]">旅遊節奏</p>
            <div className="mt-4 grid gap-3">
              {paceOptions.map((option) => (
                <label
                  key={option.value}
                  className={`cursor-pointer border-2 p-4 transition ${
                    selectedPace === option.value
                      ? "border-[#f2d179] bg-white/10"
                      : "border-white/20 hover:bg-white/5"
                  }`}
                >
                  <input
                    {...register("pace")}
                    type="radio"
                    value={option.value}
                    className="sr-only"
                  />
                  <span className="block font-black">{option.label}</span>
                  <span className="mt-1 block text-sm leading-6 text-white/60">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`${taiwanGoldButton} mt-6 w-full disabled:cursor-not-allowed disabled:opacity-70`}
            >
              + 建立旅程
            </button>
          </aside>
        </form>
        </div>
      </section>
    </main>
  );
}
