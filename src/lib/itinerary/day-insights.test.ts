import { describe, expect, it } from "vitest";
import { getCurrentTimeString, getDayProgress, getDayWarnings, getNextStopInsight } from "./day-insights";
import type { ItineraryItem } from "@/types/trip";

const items: ItineraryItem[] = [
  {
    id: "a",
    placeId: "a",
    type: "hotel",
    title: "寄放行李",
    startTime: "10:00",
    endTime: "10:30",
    stayMinutes: 30,
  },
  {
    id: "b",
    placeId: "b",
    type: "food",
    title: "午餐",
    startTime: "10:40",
    endTime: "11:40",
    stayMinutes: 60,
  },
];

describe("day insights", () => {
  it("returns the active stop when current time is inside an item range", () => {
    const insight = getNextStopInsight(items, "10:10");

    expect(insight.status).toBe("active");
    expect(insight.item?.id).toBe("a");
  });

  it("returns the upcoming stop when current time is before the next item", () => {
    const insight = getNextStopInsight(items, "10:35");

    expect(insight.status).toBe("upcoming");
    expect(insight.item?.id).toBe("b");
  });

  it("warns when the day has tight gaps", () => {
    const warnings = getDayWarnings(items, "relaxed");

    expect(warnings.some((warning) => warning.id === "tight-gaps")).toBe(true);
  });

  it("does not warn about too many stops for the unlimited pace", () => {
    const manyStops = Array.from({ length: 9 }, (_, index) => ({
      id: `stop-${index}`,
      placeId: `stop-${index}`,
      type: "attraction" as const,
      title: `Stop ${index + 1}`,
      startTime: `${String(8 + index).padStart(2, "0")}:00`,
      endTime: `${String(8 + index).padStart(2, "0")}:30`,
      stayMinutes: 30,
    }));

    const warnings = getDayWarnings(manyStops, "unlimited");

    expect(warnings.some((warning) => warning.id === "too-many-stops")).toBe(false);
  });

  it("calculates completed progress", () => {
    const progress = getDayProgress(items, "10:35");

    expect(progress.completed).toBe(1);
    expect(progress.total).toBe(2);
    expect(progress.percent).toBe(50);
  });

  it("formats current time as HH:mm", () => {
    const time = getCurrentTimeString(new Date(2026, 6, 4, 9, 5));

    expect(time).toBe("09:05");
  });
});
