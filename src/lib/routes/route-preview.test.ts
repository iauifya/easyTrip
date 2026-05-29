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

  it("projects stop positions from coordinates with north up and east right", () => {
    const model = createRoutePreviewModel([
      item({
        id: "station",
        title: "Taipei Main Station",
        place: {
          id: "place-station",
          name: "Taipei Main Station",
          category: "transport",
          lat: 25.04776,
          lng: 121.51706,
        },
      }),
      item({
        id: "fika",
        title: "Fika Fika Cafe",
        place: {
          id: "place-fika",
          name: "Fika Fika Cafe",
          category: "food",
          lat: 25.05096,
          lng: 121.53423,
        },
      }),
      item({
        id: "moca",
        title: "Museum of Contemporary Art Taipei",
        place: {
          id: "place-moca",
          name: "Museum of Contemporary Art Taipei",
          category: "attraction",
          lat: 25.05049,
          lng: 121.51897,
        },
      }),
      item({
        id: "ningxia",
        title: "Ningxia Night Market",
        place: {
          id: "place-ningxia",
          name: "Ningxia Night Market",
          category: "food",
          lat: 25.05673,
          lng: 121.51539,
        },
      }),
    ]);
    const byId = new Map(model.stops.map((stop) => [stop.id, stop.mapPosition]));
    const station = byId.get("station")!;
    const fika = byId.get("fika")!;
    const moca = byId.get("moca")!;
    const ningxia = byId.get("ningxia")!;

    expect(model.projectedStopCount).toBe(4);
    expect(fika.x).toBeGreaterThan(moca.x);
    expect(ningxia.y).toBeLessThan(moca.y);
    expect(station.x).toBeLessThan(fika.x);
    expect(station.y).toBeGreaterThan(fika.y);
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

  it("selects the fastest travel method and flags tight gaps", () => {
    const items = [
      item({
        id: "a",
        title: "Hotel",
        endTime: "10:00",
        place: {
          id: "place-a",
          name: "Hotel",
          category: "hotel",
          address: "Taipei",
        },
      }),
      item({
        id: "b",
        title: "Cafe",
        startTime: "10:18",
        place: {
          id: "place-b",
          name: "Cafe",
          category: "food",
          address: "Taipei",
        },
      }),
    ];

    const model = createRoutePreviewModel(items, [
      {
        id: "a-b",
        fromItemId: "a",
        toItemId: "b",
        method: "walk",
        estimatedMinutes: 22,
        source: "google_routes",
      },
      {
        id: "a-b",
        fromItemId: "a",
        toItemId: "b",
        method: "drive",
        estimatedMinutes: 9,
        source: "google_routes",
      },
    ]);

    expect(model.legs[0]).toMatchObject({
      estimatedMinutes: 9,
      isTight: true,
    });
    expect(model.legs[0].bestEstimate?.method).toBe("drive");
    expect(model.totalTravelMinutes).toBe(9);
    expect(model.tightLegCount).toBe(1);
  });

  it("treats complete addresses as routable pending stops", () => {
    const model = createRoutePreviewModel([
      item({
        id: "a",
        title: "Taipei 101",
        place: {
          id: "place-a",
          name: "Taipei 101",
          category: "attraction",
          address: "台北市信義區信義路五段7號",
        },
      }),
      item({
        id: "b",
        title: "Elephant Mountain",
        place: {
          id: "place-b",
          name: "Elephant Mountain",
          category: "attraction",
          address: "台北市信義區信義路五段150巷",
        },
      }),
    ]);

    expect(model.linkedStopCount).toBe(2);
    expect(model.legs[0]).toMatchObject({
      status: "pending",
    });
  });

  it("marks unavailable legs as invalid place errors", () => {
    const items = [
      item({ id: "a", title: "Hotel" }),
      item({ id: "b", title: "Cafe" }),
    ];

    expect(
      createRoutePreviewModel(items, [], [
        {
          id: "a-b",
          fromItemId: "a",
          toItemId: "b",
          reason: "invalid_place",
        },
      ]).legs[0],
    ).toMatchObject({
      status: "invalid_place",
    });
  });
});
