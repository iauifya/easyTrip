import { describe, expect, it } from "vitest";
import {
  createRoutesApiWaypoint,
  formatDistanceMeters,
  getRouteEstimateStop,
  getWaypointQuery,
  parseGoogleDurationSeconds,
  secondsToRoundedMinutes,
} from "./travel-estimates";
import type { ItineraryItem } from "@/types/trip";

describe("travel estimate helpers", () => {
  it("creates place id waypoints when available", () => {
    expect(
      createRoutesApiWaypoint({
        id: "a",
        title: "Taipei 101",
        googlePlaceId: "place-123",
      }),
    ).toEqual({
      placeId: "place-123",
    });
  });

  it("falls back to address waypoints", () => {
    const stop = {
      id: "a",
      title: "Taipei 101",
      address: "Xinyi District",
    };

    expect(getWaypointQuery(stop)).toBe("Taipei 101 Xinyi District");
    expect(createRoutesApiWaypoint(stop)).toEqual({
      address: "Taipei 101 Xinyi District",
    });
  });

  it("uses coordinates before address waypoints", () => {
    expect(
      createRoutesApiWaypoint({
        id: "a",
        title: "Cafe",
        address: "Some address",
        lat: 25.05,
        lng: 121.52,
      }),
    ).toEqual({
      location: {
        latLng: {
          latitude: 25.05,
          longitude: 121.52,
        },
      },
    });
  });

  it("parses Google duration values", () => {
    expect(parseGoogleDurationSeconds("360s")).toBe(360);
    expect(parseGoogleDurationSeconds("91.5s")).toBe(91.5);
    expect(secondsToRoundedMinutes(91.5)).toBe(2);
  });

  it("formats route distances", () => {
    expect(formatDistanceMeters(850)).toBe("850 m");
    expect(formatDistanceMeters(1420)).toBe("1.4 km");
  });

  it("keeps Google Maps URLs on route estimate stops", () => {
    const stop = getRouteEstimateStop({
      id: "item-a",
      placeId: "place-a",
      type: "food",
      title: "Cafe",
      startTime: "10:00",
      endTime: "11:00",
      stayMinutes: 60,
      place: {
        id: "place-a",
        name: "Cafe",
        category: "food",
        googleMapsUrl: "https://maps.app.goo.gl/example",
        lat: 25.05,
        lng: 121.52,
      },
    } satisfies ItineraryItem);

    expect(stop.googleMapsUrl).toBe("https://maps.app.goo.gl/example");
    expect(stop.lat).toBe(25.05);
  });
});
