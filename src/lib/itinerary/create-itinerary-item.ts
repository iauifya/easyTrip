import { z } from "zod";
import { timeToMinutes } from "../time/itinerary";
import type { ItineraryItem } from "@/types/trip";

export const itineraryItemSchema = z
  .object({
    title: z.string().trim().min(2, "行程名稱至少需要 2 個字"),
    type: z.enum(["attraction", "food", "hotel", "transport", "shopping", "rest"]),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "請選擇開始時間"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "請選擇結束時間"),
    note: z.string().trim().optional(),
  })
  .refine((value) => timeToMinutes(value.startTime) < timeToMinutes(value.endTime), {
    message: "結束時間必須晚於開始時間",
    path: ["endTime"],
  });

export type ItineraryItemInput = z.infer<typeof itineraryItemSchema>;

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createItineraryItemFromInput(
  input: ItineraryItemInput,
  existingItem?: ItineraryItem,
): ItineraryItem {
  const parsedInput = itineraryItemSchema.parse(input);
  const stayMinutes = timeToMinutes(parsedInput.endTime) - timeToMinutes(parsedInput.startTime);
  const id = existingItem?.id ?? createId("item");

  return {
    id,
    placeId: existingItem?.placeId ?? `place-${id}`,
    type: parsedInput.type,
    title: parsedInput.title,
    startTime: parsedInput.startTime,
    endTime: parsedInput.endTime,
    stayMinutes,
    note: parsedInput.note || undefined,
  };
}
