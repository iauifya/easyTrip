import { z } from "zod";
import type { Trip, TripDay } from "@/types/trip";

const oneDayInMs = 24 * 60 * 60 * 1000;

export const createTripSchema = z
  .object({
    title: z.string().trim().min(2, "旅程名稱至少需要 2 個字"),
    destination: z.string().trim().min(2, "目的地至少需要 2 個字"),
    startDate: z.string().min(1, "請選擇開始日期"),
    endDate: z.string().min(1, "請選擇結束日期"),
    pace: z.enum(["relaxed", "normal", "packed"]),
  })
  .refine((value) => new Date(value.startDate) <= new Date(value.endDate), {
    message: "結束日期不能早於開始日期",
    path: ["endDate"],
  })
  .refine((value) => getDateSpan(value.startDate, value.endDate) <= 14, {
    message: "MVP 先支援最多 14 天的行程",
    path: ["endDate"],
  });

export type CreateTripInput = z.infer<typeof createTripSchema>;

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

function getDateSpan(startDate: string, endDate: string) {
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();

  return Math.floor((end - start) / oneDayInMs) + 1;
}

export function createTripDays(startDate: string, endDate: string): TripDay[] {
  const days: TripDay[] = [];
  const start = parseDate(startDate);
  const totalDays = getDateSpan(startDate, endDate);

  for (let index = 0; index < totalDays; index += 1) {
    days.push({
      id: createId(`day-${index + 1}`),
      date: formatDate(new Date(start.getTime() + index * oneDayInMs)),
      items: [],
    });
  }

  return days;
}

export function createTripFromInput(input: CreateTripInput): Trip {
  const parsedInput = createTripSchema.parse(input);

  return {
    id: createId("trip"),
    title: parsedInput.title,
    destination: parsedInput.destination,
    startDate: parsedInput.startDate,
    endDate: parsedInput.endDate,
    pace: parsedInput.pace,
    days: createTripDays(parsedInput.startDate, parsedInput.endDate),
  };
}
