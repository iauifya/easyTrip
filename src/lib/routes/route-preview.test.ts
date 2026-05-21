import { describe, expect, it } from "vitest";
import { buildGoogleMapsDirectionsUrl, createRoutePreviewModel } from "./route-preview";
import type { ItineraryItem } from "@/types/trip";

function item(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    id: "item-1",
    placeId: "place-1",
    type: "attraction",
    title: "Stop",
    startTime: "10:00",
    endTime: "11:00",
    stayMinutes: 60,
    ...overrides,
  };
}

describe("route preview helpers", () => {
  it("builds Google Maps directions URLs with waypoints", () => {
    const url = buildGoogleMapsDirectionsUrl([
      item({ id: "a", title: "Hotel" }),
      item({ id: "b", title: "Cafe" }),
      item({ id: "c", title: "Museum" }),
    ]);

    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=Hotel&destination=Museum&travelmode=walking&waypoints=Cafe",
    );
  });

  it("creates stops and legs from itinerary items", () => {
    const model = createRoutePreviewModel([
      item({
        id: "a",
        title: "Hotel",
        endTime: "10:30",
        place: {
          id: "place-a",
          name: "Hotel",
          category: "hotel",
          googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Hotel",
        },
      }),
      item({
        id: "b",
        title: "Cafe",
        startTime: "10:45",
        place: {
          id: "place-b",
          name: "Cafe",
          category: "food",
        },
      }),
    ]);

    expect(model.linkedStopCount).toBe(1);
    expect(model.stops[0]).toMatchObject({
      title: "Hotel",
      locationLabel: "已連結 Google Maps",
      hasGoogleMapsUrl: true,
    });
    expect(model.legs[0]).toMatchObject({
      gapMinutes: 15,
      status: "needs_place",
    });
  });

  it("marks linked legs as pending until an estimate is returned", () => {
    const items = [
      item({
        id: "a",
        title: "Hotel",
        place: {
          id: "place-a",
          name: "Hotel",
          category: "hotel",
          googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Hotel",
        },
      }),
      item({
        id: "b",
        title: "Cafe",
        place: {
          id: "place-b",
          name: "Cafe",
          category: "food",
          googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=Cafe",
        },
      }),
    ];

    expect(createRoutePreviewModel(items).legs[0]).toMatchObject({
      status: "pending",
      estimatedMinutes: undefined,
    });
    expect(
      createRoutePreviewModel(items, [
        {
          id: "a-b",
          fromItemId: "a",
          toItemId: "b",
          method: "walk",
          estimatedMinutes: 8,
          source: "google_routes",
        },
      ]).legs[0],
    ).toMatchObject({
      status: "estimated",
      estimatedMinutes: 8,
    });
  });
});
