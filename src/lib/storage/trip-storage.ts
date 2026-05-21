import { sampleTrips } from "@/data/sample-trip";
import type { ItineraryItem, Trip, TripDay } from "@/types/trip";

const TRIPS_STORAGE_KEY = "easytrip.trips.v1";

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

function normalizeTrips(value: unknown): Trip[] {
  if (!Array.isArray(value)) {
    return sampleTrips;
  }

  const trips = value.filter(isTrip).map(normalizeTrip);

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
