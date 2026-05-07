import { describe, expect, it } from "vitest";
import { createItineraryItemFromInput, itineraryItemSchema } from "./create-itinerary-item";

describe("create itinerary item helpers", () => {
  it("calculates stay minutes from start and end time", () => {
    const item = createItineraryItemFromInput({
      title: "赤崁樓",
      type: "attraction",
      startTime: "10:00",
      endTime: "11:30",
      note: "",
    });

    expect(item.stayMinutes).toBe(90);
    expect(item.note).toBeUndefined();
  });

  it("rejects an end time before the start time", () => {
    const result = itineraryItemSchema.safeParse({
      title: "午餐",
      type: "food",
      startTime: "12:30",
      endTime: "12:00",
      note: "",
    });

    expect(result.success).toBe(false);
  });

  it("preserves ids when editing an existing item", () => {
    const item = createItineraryItemFromInput(
      {
        title: "午餐",
        type: "food",
        startTime: "12:00",
        endTime: "13:00",
        note: "不用排太滿。",
      },
      {
        id: "item-lunch",
        placeId: "place-lunch",
        type: "food",
        title: "舊午餐",
        startTime: "11:30",
        endTime: "12:30",
        stayMinutes: 60,
      },
    );

    expect(item.id).toBe("item-lunch");
    expect(item.placeId).toBe("place-lunch");
    expect(item.title).toBe("午餐");
  });
});
