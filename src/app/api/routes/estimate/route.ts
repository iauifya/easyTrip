import { NextResponse } from "next/server";
import { getGoogleMapsApiKey } from "@/lib/google-maps-platform";
import { isGoogleMapsUrl, parseGoogleMapsUrl } from "@/lib/places/google-maps";
import {
  createRoutesApiWaypoint,
  getWaypointQuery,
  hasExactRouteLocation,
  parseGoogleDurationSeconds,
  routeTravelMethods,
  secondsToRoundedMinutes,
  type RouteEstimateStop,
  type RouteEstimatesResponse,
  type RouteTravelEstimate,
} from "@/lib/routes/travel-estimates";
import type { TravelMethod } from "@/types/trip";

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

const googleTravelModeByMethod: Record<Exclude<TravelMethod, "taxi">, "WALK" | "TRANSIT" | "DRIVE"> = {
  walk: "WALK",
  transit: "TRANSIT",
  drive: "DRIVE",
};

type LocationBias = {
  lat?: number;
  lng?: number;
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

function getLocationBias(value: LocationBias): LocationBias | undefined {
  if (typeof value.lat === "number" && typeof value.lng === "number" && !(value.lat === 0 && value.lng === 0)) {
    return {
      lat: value.lat,
      lng: value.lng,
    };
  }

  return undefined;
}

function findNearbyLocationBias(stops: RouteEstimateStop[], index: number) {
  for (let offset = 1; offset < stops.length; offset += 1) {
    const previous = stops[index - offset];
    const next = stops[index + offset];
    const previousBias = previous ? getLocationBias(previous) : undefined;
    const nextBias = next ? getLocationBias(next) : undefined;

    if (previousBias) {
      return previousBias;
    }

    if (nextBias) {
      return nextBias;
    }
  }

  return undefined;
}

function findNearbyAddressContext(stops: RouteEstimateStop[], index: number) {
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

function hasRouteResolvableLocation(stop: RouteEstimateStop) {
  return hasExactRouteLocation(stop) || Boolean(stop.address?.trim() || (stop.googleMapsUrl && getWaypointQuery(stop)));
}

async function resolveRedirectedGoogleMapsUrl(url: string) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
    });

    return response.url || url;
  } catch {
    return url;
  }
}

async function resolveGoogleMapsStop(
  stop: RouteEstimateStop,
  locationBias?: LocationBias,
  addressContext?: string,
): Promise<RouteEstimateStop> {
  if (hasExactRouteLocation(stop)) {
    return stop;
  }

  const resolvedUrl =
    stop.googleMapsUrl && isGoogleMapsUrl(stop.googleMapsUrl)
      ? await resolveRedirectedGoogleMapsUrl(stop.googleMapsUrl)
      : undefined;
  const parsedUrl = resolvedUrl ? parseGoogleMapsUrl(resolvedUrl) : undefined;
  const parsedLocationBias = getLocationBias(parsedUrl ?? stop);
  const resolvedName = parsedUrl?.placeName || parsedUrl?.query || stop.title || getWaypointQuery(stop);
  const contextualQuery =
    resolvedName && addressContext && !resolvedName.includes(addressContext)
      ? `${resolvedName} ${addressContext}`
      : resolvedName;
  const place = contextualQuery
    ? await searchPlaceForRoute(contextualQuery, parsedLocationBias ?? locationBias)
    : undefined;

  if (!place && !parsedUrl) {
    return {
      ...stop,
      address: stop.address || contextualQuery || undefined,
    };
  }

  return {
    ...stop,
    address: place?.address ?? (addressContext ? contextualQuery : stop.address) ?? stop.address ?? contextualQuery,
    googlePlaceId: place?.googlePlaceId ?? parsedUrl?.googlePlaceId ?? stop.googlePlaceId,
    lat: place?.lat ?? parsedUrl?.lat ?? stop.lat,
    lng: place?.lng ?? parsedUrl?.lng ?? stop.lng,
  };
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
                radius: 3500,
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

function getDepartureTimeForMethod(stop: RouteEstimateStop, method: TravelMethod) {
  if (!stop.departureTime) {
    return undefined;
  }

  const departure = new Date(stop.departureTime);

  if (!Number.isFinite(departure.getTime())) {
    return undefined;
  }

  const now = Date.now();

  if (method === "transit") {
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const hundredDaysLater = now + 100 * 24 * 60 * 60 * 1000;

    if (departure.getTime() < sevenDaysAgo || departure.getTime() > hundredDaysLater) {
      return undefined;
    }
  }

  if (method === "drive" && departure.getTime() < now) {
    return undefined;
  }

  return stop.departureTime;
}

async function estimateLeg(
  from: RouteEstimateStop,
  to: RouteEstimateStop,
  apiKey: string,
  method: Exclude<TravelMethod, "taxi">,
): Promise<RouteTravelEstimate | undefined> {
  const departureTime = getDepartureTimeForMethod(from, method);
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
      travelMode: googleTravelModeByMethod[method],
      ...(departureTime ? { departureTime } : {}),
      ...(method === "drive"
        ? {
            routingPreference: "TRAFFIC_AWARE_OPTIMAL",
            trafficModel: "BEST_GUESS",
          }
        : {}),
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
    method,
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

  const initiallyResolvedStops = await Promise.all(stops.map((stop) => resolveGoogleMapsStop(stop)));
  const resolvedStops = await Promise.all(
    initiallyResolvedStops.map((stop, index) =>
      hasExactRouteLocation(stop)
        ? stop
        : resolveGoogleMapsStop(
            stop,
            findNearbyLocationBias(initiallyResolvedStops, index),
            findNearbyAddressContext(initiallyResolvedStops, index),
          ),
    ),
  );
  const legResults = await Promise.all(
    resolvedStops.slice(0, -1).map(async (stop, index) => {
      const nextStop = resolvedStops[index + 1];

      if (!hasRouteResolvableLocation(stop) || !hasRouteResolvableLocation(nextStop)) {
        return {
          estimates: [],
          unavailableLeg: createUnavailableLeg(stop, nextStop, "invalid_place"),
        };
      }

      const estimates = (
        await Promise.all(
          routeTravelMethods.map((method) => estimateLeg(stop, nextStop, apiKey, method)),
        )
      ).filter((estimate): estimate is RouteTravelEstimate => Boolean(estimate));

      return {
        estimates,
        unavailableLeg: estimates.length > 0 ? undefined : createUnavailableLeg(stop, nextStop, "route_unavailable"),
      };
    }),
  );
  const estimates = legResults.flatMap((result) => result.estimates);
  const unavailableLegs = legResults.flatMap((result) => (result.unavailableLeg ? [result.unavailableLeg] : []));
  const hasInvalidPlace = unavailableLegs.some((leg) => leg.reason === "invalid_place");
  const estimatedLegIds = new Set(estimates.map((estimate) => estimate.id));

  return NextResponse.json({
    estimates,
    unavailableLegs,
    status: estimatedLegIds.size === resolvedStops.length - 1 ? "ok" : hasInvalidPlace ? "invalid_place" : "partial",
    message:
      estimatedLegIds.size === resolvedStops.length - 1
        ? undefined
        : hasInvalidPlace
          ? "地址有誤，無法估算。請改用正確的 Google Maps 連結。"
          : "部分路段暫時無法估算，請確認地點名稱或 Google Maps 連結。",
  } satisfies RouteEstimatesResponse);
}
