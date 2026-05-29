import { describe, expect, it } from "vitest";
import {
  createGoogleMapsPlaceUrl,
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

  it("builds searchable Google Maps URLs for address-only places", () => {
    expect(
      createGoogleMapsPlaceUrl({
        title: "Taipei 101",
        address: "台北市信義區信義路五段7號",
      }),
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=Taipei+101+%E5%8F%B0%E5%8C%97%E5%B8%82%E4%BF%A1%E7%BE%A9%E5%8D%80%E4%BF%A1%E7%BE%A9%E8%B7%AF%E4%BA%94%E6%AE%B57%E8%99%9F",
    );
  });

  it("falls back to address search when a stored Google Maps URL points at 0,0", () => {
    expect(
      createGoogleMapsPlaceUrl({
        title: "在家行旅",
        address: "104臺北市中山區中山里中山北路二段65巷2弄3號",
        googleMapsUrl: "https://www.google.com/maps/place/0%C2%B000'00.0%22N+0%C2%B000'00.0%22E/@0,0,17z",
        lat: 0,
        lng: 0,
      }),
    ).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E5%9C%A8%E5%AE%B6%E8%A1%8C%E6%97%85+104%E8%87%BA%E5%8C%97%E5%B8%82%E4%B8%AD%E5%B1%B1%E5%8D%80%E4%B8%AD%E5%B1%B1%E9%87%8C%E4%B8%AD%E5%B1%B1%E5%8C%97%E8%B7%AF%E4%BA%8C%E6%AE%B565%E5%B7%B72%E5%BC%843%E8%99%9F",
    );
  });

  it("ignores 0,0 Google Maps URLs in previews when address data exists", () => {
    const preview = createGoogleMapsPreview({
      title: "在家行旅",
      address: "104臺北市中山區中山里中山北路二段65巷2弄3號",
      googleMapsUrl: "https://www.google.com/maps/place/0%C2%B000'00.0%22N+0%C2%B000'00.0%22E/@0,0,17z",
      lat: 0,
      lng: 0,
    });

    expect(preview).toMatchObject({
      displayQuery: "在家行旅 104臺北市中山區中山里中山北路二段65巷2弄3號",
      source: "place_search",
    });
    expect(preview?.mapPreviewUrl).toContain(
      "%E5%9C%A8%E5%AE%B6%E8%A1%8C%E6%97%85+104%E8%87%BA%E5%8C%97%E5%B8%82",
    );
  });
});
