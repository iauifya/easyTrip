import { timeToMinutes } from "@/lib/time/itinerary";
import { createGoogleMapsPlaceUrl } from "@/lib/places/google-maps";
import {
  routeTravelMethods,
  type RouteTravelEstimate,
  type UnavailableRouteLeg,
} from "@/lib/routes/travel-estimates";
import type { ItineraryItem } from "@/types/trip";

export type RoutePreviewStop = {
  id: string;
  title: string;
  timeLabel: string;
  locationLabel: string;
  hasGoogleMapsUrl: boolean;
  lat?: number;
  lng?: number;
  mapPosition: {
    x: number;
    y: number;
    source: "coordinates" | "timeline";
  };
};

export type RoutePreviewLeg = {
  id: string;
  fromTitle: string;
  toTitle: string;
  gapMinutes: number;
  estimatedMinutes?: number;
  distanceMeters?: number;
  estimates: RouteTravelEstimate[];
  bestEstimate?: RouteTravelEstimate;
  isTight: boolean;
  status: "estimated" | "pending" | "needs_place" | "invalid_place";
};

export type RoutePreviewModel = {
  stops: RoutePreviewStop[];
  legs: RoutePreviewLeg[];
  linkedStopCount: number;
  projectedStopCount: number;
  estimatedLegCount: number;
  totalTravelMinutes: number;
  tightLegCount: number;
  googleMapsDirectionsUrl?: string;
};

const fallbackTimelinePositions = [
  { x: 14, y: 20 },
  { x: 54, y: 24 },
  { x: 36, y: 58 },
  { x: 70, y: 78 },
  { x: 22, y: 82 },
  { x: 82, y: 44 },
];

function hasCoordinates(item: ItineraryItem) {
  return (
    typeof item.place?.lat === "number" &&
    typeof item.place.lng === "number" &&
    !(item.place.lat === 0 && item.place.lng === 0)
  );
}

function getFallbackTimelinePosition(index: number, count: number) {
  const position = fallbackTimelinePositions[index];

  if (position) {
    return position;
  }

  const progress = count <= 1 ? 0.5 : index / (count - 1);

  return {
    x: 18 + (index % 2) * 64,
    y: 16 + progress * 68,
  };
}

function projectStops(items: ItineraryItem[]) {
  const coordinateItems = items.filter(hasCoordinates);
  const hasUsableMap = coordinateItems.length >= 2;

  if (!hasUsableMap) {
    return items.map((item, index) => ({
      id: item.id,
      ...getFallbackTimelinePosition(index, items.length),
      source: "timeline" as const,
    }));
  }

  const averageLat =
    coordinateItems.reduce((sum, item) => sum + (item.place?.lat ?? 0), 0) / coordinateItems.length;
  const longitudeScale = Math.cos((averageLat * Math.PI) / 180);
  const projected = coordinateItems.map((item) => ({
    id: item.id,
    xMeters: (item.place?.lng ?? 0) * longitudeScale,
    yMeters: item.place?.lat ?? 0,
  }));
  const minX = Math.min(...projected.map((point) => point.xMeters));
  const maxX = Math.max(...projected.map((point) => point.xMeters));
  const minY = Math.min(...projected.map((point) => point.yMeters));
  const maxY = Math.max(...projected.map((point) => point.yMeters));
  const xRange = maxX - minX;
  const yRange = maxY - minY;
  const range = Math.max(xRange, yRange, 0.0001);
  const xPadding = 12 + ((range - xRange) / range) * 38;
  const yPadding = 12 + ((range - yRange) / range) * 38;
  const xUsable = 100 - xPadding * 2;
  const yUsable = 100 - yPadding * 2;
  const positionById = new Map(
    projected.map((point) => [
      point.id,
      {
        x: xPadding + ((point.xMeters - minX) / range) * xUsable,
        y: yPadding + ((maxY - point.yMeters) / range) * yUsable,
        source: "coordinates" as const,
      },
    ]),
  );

  return items.map((item, index) => ({
    id: item.id,
    ...(positionById.get(item.id) ?? {
      ...getFallbackTimelinePosition(index, items.length),
      source: "timeline" as const,
    }),
  }));
}

