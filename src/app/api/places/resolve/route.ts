import { NextResponse } from "next/server";
import { getGoogleMapsApiKey } from "@/lib/google-maps-platform";
import {
  isGoogleMapsUrl,
  parseGoogleMapsUrl,
  type ResolvedGoogleMapsPlace,
} from "@/lib/places/google-maps";

type TextSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: {
      text?: string;
    };
    formattedAddress?: string;
    googleMapsUri?: string;
    location?: {
      latitude?: number;
      longitude?: number;
    };
  }>;
};

async function resolveRedirectUrl(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
  });

  return response.url || url;
}

async function searchPlace(query: string, locationBias?: { lat?: number; lng?: number }) {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey || !query) {
    return undefined;
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.location",
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
    displayName: place.displayName?.text,
    formattedAddress: place.formattedAddress,
    googlePlaceId: place.id,
    googleMapsUrl: place.googleMapsUri,
    lat: place.location?.latitude,
    lng: place.location?.longitude,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => undefined)) as { url?: string } | undefined;
  const rawUrl = body?.url?.trim();

  if (!rawUrl || !isGoogleMapsUrl(rawUrl)) {
    return NextResponse.json({ error: "Invalid Google Maps URL" }, { status: 400 });
  }

  try {
    const resolvedUrl = await resolveRedirectUrl(rawUrl);
    const parsedUrl = parseGoogleMapsUrl(resolvedUrl);
    const query = parsedUrl?.placeName || parsedUrl?.query;
    const place = query ? await searchPlace(query, parsedUrl) : undefined;
    const response: ResolvedGoogleMapsPlace = {
      displayName: place?.displayName ?? parsedUrl?.placeName,
      formattedAddress: place?.formattedAddress,
      googlePlaceId: place?.googlePlaceId ?? parsedUrl?.googlePlaceId,
      lat: place?.lat ?? parsedUrl?.lat,
      lng: place?.lng ?? parsedUrl?.lng,
      googleMapsUrl: place?.googleMapsUrl ?? resolvedUrl,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Failed to resolve Google Maps URL" }, { status: 502 });
  }
}
