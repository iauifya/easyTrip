import type { ItineraryItem, TravelMethod } from "@/types/trip";
import { createGoogleMapsSearchUrl } from "@/lib/places/google-maps";

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

export function getRouteEstimateStops(items: ItineraryItem[]) {
  const stops = items.map(getRouteEstimateStop);

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
