import { z } from "zod";
import {
  createItineraryItemFromInput,
  itineraryItemSchema,
  type ItineraryItemInput,
} from "@/lib/itinerary/create-itinerary-item";
import { timeToMinutes } from "@/lib/time/itinerary";
import type { ItineraryItem, ItineraryItemType, Trip, TripDay } from "@/types/trip";

export type AiItineraryImportItem = {
  title: string;
  address: string;
  startTime: string;
  endTime: string;
  type: ItineraryItemType;
  note?: string;
};

export type AiItineraryImportPayload = {
  version: 1;
  items: AiItineraryImportItem[];
};

export type InvalidAiItineraryImportRow = {
  index: number;
  raw: unknown;
  message: string;
};

export type AiItineraryImportResult = {
  items: ItineraryItem[];
  invalidRows: InvalidAiItineraryImportRow[];
  error?: string;
};

export type AiItineraryImportDayAssignment = {
  item: ItineraryItem;
  dayOffset: number;
};

const itemTypeValues = ["attraction", "food", "hotel", "transport", "shopping", "rest"] as const;
const lateNightBoundaryMinutes = 20 * 60;
const earlyMorningBoundaryMinutes = 6 * 60;
const largeBackwardJumpMinutes = 6 * 60;

const aiImportItemSchema = z.object({
  title: z.string().trim().min(1, "缺少名稱"),
  address: z.string().trim().min(1, "缺少地址"),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "開始時間格式錯誤"),
  endTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "結束時間格式錯誤"),
  type: z.enum(itemTypeValues, {
    error: "類型不支援",
  }),
  note: z.string().trim().optional(),
});

const aiImportPayloadSchema = z.object({
  version: z.literal(1),
  items: z.array(z.unknown()),
});

function extractJsonText(input: string) {
  const trimmedInput = input.trim();
  const codeBlock = trimmedInput.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  return codeBlock?.[1]?.trim() ?? trimmedInput;
}

function normalizePastedJsonText(input: string) {
  return input
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");
}

function getZodErrorMessage(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join("; ");
}

function toItineraryInput(item: AiItineraryImportItem): ItineraryItemInput {
  return {
    title: item.title,
    address: item.address,
    startTime: item.startTime,
    endTime: item.endTime,
    type: item.type,
    googleMapsUrl: "",
    note: item.note ?? "",
  };
}

export function parseAiItineraryImport(input: string): AiItineraryImportResult {
  if (!input.trim()) {
    return {
      items: [],
      invalidRows: [],
      error: "請先貼上 AI 回傳的 JSON 行程結果。",
    };
  }

  let parsed: unknown;
  const jsonText = extractJsonText(input);

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    try {
      parsed = JSON.parse(normalizePastedJsonText(jsonText));
    } catch {
      return {
        items: [],
        invalidRows: [],
        error: "貼上的內容不是有效的 JSON。",
      };
    }
  }

  const payloadResult = aiImportPayloadSchema.safeParse(parsed);

  if (!payloadResult.success) {
    return {
      items: [],
      invalidRows: [],
      error: "JSON 必須包含 version: 1 與 items 陣列。",
    };
  }

  const items: ItineraryItem[] = [];
  const invalidRows: InvalidAiItineraryImportRow[] = [];

  payloadResult.data.items.forEach((rawItem, index) => {
    const aiItemResult = aiImportItemSchema.safeParse(rawItem);

    if (!aiItemResult.success) {
      invalidRows.push({
        index,
        raw: rawItem,
        message: getZodErrorMessage(aiItemResult.error),
      });
      return;
    }

    const itineraryInput = toItineraryInput(aiItemResult.data);
    const itineraryInputResult = itineraryItemSchema.safeParse(itineraryInput);

    if (!itineraryInputResult.success) {
      invalidRows.push({
        index,
        raw: rawItem,
        message: getZodErrorMessage(itineraryInputResult.error),
      });
      return;
    }

    items.push(createItineraryItemFromInput(itineraryInputResult.data));
  });

  return {
    items,
    invalidRows,
  };
}

export function getAiItineraryImportDayAssignments(
  importedItems: ItineraryItem[],
  existingDayItems: ItineraryItem[] = [],
): AiItineraryImportDayAssignment[] {
  let currentDayOffset = 0;
  let previousStartMinutes: number | undefined;
  let previousItemCrossedMidnight = false;
  let previousEndMinutes =
    existingDayItems.length > 0
      ? timeToMinutes(existingDayItems.at(-1)?.endTime ?? "00:00")
      : undefined;

  return importedItems.map((item) => {
    const startMinutes = timeToMinutes(item.startTime);
    const endMinutes = timeToMinutes(item.endTime);
    const followsLateNightItem =
      typeof previousEndMinutes === "number" &&
      previousEndMinutes >= lateNightBoundaryMinutes &&
      startMinutes < earlyMorningBoundaryMinutes;
    const hasLargeBackwardJump =
      !previousItemCrossedMidnight &&
      typeof previousStartMinutes === "number" &&
      previousStartMinutes - startMinutes > largeBackwardJumpMinutes;

    if (followsLateNightItem || hasLargeBackwardJump) {
      currentDayOffset += 1;
    }

    let dayOffset = currentDayOffset;

    const itemCrossesMidnight = endMinutes <= startMinutes;

    if (itemCrossesMidnight) {
      dayOffset = Math.max(dayOffset, currentDayOffset + 1);
      currentDayOffset = dayOffset;
    }

    previousStartMinutes = startMinutes;
    previousEndMinutes = endMinutes;
    previousItemCrossedMidnight = itemCrossesMidnight;

    return {
      item,
      dayOffset,
    };
  });
}

export function createAiItineraryPrompt(trip: Trip, day: TripDay) {
  return `You are helping plan an EasyTrip itinerary.

Trip:
- Title: ${trip.title}
- Destination: ${trip.destination}
- Date: ${day.date}
- Pace: ${trip.pace}

Please return only valid JSON. Do not include markdown, explanations, comments, or trailing commas.

JSON schema:
{
  "version": 1,
  "items": [
    {
      "title": "Place name",
      "address": "Full address or searchable location",
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "type": "attraction",
      "note": "Short practical note"
    }
  ]
}

Rules:
- type must be one of: attraction, food, hotel, transport, shopping, rest.
- startTime and endTime must use 24-hour HH:mm format.
- Every item must include title, address, startTime, endTime, and type.
- Keep the route realistic for ${trip.destination}.
- Return JSON only.`;
}
