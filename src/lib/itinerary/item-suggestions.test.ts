import { describe, expect, it } from "vitest";
import { getDefaultItemTimes, suggestItemType } from "./item-suggestions";

describe("item suggestions", () => {
  it("suggests food from title keywords", () => {
    expect(suggestItemType("寧夏夜市晚餐")).toBe("food");
  });

  it("suggests transport from title keywords", () => {
    expect(suggestItemType("台北車站集合")).toBe("transport");
  });

  it("defaults to 08:00 when the day is empty", () => {
    expect(getDefaultItemTimes([])).toEqual({
      startTime: "08:00",
      endTime: "09:30",
    });
  });

  it("starts from the latest existing end time", () => {
    expect(
      getDefaultItemTimes([
        {
          id: "a",
          placeId: "a",
          type: "food",
          title: "午餐",
          startTime: "12:00",
          endTime: "13:10",
          stayMinutes: 70,
        },
      ]),
    ).toEqual({
      startTime: "13:10",
      endTime: "14:40",
    });
  });
});
