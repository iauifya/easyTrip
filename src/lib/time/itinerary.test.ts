import { describe, expect, it } from "vitest";
import {
  getNextItem,
  getTightGapItemIds,
  hasTightGap,
  minutesToTime,
  timeToMinutes,
} from "./itinerary";

describe("itinerary time helpers", () => {
  it("converts HH:mm time to minutes", () => {
    expect(timeToMinutes("11:25")).toBe(685);
  });

  it("converts minutes to HH:mm time", () => {
    expect(minutesToTime(685)).toBe("11:25");
  });

  it("detects gaps that are too tight", () => {
    expect(
      hasTightGap(
        {
          id: "a",
          placeId: "a",
          type: "food",
          title: "Lunch",
          startTime: "12:00",
          endTime: "13:00",
          stayMinutes: 60,
        },
        {
          id: "b",
          placeId: "b",
          type: "attraction",
          title: "Museum",
          startTime: "13:10",
          endTime: "14:00",
          stayMinutes: 50,
        },
      ),
    ).toBe(true);
  });

  it("finds the active or upcoming item", () => {
    const item = getNextItem(
      [
        {
          id: "a",
          placeId: "a",
          type: "hotel",
          title: "Drop bags",
          startTime: "10:00",
          endTime: "10:30",
          stayMinutes: 30,
        },
        {
          id: "b",
          placeId: "b",
          type: "food",
          title: "Cafe",
          startTime: "11:25",
          endTime: "12:30",
          stayMinutes: 65,
        },
      ],
      "10:58",
    );

    expect(item?.id).toBe("b");
  });

  it("returns ids for items that start too soon after the previous item", () => {
    const ids = getTightGapItemIds([
      {
        id: "a",
        placeId: "a",
        type: "hotel",
        title: "Drop bags",
        startTime: "10:00",
        endTime: "10:30",
        stayMinutes: 30,
      },
      {
        id: "b",
        placeId: "b",
        type: "food",
        title: "Cafe",
        startTime: "10:40",
        endTime: "11:30",
        stayMinutes: 50,
      },
    ]);

    expect([...ids]).toEqual(["b"]);
  });
});
