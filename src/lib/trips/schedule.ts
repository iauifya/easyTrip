import type { Trip, TripDay } from "@/types/trip";

const oneDayInMs = 24 * 60 * 60 * 1000;
const maxTripDays = 14;

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getEndDateFromDayCount(startDate: string, dayCount: number) {
  const start = parseDate(startDate);

  return formatDate(new Date(start.getTime() + (dayCount - 1) * oneDayInMs));
}

export function adjustTripSchedule(trip: Trip, startDate: string, dayCount: number): Trip {
  if (!startDate) {
    throw new Error("請選擇出發日期");
  }

  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > maxTripDays) {
    throw new Error("天數需介於 1 到 14 天");
  }

  const start = parseDate(startDate);
  const days: TripDay[] = Array.from({ length: dayCount }, (_, index) => {
    const existingDay = trip.days[index];
    const date = formatDate(new Date(start.getTime() + index * oneDayInMs));

    return {
      id: existingDay?.id ?? createId(`day-${index + 1}`),
      date,
      items: existingDay?.items ?? [],
    };
  });

  return {
    ...trip,
    startDate,
    endDate: getEndDateFromDayCount(startDate, dayCount),
    days,
  };
}
