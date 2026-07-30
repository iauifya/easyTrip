import { NextResponse } from "next/server";
import { getGoogleMapsApiKey } from "@/lib/google-maps-platform";

type GooglePlacesResponse = { places?: Array<{ id?: string; displayName?: { text?: string }; formattedAddress?: string; googleMapsUri?: string; location?: { latitude?: number; longitude?: number }; primaryType?: string }> };

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 2) return NextResponse.json({ places: [] });
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return NextResponse.json({ places: [{ title: query, unverified: true }], message: "未設定 Google Maps API，將以輸入名稱建立提案。" });

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.location,places.primaryType",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "zh-TW", maxResultCount: 5 }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ places: [{ title: query, unverified: true }] });
    const payload = await response.json() as GooglePlacesResponse;
    return NextResponse.json({ places: (payload.places ?? []).slice(0, 5).map((place) => ({
      title: place.displayName?.text ?? query, address: place.formattedAddress,
      googlePlaceId: place.id, googleMapsUrl: place.googleMapsUri,
      lat: place.location?.latitude, lng: place.location?.longitude,
    })) });
  } catch {
    return NextResponse.json({ places: [{ title: query, unverified: true }], message: "地點搜尋暫時無法使用。" });
  }
}
