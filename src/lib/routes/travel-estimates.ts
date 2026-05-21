import type { ItineraryItem, TravelMethod } from "@/types/trip";

export type RouteEstimateStop = {
  id: string;
  title: string;
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

export function getRouteEstimateStop(item: ItineraryItem): RouteEstimateStop {
  return {
    id: item.id,
    title: item.title,
    address: item.place?.address,
    googlePlaceId: item.place?.googlePlaceId,
    googleMapsUrl: item.place?.googleMapsUrl,
    lat: item.place?.lat,
    lng: item.place?.lng,
  };
}

export function getWaypointQuery(stop: RouteEstimateStop) {
  return [stop.title, stop.address].filter(Boolean).join(" ").trim();
}

export function createRoutesApiWaypoint(stop: RouteEstimateStop) {
  if (stop.googlePlaceId) {
    return {
      placeId: stop.googlePlaceId,
    };
  }

  if (typeof stop.lat === "number" && typeof stop.lng === "number") {
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
  return Boolean(stop.googlePlaceId || (typeof stop.lat === "number" && typeof stop.lng === "number"));
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
