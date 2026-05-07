import { describe, expect, it } from "vitest";
import { createTripDays, createTripFromInput, createTripSchema } from "./create-trip";

describe("create trip helpers", () => {
  it("creates one day per date in the range", () => {
    const days = createTripDays("2026-07-04", "2026-07-06");

    expect(days).toHaveLength(3);
    expect(days.map((day) => day.date)).toEqual(["2026-07-04", "2026-07-05", "2026-07-06"]);
  });

  it("rejects an end date before the start date", () => {
    const result = createTripSchema.safeParse({
      title: "台南小旅行",
      destination: "台南",
      startDate: "2026-07-06",
      endDate: "2026-07-04",
      pace: "relaxed",
    });

    expect(result.success).toBe(false);
  });

  it("creates an empty trip from valid form input", () => {
    const trip = createTripFromInput({
      title: "台南小旅行",
      destination: "台南",
      startDate: "2026-07-04",
      endDate: "2026-07-05",
      pace: "relaxed",
    });

    expect(trip.destination).toBe("台南");
    expect(trip.days).toHaveLength(2);
    expect(trip.days[0].items).toEqual([]);
  });
});
