import { timeToMinutes } from "@/lib/time/itinerary";
import type { RouteTravelEstimate, UnavailableRouteLeg } from "@/lib/routes/travel-estimates";
import type { ItineraryItem } from "@/types/trip";

export type RoutePreviewStop = {
  id: string;
  title: string;
  timeLabel: string;
  locationLabel: string;
  hasGoogleMapsUrl: boolean;
};

export type RoutePreviewLeg = {
  id: string;
  fromTitle: string;
  toTitle: string;
  gapMinutes: number;
  estimatedMinutes?: number;
  distanceMeters?: number;
  status: "estimated" | "pending" | "needs_place" | "invalid_place";
};

export type RoutePreviewModel = {
  stops: RoutePreviewStop[];
  legs: RoutePreviewLeg[];
  linkedStopCount: number;
  googleMapsDirectionsUrl?: string;
};

function getPlaceQuery(item: ItineraryItem) {
  return [item.title, item.place?.address].filter(Boolean).join(" ").trim();
}

function getLocationLabel(item: ItineraryItem) {
  if (item.place?.address) {
    return item.place.address;
  }

  if (item.place?.googleMapsUrl) {
    return "已連結 Google Maps";
  }

  return "尚未設定地點資訊";
}

export function buildGoogleMapsDirectionsUrl(items: ItineraryItem[]) {
  const routeItems = items.filter((item) => item.place?.googleMapsUrl || getPlaceQuery(item));

  if (routeItems.length < 2) {
    return undefined;
  }

  const [origin, ...restItems] = routeItems;
  const destination = restItems.at(-1);

  if (!destination) {
    return undefined;
  }

  const waypoints = restItems.slice(0, -1).map(getPlaceQuery).filter(Boolean);
  const params = new URLSearchParams({
    api: "1",
    origin: getPlaceQuery(origin),
    destination: getPlaceQuery(destination),
    travelmode: "walking",
  });

  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function createRoutePreviewModel(
  items: ItineraryItem[],
  estimates: RouteTravelEstimate[] = [],
  unavailableLegs: UnavailableRouteLeg[] = [],
): RoutePreviewModel {
  const estimateByLegId = new Map(estimates.map((estimate) => [estimate.id, estimate]));
  const unavailableLegIds = new Set(unavailableLegs.map((leg) => leg.id));
  const stops = items.map<RoutePreviewStop>((item) => ({
    id: item.id,
    title: item.title,
    timeLabel: `${item.startTime} - ${item.endTime}`,
    locationLabel: getLocationLabel(item),
    hasGoogleMapsUrl: Boolean(item.place?.googleMapsUrl),
  }));

  const legs = items.slice(0, -1).map<RoutePreviewLeg>((item, index) => {
    const nextItem = items[index + 1];
    const id = `${item.id}-${nextItem.id}`;
    const estimate = estimateByLegId.get(id);
    const gapMinutes = Math.max(0, timeToMinutes(nextItem.startTime) - timeToMinutes(item.endTime));

    return {
      id,
      fromTitle: item.title,
      toTitle: nextItem.title,
      gapMinutes,
      estimatedMinutes: estimate?.estimatedMinutes,
      distanceMeters: estimate?.distanceMeters,
      status: estimate
        ? "estimated"
        : unavailableLegIds.has(id)
          ? "invalid_place"
          : item.place?.googleMapsUrl && nextItem.place?.googleMapsUrl
            ? "pending"
            : "needs_place",
    };
  });

  return {
    stops,
    legs,
    linkedStopCount: stops.filter((stop) => stop.hasGoogleMapsUrl).length,
    googleMapsDirectionsUrl: buildGoogleMapsDirectionsUrl(items),
  };
}
