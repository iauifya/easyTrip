import { describe, expect, it } from "vitest";
import { createItineraryItemFromInput, itineraryItemSchema } from "./create-itinerary-item";

describe("create itinerary item helpers", () => {
  it("calculates stay minutes from start and end time", () => {
    const item = createItineraryItemFromInput({
      title: "赤崁樓",
      type: "attraction",
      startTime: "10:00",
      endTime: "11:30",
      address: "台南市中西區民族路二段212號",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=%E8%B5%A4%E5%B4%81%E6%A8%93",
      note: "",
    });

    expect(item.stayMinutes).toBe(90);
    expect(item.note).toBeUndefined();
    expect(item.place).toMatchObject({
      name: "赤崁樓",
      category: "attraction",
      address: "台南市中西區民族路二段212號",
      source: "google_maps_url",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=%E8%B5%A4%E5%B4%81%E6%A8%93",
    });
    expect(item.place?.mapPreviewUrl).toContain("output=embed");
  });

  it("rejects missing Google Maps URLs", () => {
    const result = itineraryItemSchema.safeParse({
      title: "Taipei 101",
      type: "attraction",
      startTime: "10:00",
      endTime: "11:00",
      address: "Xinyi District Taipei",
      googleMapsUrl: "",
      note: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an end time before the start time", () => {
    const result = itineraryItemSchema.safeParse({
      title: "午餐",
      type: "food",
      startTime: "12:30",
      endTime: "12:00",
      address: "",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=%E5%8D%88%E9%A4%90",
      note: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid Google Maps URLs", () => {
    const result = itineraryItemSchema.safeParse({
      title: "午餐",
      type: "food",
      startTime: "12:00",
      endTime: "13:00",
      address: "",
      googleMapsUrl: "not-a-url",
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
        address: "台北市大安區",
        googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=%E5%8D%88%E9%A4%90",
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
        place: {
          id: "place-lunch",
          name: "舊午餐",
          category: "food",
          address: "舊地址",
        },
      },
    );

    expect(item.id).toBe("item-lunch");
    expect(item.placeId).toBe("place-lunch");
    expect(item.place?.id).toBe("place-lunch");
    expect(item.place?.address).toBe("台北市大安區");
    expect(item.title).toBe("午餐");
  });
  it("clears stale place details when a Google Maps URL is updated without resolved details", () => {
    const item = createItineraryItemFromInput(
      {
        title: "New cafe",
        type: "food",
        startTime: "12:00",
        endTime: "13:00",
        address: "",
        googleMapsUrl: "https://www.google.com/maps/place/New+Cafe/@25.06,121.52,17z",
        note: "",
      },
      {
        id: "item-cafe",
        placeId: "place-cafe",
        type: "food",
        title: "Old cafe",
        startTime: "12:00",
        endTime: "13:00",
        stayMinutes: 60,
        place: {
          id: "place-cafe",
          name: "Old cafe",
          category: "food",
          address: "old wrong address",
          lat: 25,
          lng: 121,
          googlePlaceId: "old-place",
          googleMapsUrl: "https://www.google.com/maps/place/Old+Cafe",
        },
      },
    );

    expect(item.place?.address).toBeUndefined();
    expect(item.place?.lat).toBeUndefined();
    expect(item.place?.lng).toBeUndefined();
  });
});
