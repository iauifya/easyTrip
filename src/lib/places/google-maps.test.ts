import { describe, expect, it } from "vitest";
import {
  createGoogleMapsPreview,
  createGoogleMapsSearchUrl,
  getGoogleMapsPlaceName,
  isGoogleMapsUrl,
  parseGoogleMapsUrl,
} from "./google-maps";

describe("google maps helpers", () => {
  it("accepts Google Maps URL hosts only", () => {
    expect(isGoogleMapsUrl("https://www.google.com/maps/search/?api=1&query=Taipei")).toBe(true);
    expect(isGoogleMapsUrl("https://maps.app.goo.gl/example")).toBe(true);
    expect(isGoogleMapsUrl("https://example.com/maps/search/?query=Taipei")).toBe(false);
  });

  it("extracts query and place id from search URLs", () => {
    const parsed = parseGoogleMapsUrl(
      "https://www.google.com/maps/search/?api=1&query=Taipei%20101&query_place_id=abc123",
    );

    expect(parsed).toMatchObject({
      googlePlaceId: "abc123",
      placeName: "",
      query: "Taipei 101",
    });
  });

  it("extracts a place name from Google Maps place URLs", () => {
    expect(
      getGoogleMapsPlaceName(
        "https://www.google.com/maps/place/Taipei+101/@25.033968,121.564468,17z",
      ),
    ).toBe("Taipei 101");
  });

  it("extracts coordinates from Google Maps URLs", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/Taipei+101/@25.033968,121.564468,17z",
      ),
    ).toMatchObject({
      lat: 25.033968,
      lng: 121.564468,
    });
  });

  it("prefers exact place coordinates over viewport center coordinates", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/Cafe/@25.050000,121.510000,17z/data=!3d25.060000!4d121.520000",
      ),
    ).toMatchObject({
      lat: 25.06,
      lng: 121.52,
    });
  });

  it("builds place search previews when no URL is pasted", () => {
    const preview = createGoogleMapsPreview({
      title: "Taipei 101",
      address: "Xinyi District Taipei",
    });

    expect(preview).toMatchObject({
      displayQuery: "Taipei 101 Xinyi District Taipei",
      source: "place_search",
    });
    expect(preview?.googleMapsUrl).toBe(
      createGoogleMapsSearchUrl("Taipei 101 Xinyi District Taipei"),
    );
    expect(preview?.mapPreviewUrl).toContain("output=embed");
  });
});
