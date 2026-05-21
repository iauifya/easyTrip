import { sampleTrips } from "@/data/sample-trip";
import type { ItineraryItem, Trip, TripDay } from "@/types/trip";

const TRIPS_STORAGE_KEY = "easytrip.trips.v1";
const LEGACY_SAMPLE_ITEM_IDS = new Set([
  "item-hotel",
  "item-cafe",
  "item-museum",
  "item-night-market",
  "item-train",
  "item-park",
  "item-lunch",
]);

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isTrip(value: unknown): value is Trip {
  if (!value || typeof value !== "object") {
    return false;
  }

  const trip = value as Partial<Trip>;

  return (
    typeof trip.id === "string" &&
    typeof trip.title === "string" &&
    typeof trip.destination === "string" &&
    Array.isArray(trip.days)
  );
}

function normalizeItineraryItem(item: ItineraryItem): ItineraryItem {
  const placeId = item.placeId || `place-${item.id}`;

  return {
    ...item,
    placeId,
    place: item.place ?? {
      id: placeId,
      name: item.title,
      category: item.type,
      source: "manual",
      averageStayMinutes: item.stayMinutes,
    },
  };
}

function normalizeTripDay(day: TripDay): TripDay {
  return {
    ...day,
    items: Array.isArray(day.items) ? day.items.map(normalizeItineraryItem) : [],
  };
}

function normalizeTrip(trip: Trip): Trip {
  return {
    ...trip,
    days: trip.days.map(normalizeTripDay),
  };
}

function hasExactRouteTemplate(trip: Trip) {
  return trip.days.every((day) =>
    day.items.every((item) =>
      Boolean(
        item.place?.googlePlaceId ||
          (typeof item.place?.lat === "number" && typeof item.place?.lng === "number"),
      ),
    ),
  );
}

function shouldRefreshSampleTemplate(trip: Trip) {
  return trip.days.some((day) =>
    day.items.some(
      (item) =>
        LEGACY_SAMPLE_ITEM_IDS.has(item.id) &&
        !item.place?.googlePlaceId &&
        typeof item.place?.lat !== "number",
    ),
  );
}

function normalizeTrips(value: unknown): Trip[] {
  if (!Array.isArray(value)) {
    return sampleTrips;
  }

  const trips = value
    .filter(isTrip)
    .map(normalizeTrip)
    .map((trip) => {
      const matchingSample = sampleTrips.find((sampleTrip) => sampleTrip.id === trip.id);

      if (matchingSample && !hasExactRouteTemplate(trip) && shouldRefreshSampleTemplate(trip)) {
        return matchingSample;
      }

      return trip;
    });

  return trips.length > 0 ? trips : sampleTrips;
}

export function loadTrips() {
  if (!canUseStorage()) {
    return sampleTrips;
  }

  try {
    const rawTrips = window.localStorage.getItem(TRIPS_STORAGE_KEY);

    if (!rawTrips) {
      return sampleTrips;
    }

    return normalizeTrips(JSON.parse(rawTrips));
  } catch {
    return sampleTrips;
  }
}

export function saveTrips(trips: Trip[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
  } catch {
    // Storage can fail in private browsing or when the quota is full.
  }
}

export function clearTrips() {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(TRIPS_STORAGE_KEY);
  } catch {
    // Storage can fail in private browsing or when browser settings block it.
  }
}
