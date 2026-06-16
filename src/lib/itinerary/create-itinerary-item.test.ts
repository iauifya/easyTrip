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

  it("accepts address-only inputs", () => {
    const item = createItineraryItemFromInput({
      title: "Taipei 101",
      type: "attraction",
      startTime: "10:00",
      endTime: "11:00",
      address: "台北市信義區信義路五段7號",
      googleMapsUrl: "",
      note: "",
    });

    expect(item.place).toMatchObject({
      address: "台北市信義區信義路五段7號",
      source: "place_search",
      googleMapsUrl:
        "https://www.google.com/maps/search/?api=1&query=Taipei+101+%E5%8F%B0%E5%8C%97%E5%B8%82%E4%BF%A1%E7%BE%A9%E5%8D%80%E4%BF%A1%E7%BE%A9%E8%B7%AF%E4%BA%94%E6%AE%B57%E8%99%9F",
    });
  });

  it("does not turn empty coordinate fields into 0,0", () => {
    const item = createItineraryItemFromInput({
      title: "在家行旅",
      type: "hotel",
      startTime: "22:00",
      endTime: "23:30",
      address: "104臺北市中山區中山里中山北路二段65巷2弄3號",
      googleMapsUrl: "",
      lat: "",
      lng: "",
      note: "",
    } as never);

    expect(item.place?.lat).toBeUndefined();
    expect(item.place?.lng).toBeUndefined();
    expect(item.place?.googleMapsUrl).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E5%9C%A8%E5%AE%B6%E8%A1%8C%E6%97%85+104%E8%87%BA%E5%8C%97%E5%B8%82%E4%B8%AD%E5%B1%B1%E5%8D%80%E4%B8%AD%E5%B1%B1%E9%87%8C%E4%B8%AD%E5%B1%B1%E5%8C%97%E8%B7%AF%E4%BA%8C%E6%AE%B565%E5%B7%B72%E5%BC%843%E8%99%9F",
    );
  });

  it("rejects missing address and Google Maps URL", () => {
    const result = itineraryItemSchema.safeParse({
      title: "Taipei 101",
      type: "attraction",
      startTime: "10:00",
      endTime: "11:00",
      address: "",
      googleMapsUrl: "",
      note: "",
    });

    expect(result.success).toBe(false);
  });

  it("calculates overnight stay minutes when the end time is after midnight", () => {
    const item = createItineraryItemFromInput({
      title: "午餐",
      type: "food",
      startTime: "23:30",
      endTime: "01:00",
      address: "",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=%E5%8D%88%E9%A4%90",
      note: "",
    });

    expect(item.stayMinutes).toBe(90);
    expect(item.place?.averageStayMinutes).toBe(90);
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

  it("preserves import metadata when editing an AI imported item", () => {
    const item = createItineraryItemFromInput(
      {
        title: "午餐",
        type: "food",
        startTime: "12:00",
        endTime: "13:00",
        address: "台北市大安區",
        googleMapsUrl: "",
        note: "",
      },
      {
        id: "item-ai-lunch",
        placeId: "place-ai-lunch",
        source: "ai_import",
        importBatchId: "ai-batch",
        type: "food",
        title: "AI 午餐",
        startTime: "12:00",
        endTime: "13:00",
        stayMinutes: 60,
      },
    );

    expect(item.source).toBe("ai_import");
    expect(item.importBatchId).toBe("ai-batch");
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

  it("falls back to a searchable Google Maps URL when a short link cannot be resolved", () => {
    const item = createItineraryItemFromInput({
      title: "龍山寺",
      type: "attraction",
      startTime: "20:00",
      endTime: "21:30",
      address: "",
      googleMapsUrl: "https://maps.app.goo.gl/LbNj3DxJd5tXCLabA",
      note: "",
    });

    expect(item.place?.googleMapsUrl).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E9%BE%8D%E5%B1%B1%E5%AF%BA",
    );
  });
});
