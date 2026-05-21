import { describe, expect, it } from "vitest";
import type { Trip } from "@/types/trip";
import { adjustTripSchedule, getEndDateFromDayCount } from "./schedule";

const trip: Trip = {
  id: "trip",
  title: "Test trip",
  destination: "Taipei",
  startDate: "2026-06-13",
  endDate: "2026-06-14",
  pace: "relaxed",
  days: [
    {
      id: "day-1",
      date: "2026-06-13",
      items: [
        {
          id: "item-1",
          placeId: "place-1",
          type: "food",
          title: "Lunch",
          startTime: "12:00",
          endTime: "13:00",
          stayMinutes: 60,
        },
      ],
    },
    {
      id: "day-2",
      date: "2026-06-14",
      items: [],
    },
  ],
};

describe("trip schedule helpers", () => {
  it("calculates an end date from a day count", () => {
    expect(getEndDateFromDayCount("2026-06-13", 3)).toBe("2026-06-15");
  });

  it("updates day dates while preserving existing items by day index", () => {
    const updatedTrip = adjustTripSchedule(trip, "2026-07-01", 2);

    expect(updatedTrip.startDate).toBe("2026-07-01");
    expect(updatedTrip.endDate).toBe("2026-07-02");
    expect(updatedTrip.days[0]).toMatchObject({
      id: "day-1",
      date: "2026-07-01",
      items: trip.days[0].items,
    });
  });

  it("adds empty days when the day count increases", () => {
    const updatedTrip = adjustTripSchedule(trip, "2026-07-01", 3);

    expect(updatedTrip.days).toHaveLength(3);
    expect(updatedTrip.days[2]).toMatchObject({
      date: "2026-07-03",
      items: [],
    });
  });

  it("removes trailing days when the day count decreases", () => {
    const updatedTrip = adjustTripSchedule(trip, "2026-07-01", 1);

    expect(updatedTrip.days).toHaveLength(1);
    expect(updatedTrip.endDate).toBe("2026-07-01");
  });
});
