export type GoogleMapsPreview = {
  displayQuery: string;
  googlePlaceId?: string;
  googleMapsUrl: string;
  mapPreviewUrl: string;
  source: "google_maps_url" | "place_search";
};

export type ResolvedGoogleMapsPlace = {
  displayName?: string;
  formattedAddress?: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
  googleMapsUrl: string;
};

const googleMapsHosts = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);

function getSafeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

export function isGoogleMapsUrl(value: string) {
  const url = getSafeUrl(value.trim());

  if (!url) {
    return false;
  }

  return googleMapsHosts.has(url.hostname.toLowerCase());
}

function decodePlacePath(pathname: string) {
  const placeMatch = pathname.match(/\/maps\/place\/([^/]+)/);

  if (!placeMatch?.[1]) {
    return "";
  }

  return decodeURIComponent(placeMatch[1]).replace(/\+/g, " ").trim();
}

function parseCoordinate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const coordinate = Number(value);

  return Number.isFinite(coordinate) ? coordinate : undefined;
}

function parseCoordinates(url: URL) {
  const atMatch = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const dataMatch = url.href.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const lat = parseCoordinate(dataMatch?.[1] ?? atMatch?.[1]);
  const lng = parseCoordinate(dataMatch?.[2] ?? atMatch?.[2]);

  if (typeof lat !== "number" || typeof lng !== "number") {
    return {};
  }

  return { lat, lng };
}

export function parseGoogleMapsUrl(value: string) {
  const url = getSafeUrl(value.trim());

  if (!url || !isGoogleMapsUrl(value)) {
    return undefined;
  }

  const googlePlaceId =
    url.searchParams.get("query_place_id") ??
    url.searchParams.get("place_id") ??
    undefined;
  const placeName = decodePlacePath(url.pathname);
  const query =
    url.searchParams.get("query") ??
    url.searchParams.get("q") ??
    placeName ??
    "";

  return {
    googlePlaceId,
    placeName,
    query: query.trim(),
    ...parseCoordinates(url),
    url: url.toString(),
  };
}

export function getGoogleMapsPlaceName(value: string) {
  const parsedUrl = parseGoogleMapsUrl(value);

  return parsedUrl?.placeName || undefined;
}

export function createGoogleMapsSearchUrl(query: string, googlePlaceId?: string) {
  const params = new URLSearchParams({
    api: "1",
    query,
  });

  if (googlePlaceId) {
    params.set("query_place_id", googlePlaceId);
  }

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function createGoogleMapsEmbedUrl(query: string, googlePlaceId?: string) {
  const params = new URLSearchParams({
    q: query,
    output: "embed",
  });

  if (googlePlaceId) {
    params.set("query_place_id", googlePlaceId);
  }

  return `https://www.google.com/maps?${params.toString()}`;
}

export function createGoogleMapsPreview(input: {
  title: string;
  address?: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  lat?: number;
  lng?: number;
}): GoogleMapsPreview | undefined {
  const trimmedTitle = input.title.trim();
  const trimmedAddress = input.address?.trim() ?? "";
  const trimmedUrl = input.googleMapsUrl?.trim() ?? "";
  const parsedUrl = trimmedUrl ? parseGoogleMapsUrl(trimmedUrl) : undefined;
  const coordinateQuery =
    typeof input.lat === "number" && typeof input.lng === "number"
      ? `${input.lat},${input.lng}`
      : "";
  const displayQuery =
    parsedUrl?.query || [trimmedTitle, trimmedAddress].filter(Boolean).join(" ");
  const previewQuery = coordinateQuery || displayQuery;
  const googlePlaceId = input.googlePlaceId || parsedUrl?.googlePlaceId;

  if (!previewQuery) {
    return undefined;
  }

  return {
    displayQuery,
    googlePlaceId,
    googleMapsUrl: parsedUrl?.url ?? createGoogleMapsSearchUrl(previewQuery, googlePlaceId),
    mapPreviewUrl: createGoogleMapsEmbedUrl(previewQuery, googlePlaceId),
    source: parsedUrl ? "google_maps_url" : "place_search",
  };
}
