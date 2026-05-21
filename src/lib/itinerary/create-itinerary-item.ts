import { z } from "zod";
import { timeToMinutes } from "../time/itinerary";
import {
  createGoogleMapsPreview,
  createGoogleMapsSearchUrl,
  isGoogleMapsUrl,
  parseGoogleMapsUrl,
} from "@/lib/places/google-maps";
import type { ItineraryItem, Place } from "@/types/trip";

const googleMapsUrlSchema = z
  .string()
  .trim()
  .min(1, "請填寫 Google Maps 連結")
  .refine(isGoogleMapsUrl, "請貼上有效的 Google Maps 連結");

export const itineraryItemSchema = z
  .object({
    title: z.string().trim().min(1, "請填寫名稱").min(2, "名稱至少需要 2 個字"),
    type: z.enum(["attraction", "food", "hotel", "transport", "shopping", "rest"], {
      error: "請選擇類型",
    }),
    startTime: z.string().trim().min(1, "請填寫開始時間").regex(/^\d{2}:\d{2}$/, "請填寫有效的開始時間"),
    endTime: z.string().trim().min(1, "請填寫結束時間").regex(/^\d{2}:\d{2}$/, "請填寫有效的結束時間"),
    address: z.string().trim().optional(),
    googlePlaceId: z.string().trim().optional(),
    googleMapsUrl: googleMapsUrlSchema,
    lat: z.coerce.number().optional(),
    lng: z.coerce.number().optional(),
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

function createPlaceFromInput(
  input: ItineraryItemInput,
  placeId: string,
  existingPlace?: Place,
): Place {
  const mapsPreview = createGoogleMapsPreview({
    title: input.title,
    address: input.address,
    googlePlaceId: input.googlePlaceId,
    googleMapsUrl: input.googleMapsUrl,
    lat: input.lat,
    lng: input.lng,
  });
  const hasGoogleMapsUrl = Boolean(input.googleMapsUrl?.trim());
  const parsedGoogleMapsUrl = input.googleMapsUrl ? parseGoogleMapsUrl(input.googleMapsUrl) : undefined;
  const hasResolvedPlaceDetails = Boolean(
    input.googlePlaceId ||
      (typeof input.lat === "number" && typeof input.lng === "number") ||
      input.address?.trim(),
  );
  const shouldUseSearchUrlFallback =
    hasGoogleMapsUrl && !hasResolvedPlaceDetails && !parsedGoogleMapsUrl?.query && !parsedGoogleMapsUrl?.placeName;
  const fallbackGoogleMapsUrl = shouldUseSearchUrlFallback
    ? createGoogleMapsSearchUrl(input.title)
    : mapsPreview?.googleMapsUrl;

  return {
    ...existingPlace,
    id: placeId,
    name: input.title,
    category: input.type,
    address: input.address || undefined,
    lat: hasGoogleMapsUrl ? input.lat : input.lat ?? existingPlace?.lat,
    lng: hasGoogleMapsUrl ? input.lng : input.lng ?? existingPlace?.lng,
    googlePlaceId: input.googlePlaceId || mapsPreview?.googlePlaceId || existingPlace?.googlePlaceId,
    googleMapsUrl: fallbackGoogleMapsUrl,
    mapPreviewUrl: mapsPreview?.mapPreviewUrl,
    source: mapsPreview?.source ?? existingPlace?.source ?? "manual",
    averageStayMinutes: timeToMinutes(input.endTime) - timeToMinutes(input.startTime),
  };
}

export function createItineraryItemFromInput(
  input: ItineraryItemInput,
  existingItem?: ItineraryItem,
): ItineraryItem {
  const parsedInput = itineraryItemSchema.parse(input);
  const stayMinutes = timeToMinutes(parsedInput.endTime) - timeToMinutes(parsedInput.startTime);
  const id = existingItem?.id ?? createId("item");
  const placeId = existingItem?.placeId ?? `place-${id}`;

  return {
    id,
    placeId,
    place: createPlaceFromInput(parsedInput, placeId, existingItem?.place),
    type: parsedInput.type,
    title: parsedInput.title,
    startTime: parsedInput.startTime,
    endTime: parsedInput.endTime,
    stayMinutes,
    note: parsedInput.note || undefined,
  };
}
