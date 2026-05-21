import { NextResponse } from "next/server";
import { getGoogleMapsApiKey } from "@/lib/google-maps-platform";
import { isGoogleMapsUrl, parseGoogleMapsUrl } from "@/lib/places/google-maps";
import {
  createRoutesApiWaypoint,
  getWaypointQuery,
  hasExactRouteLocation,
  parseGoogleDurationSeconds,
  secondsToRoundedMinutes,
  type RouteEstimateStop,
  type RouteEstimatesResponse,
  type RouteTravelEstimate,
} from "@/lib/routes/travel-estimates";

type RoutesApiResponse = {
  routes?: Array<{
    duration?: string;
    distanceMeters?: number;
  }>;
};

type TextSearchResponse = {
  places?: Array<{
    id?: string;
    formattedAddress?: string;
    location?: {
      latitude?: number;
      longitude?: number;
    };
  }>;
};

type EstimateRequestBody = {
  stops?: RouteEstimateStop[];
};

function hasUsableStop(stop: RouteEstimateStop) {
  return Boolean(
    stop.googlePlaceId ||
      (typeof stop.lat === "number" && typeof stop.lng === "number") ||
      stop.googleMapsUrl ||
      stop.title.trim() ||
      stop.address?.trim(),
  );
}

async function resolveGoogleMapsStop(stop: RouteEstimateStop): Promise<RouteEstimateStop> {
  if (
    stop.googlePlaceId ||
    (typeof stop.lat === "number" && typeof stop.lng === "number") ||
    !stop.googleMapsUrl ||
    !isGoogleMapsUrl(stop.googleMapsUrl)
  ) {
    return stop;
  }

  try {
    const response = await fetch(stop.googleMapsUrl, {
      redirect: "follow",
      cache: "no-store",
    });
    const parsedUrl = parseGoogleMapsUrl(response.url || stop.googleMapsUrl);
    const resolvedName = parsedUrl?.placeName || parsedUrl?.query || getWaypointQuery(stop);
    const place = resolvedName ? await searchPlaceForRoute(resolvedName, parsedUrl) : undefined;

    return {
      ...stop,
      address: place?.address ?? stop.address,
      googlePlaceId: place?.googlePlaceId ?? parsedUrl?.googlePlaceId ?? stop.googlePlaceId,
      lat: place?.lat ?? parsedUrl?.lat ?? stop.lat,
      lng: place?.lng ?? parsedUrl?.lng ?? stop.lng,
    };
  } catch {
    return stop;
  }
}

async function searchPlaceForRoute(
  query: string,
  locationBias?: { lat?: number; lng?: number },
): Promise<Pick<RouteEstimateStop, "address" | "googlePlaceId" | "lat" | "lng"> | undefined> {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return undefined;
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.formattedAddress,places.location",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "zh-TW",
      ...(typeof locationBias?.lat === "number" && typeof locationBias.lng === "number"
        ? {
            locationBias: {
              circle: {
                center: {
                  latitude: locationBias.lat,
                  longitude: locationBias.lng,
                },
                radius: 120,
              },
            },
          }
        : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as TextSearchResponse;
  const place = payload.places?.[0];

  if (!place) {
    return undefined;
  }

  return {
    address: place.formattedAddress,
    googlePlaceId: place.id,
    lat: place.location?.latitude,
    lng: place.location?.longitude,
  };
}

async function estimateLeg(
  from: RouteEstimateStop,
  to: RouteEstimateStop,
  apiKey: string,
): Promise<RouteTravelEstimate | undefined> {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: createRoutesApiWaypoint(from),
      destination: createRoutesApiWaypoint(to),
      travelMode: "WALK",
      languageCode: "zh-TW",
      units: "METRIC",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as RoutesApiResponse;
  const route = payload.routes?.[0];
  const seconds = parseGoogleDurationSeconds(route?.duration);

  if (!route || typeof seconds !== "number") {
    return undefined;
  }

  return {
    id: `${from.id}-${to.id}`,
    fromItemId: from.id,
    toItemId: to.id,
    method: "walk",
    estimatedMinutes: secondsToRoundedMinutes(seconds),
    distanceMeters: route.distanceMeters,
    source: "google_routes",
  };
}

function createUnavailableLeg(
  from: RouteEstimateStop,
  to: RouteEstimateStop,
  reason: "invalid_place" | "route_unavailable",
) {
  return {
    id: `${from.id}-${to.id}`,
    fromItemId: from.id,
    toItemId: to.id,
    reason,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as EstimateRequestBody | undefined;
  const stops = body?.stops?.filter(hasUsableStop) ?? [];

  if (stops.length < 2) {
    return NextResponse.json({
      estimates: [],
      status: "insufficient_stops",
      message: "至少需要兩個地點才能估算移動時間。",
    } satisfies RouteEstimatesResponse);
  }

  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return NextResponse.json({
      estimates: [],
      status: "missing_key",
      message: "未設定 GOOGLE_MAPS_API_KEY，暫時顯示緩衝時間。",
    } satisfies RouteEstimatesResponse);
  }

  const resolvedStops = await Promise.all(stops.map(resolveGoogleMapsStop));
  const legResults = await Promise.all(
    resolvedStops.slice(0, -1).map(async (stop, index) => {
      const nextStop = resolvedStops[index + 1];

      if (!hasExactRouteLocation(stop) || !hasExactRouteLocation(nextStop)) {
        return {
          estimate: undefined,
          unavailableLeg: createUnavailableLeg(stop, nextStop, "invalid_place"),
        };
      }

      const estimate = await estimateLeg(stop, nextStop, apiKey);

      return {
        estimate,
        unavailableLeg: estimate ? undefined : createUnavailableLeg(stop, nextStop, "route_unavailable"),
      };
    }),
  );
  const estimates = legResults
    .map((result) => result.estimate)
    .filter((estimate): estimate is RouteTravelEstimate => Boolean(estimate));
  const unavailableLegs = legResults.flatMap((result) => (result.unavailableLeg ? [result.unavailableLeg] : []));
  const hasInvalidPlace = unavailableLegs.some((leg) => leg.reason === "invalid_place");

  return NextResponse.json({
    estimates,
    unavailableLegs,
    status: estimates.length === resolvedStops.length - 1 ? "ok" : hasInvalidPlace ? "invalid_place" : "partial",
    message:
      estimates.length === resolvedStops.length - 1
        ? undefined
        : hasInvalidPlace
          ? "地址有誤，無法估算。請改用正確的 Google Maps 連結。"
          : "部分路段暫時無法估算，請確認地點名稱或 Google Maps 連結。",
  } satisfies RouteEstimatesResponse);
}