function getPlaceQuery(item: ItineraryItem) {
  return [item.title, item.place?.address].filter(Boolean).join(" ").trim();
}

function getGoogleMapsUrl(item: ItineraryItem) {
  if (!hasRouteLocationInput(item)) {
    return undefined;
  }

  return createGoogleMapsPlaceUrl({
    title: item.title,
    address: item.place?.address,
    googlePlaceId: item.place?.googlePlaceId,
    googleMapsUrl: item.place?.googleMapsUrl,
    lat: item.place?.lat,
    lng: item.place?.lng,
  });
}

function hasRouteLocationInput(item: ItineraryItem) {
  return Boolean(
    item.place?.googlePlaceId ||
      hasCoordinates(item) ||
      item.place?.googleMapsUrl ||
      item.place?.address,
  );
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
  const estimatesByLegId = new Map<string, RouteTravelEstimate[]>();

  for (const estimate of estimates) {
    const legEstimates = estimatesByLegId.get(estimate.id) ?? [];

    legEstimates.push(estimate);
    estimatesByLegId.set(estimate.id, legEstimates);
  }

  const unavailableLegIds = new Set(unavailableLegs.map((leg) => leg.id));
  const positionByItemId = new Map(projectStops(items).map((position) => [position.id, position]));
  const stops = items.map<RoutePreviewStop>((item) => ({
    id: item.id,
    title: item.title,
    timeLabel: `${item.startTime} - ${item.endTime}`,
    locationLabel: getLocationLabel(item),
    hasGoogleMapsUrl: Boolean(getGoogleMapsUrl(item)),
    lat: item.place?.lat,
    lng: item.place?.lng,
    mapPosition: positionByItemId.get(item.id) ?? {
      ...getFallbackTimelinePosition(0, items.length),
      source: "timeline",
    },
  }));

  const legs = items.slice(0, -1).map<RoutePreviewLeg>((item, index) => {
    const nextItem = items[index + 1];
    const id = `${item.id}-${nextItem.id}`;
    const legEstimates = [...(estimatesByLegId.get(id) ?? [])].sort(
      (first, second) =>
        routeTravelMethods.indexOf(first.method as (typeof routeTravelMethods)[number]) -
        routeTravelMethods.indexOf(second.method as (typeof routeTravelMethods)[number]),
    );
    const bestEstimate = legEstimates.reduce<RouteTravelEstimate | undefined>(
      (best, estimate) =>
        !best || estimate.estimatedMinutes < best.estimatedMinutes ? estimate : best,
      undefined,
    );
    const gapMinutes = Math.max(0, timeToMinutes(nextItem.startTime) - timeToMinutes(item.endTime));
    const estimatedMinutes = bestEstimate?.estimatedMinutes;
    const isTight = typeof estimatedMinutes === "number" && estimatedMinutes + 10 > gapMinutes;

    return {
      id,
      fromTitle: item.title,
      toTitle: nextItem.title,
      gapMinutes,
      estimatedMinutes,
      distanceMeters: bestEstimate?.distanceMeters,
      estimates: legEstimates,
      bestEstimate,
      isTight,
      status: legEstimates.length > 0
        ? "estimated"
        : unavailableLegIds.has(id)
          ? "invalid_place"
          : hasRouteLocationInput(item) && hasRouteLocationInput(nextItem)
            ? "pending"
            : "needs_place",
    };
  });

  return {
    stops,
    legs,
    linkedStopCount: stops.filter((stop) => stop.hasGoogleMapsUrl).length,
    projectedStopCount: stops.filter((stop) => stop.mapPosition.source === "coordinates").length,
    estimatedLegCount: legs.filter((leg) => leg.status === "estimated").length,
    totalTravelMinutes: legs.reduce((sum, leg) => sum + (leg.bestEstimate?.estimatedMinutes ?? 0), 0),
    tightLegCount: legs.filter((leg) => leg.isTight).length,
    googleMapsDirectionsUrl: buildGoogleMapsDirectionsUrl(items),
  };
}
