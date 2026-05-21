import { describe, expect, it } from "vitest";
import {
  createRoutesApiWaypoint,
  formatDistanceMeters,
  getRouteEstimateStop,
  getRouteEstimateStops,
  getWaypointQuery,
  hasExactRouteLocation,
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

  it("requires exact route locations before estimating", () => {
    expect(hasExactRouteLocation({ id: "a", title: "Cafe", address: "Taipei" })).toBe(false);
    expect(hasExactRouteLocation({ id: "a", title: "Cafe", googlePlaceId: "place-123" })).toBe(true);
    expect(hasExactRouteLocation({ id: "a", title: "Cafe", lat: 25.05, lng: 121.52 })).toBe(true);
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

  it("adds nearby address context for linked stops without exact coordinates", () => {
    const stops = getRouteEstimateStops([
      {
        id: "item-museum",
        placeId: "place-museum",
        type: "attraction",
        title: "台北當代藝術館",
        startTime: "13:10",
        endTime: "15:00",
        stayMinutes: 110,
        place: {
          id: "place-museum",
          name: "台北當代藝術館",
          category: "attraction",
          address: "台北市大同區長安西路39號",
          lat: 25.05049,
          lng: 121.51897,
        },
      },
      {
        id: "item-temple",
        placeId: "place-temple",
        type: "attraction",
        title: "城隍廟",
        startTime: "15:30",
        endTime: "17:00",
        stayMinutes: 90,
        place: {
          id: "place-temple",
          name: "城隍廟",
          category: "attraction",
          googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=%E5%9F%8E%E9%9A%8D%E5%BB%9F",
        },
      },
    ] satisfies ItineraryItem[]);

    expect(stops[1]).toMatchObject({
      address: "城隍廟 台北市大同區",
      googleMapsUrl: "https://www.google.com/maps/search/?api=1&query=%E5%9F%8E%E9%9A%8D%E5%BB%9F+%E5%8F%B0%E5%8C%97%E5%B8%82%E5%A4%A7%E5%90%8C%E5%8D%80",
    });
  });
});
