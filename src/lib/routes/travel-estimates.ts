import type { ItineraryItem, TravelMethod } from "@/types/trip";
import { createGoogleMapsSearchUrl } from "@/lib/places/google-maps";

export type RouteEstimateStop = {
  id: string;
  title: string;
  startTime?: string;
  endTime?: string;
  departureTime?: string;
  address?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  lat?: number;
  lng?: number;
};

export type RouteTravelEstimate = {
  id: string;
  fromItemId: string;
  toItemId: string;
  method: TravelMethod;
  estimatedMinutes: number;
  distanceMeters?: number;
  source: "google_routes" | "unavailable";
};

export type UnavailableRouteLeg = {
  id: string;
  fromItemId: string;
  toItemId: string;
  reason: "invalid_place" | "route_unavailable";
};

export type RouteEstimatesResponse = {
  estimates: RouteTravelEstimate[];
  unavailableLegs?: UnavailableRouteLeg[];
  status: "ok" | "missing_key" | "insufficient_stops" | "partial" | "invalid_place";
  message?: string;
};

export const routeTravelMethods = ["walk", "transit", "drive"] as const satisfies readonly TravelMethod[];

export function getRouteTravelMethodLabel(method: TravelMethod) {
  if (method === "transit") {
    return "大眾運輸";
  }

  if (method === "drive" || method === "taxi") {
    return "開車";
  }

  return "步行";
}

export function getRouteTravelMethodIcon(method: TravelMethod) {
  if (method === "transit") {
    return "捷";
  }

  if (method === "drive" || method === "taxi") {
    return "車";
  }

  return "走";
}

function createDepartureTime(date: string | undefined, time: string | undefined) {
  if (!date || !time) {
    return undefined;
  }

  return `${date}T${time}:00+08:00`;
}

export function getRouteEstimateStop(item: ItineraryItem, date?: string): RouteEstimateStop {
  return {
    id: item.id,
    title: item.title,
    startTime: item.startTime,
    endTime: item.endTime,
    departureTime: createDepartureTime(date, item.endTime),
    address: item.place?.address,
    googlePlaceId: item.place?.googlePlaceId,
    googleMapsUrl: item.place?.googleMapsUrl,
    lat: item.place?.lat,
    lng: item.place?.lng,
  };
}

function getAddressContext(stops: RouteEstimateStop[], index: number) {
  for (let offset = 1; offset < stops.length; offset += 1) {
    const nearbyStops = [stops[index - offset], stops[index + offset]].filter(Boolean);

    for (const stop of nearbyStops) {
      const district = stop.address?.match(/[\u4e00-\u9fa5]{2,3}市[\u4e00-\u9fa5]{1,4}區/)?.[0];
      const city = stop.address?.match(/[\u4e00-\u9fa5]{2,3}[市縣]/)?.[0];

      if (district) {
        return district;
      }

      if (city) {
        return city;
      }
    }
  }

  return undefined;
}

export function getRouteEstimateStops(items: ItineraryItem[], date?: string) {
  const stops = items.map((item) => getRouteEstimateStop(item, date));

  return stops.map((stop, index) => {
    if (hasExactRouteLocation(stop) || !stop.googleMapsUrl || !stop.title.trim()) {
      return stop;
    }

    const addressContext = getAddressContext(stops, index);

    if (!addressContext || getWaypointQuery(stop).includes(addressContext)) {
      return stop;
    }

    const contextualQuery = `${stop.title} ${addressContext}`;

    return {
      ...stop,
      address: stop.address ?? contextualQuery,
      googleMapsUrl: createGoogleMapsSearchUrl(contextualQuery),
    };
  });
}

export function getWaypointQuery(stop: RouteEstimateStop) {
  return [stop.title, stop.address].filter(Boolean).join(" ").trim();
}

function hasUsableCoordinates(lat: number | undefined, lng: number | undefined) {
  return typeof lat === "number" && typeof lng === "number" && !(lat === 0 && lng === 0);
}

export function createRoutesApiWaypoint(stop: RouteEstimateStop) {
  if (stop.googlePlaceId) {
    return {
      placeId: stop.googlePlaceId,
    };
  }

  if (hasUsableCoordinates(stop.lat, stop.lng)) {
    return {
      location: {
        latLng: {
          latitude: stop.lat,
          longitude: stop.lng,
        },
      },
    };
  }

  return {
    address: getWaypointQuery(stop),
  };
}

export function hasExactRouteLocation(stop: RouteEstimateStop) {
  return Boolean(stop.googlePlaceId || hasUsableCoordinates(stop.lat, stop.lng));
}

export function parseGoogleDurationSeconds(duration: string | undefined) {
  if (!duration) {
    return undefined;
  }

  const seconds = Number(duration.replace(/s$/, ""));

  if (!Number.isFinite(seconds)) {
    return undefined;
  }

  return seconds;
}

export function secondsToRoundedMinutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

export function formatDistanceMeters(distanceMeters: number | undefined) {
  if (typeof distanceMeters !== "number") {
    return "距離待估";
  }

  if (distanceMeters < 1000) {
    return `${distanceMeters} m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km`;
}
