import { describe, expect, it } from "vitest";
import { getLocalDateString, getTodayTripDay, getTripDayStatus, hasTodayTripDay } from "./today";
import type { Trip } from "@/types/trip";

const trip: Trip = {
  id: "trip",
  title: "Today trip",
  destination: "台北",
  startDate: "2026-07-04",
  endDate: "2026-07-04",
  pace: "relaxed",
  days: [
    {
      id: "day",
      date: "2026-07-04",
      items: [],
    },
  ],
};

describe("today trip helpers", () => {
  it("formats a local date string without timezone shifting", () => {
    expect(getLocalDateString(new Date(2026, 6, 4, 9, 5))).toBe("2026-07-04");
  });

  it("finds a trip day that matches today", () => {
    expect(getTodayTripDay(trip, new Date(2026, 6, 4))?.id).toBe("day");
  });

  it("detects when a trip does not contain today", () => {
    expect(hasTodayTripDay(trip, new Date(2026, 6, 5))).toBe(false);
  });

  it("detects upcoming trip days", () => {
    expect(getTripDayStatus("2026-07-06", new Date(2026, 6, 5))).toBe("upcoming");
  });
});
