export type TripPace = "relaxed" | "normal" | "packed";

export type ItineraryItemType =
  | "attraction"
  | "food"
  | "hotel"
  | "transport"
  | "shopping"
  | "rest";

export type TravelMethod = "walk" | "transit" | "taxi";

export type Trip = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  pace: TripPace;
  days: TripDay[];
};

export type TripDay = {
  id: string;
  date: string;
  items: ItineraryItem[];
};

export type ItineraryItem = {
  id: string;
  placeId: string;
  place?: Place;
  type: ItineraryItemType;
  title: string;
  startTime: string;
  endTime: string;
  stayMinutes: number;
  note?: string;
};

export type Place = {
  id: string;
  name: string;
  category: ItineraryItemType;
  address?: string;
  lat?: number;
  lng?: number;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  mapPreviewUrl?: string;
  source?: "manual" | "google_maps_url" | "google_place" | "place_search";
  averageStayMinutes?: number;
  note?: string;
};

export type TravelSegment = {
  id: string;
  fromPlaceId: string;
  toPlaceId: string;
  method: TravelMethod;
  estimatedMinutes: number;
  bufferMinutes: number;
};
