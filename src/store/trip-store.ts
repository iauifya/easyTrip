import { create } from "zustand";
import type { ItineraryItem, Trip } from "@/types/trip";
import { sampleTrip, sampleTrips } from "@/data/sample-trip";
import { clearTrips, loadTrips, saveTrips } from "@/lib/storage/trip-storage";

type TripStore = {
  trips: Trip[];
  selectedTripId: string;
  selectedDayId: string;
  hasHydrated: boolean;
  hydrateTrips: () => void;
  setSelectedTripId: (tripId: string) => void;
  setSelectedDayId: (dayId: string) => void;
  addTrip: (trip: Trip) => void;
  updateTrip: (trip: Trip) => void;
  deleteTrip: (tripId: string) => void;
  addItineraryItem: (tripId: string, dayId: string, item: ItineraryItem) => void;
  updateItineraryItem: (tripId: string, dayId: string, item: ItineraryItem) => void;
  deleteItineraryItem: (tripId: string, dayId: string, itemId: string) => void;
  resetTrips: () => void;
};

function getFirstDayId(trip: Trip | undefined) {
  return trip?.days[0]?.id ?? "";
}

function updateTripsAndPersist(
  set: (state: Partial<TripStore>) => void,
  trips: Trip[],
  selected?: Partial<Pick<TripStore, "selectedTripId" | "selectedDayId">>,
) {
  saveTrips(trips);
  set({ trips, ...selected });
}

export const useTripStore = create<TripStore>((set, get) => ({
  trips: sampleTrips,
  selectedTripId: sampleTrip.id,
  selectedDayId: getFirstDayId(sampleTrip),
  hasHydrated: false,
  hydrateTrips: () => {
    const trips = loadTrips();
    const currentSelectedTrip = trips.find((trip) => trip.id === get().selectedTripId);
    const selectedTrip = currentSelectedTrip ?? trips[0] ?? sampleTrip;

    set({
      trips,
      selectedTripId: selectedTrip.id,
      selectedDayId: getFirstDayId(selectedTrip),
      hasHydrated: true,
    });
  },
  setSelectedTripId: (tripId) => {
    const trip = get().trips.find((item) => item.id === tripId);

    set({
      selectedTripId: tripId,
      selectedDayId: getFirstDayId(trip),
    });
  },
  setSelectedDayId: (dayId) => set({ selectedDayId: dayId }),
  addTrip: (trip) => {
    const trips = [...get().trips, trip];

    saveTrips(trips);
    set({
      trips,
      selectedTripId: trip.id,
      selectedDayId: getFirstDayId(trip),
    });
  },
  updateTrip: (trip) => {
    const trips = get().trips.map((item) => (item.id === trip.id ? trip : item));
    const selectedDayExists = trip.days.some((day) => day.id === get().selectedDayId);

    saveTrips(trips);
    set({
      trips,
      selectedDayId:
        trip.id === get().selectedTripId && !selectedDayExists
          ? getFirstDayId(trip)
          : get().selectedDayId,
    });
  },
  deleteTrip: (tripId) => {
    const trips = get().trips.filter((trip) => trip.id !== tripId);
    const nextTrips = trips.length > 0 ? trips : sampleTrips;
    const selectedTrip =
      nextTrips.find((trip) => trip.id === get().selectedTripId) ?? nextTrips[0];

    saveTrips(nextTrips);
    set({
      trips: nextTrips,
      selectedTripId: selectedTrip.id,
      selectedDayId: getFirstDayId(selectedTrip),
    });
  },
  resetTrips: () => {
    clearTrips();
    set({
      trips: sampleTrips,
      selectedTripId: sampleTrip.id,
      selectedDayId: getFirstDayId(sampleTrip),
      hasHydrated: true,
    });
  },
  addItineraryItem: (tripId, dayId, item) => {
    const trips = get().trips.map((trip) =>
      trip.id === tripId
        ? {
            ...trip,
            days: trip.days.map((day) =>
              day.id === dayId ? { ...day, items: [...day.items, item] } : day,
            ),
          }
        : trip,
    );

    updateTripsAndPersist(set, trips, { selectedTripId: tripId, selectedDayId: dayId });
  },
  updateItineraryItem: (tripId, dayId, item) => {
    const trips = get().trips.map((trip) =>
      trip.id === tripId
        ? {
            ...trip,
            days: trip.days.map((day) =>
              day.id === dayId
                ? {
                    ...day,
                    items: day.items.map((currentItem) =>
                      currentItem.id === item.id ? item : currentItem,
                    ),
                  }
                : day,
            ),
          }
        : trip,
    );

    updateTripsAndPersist(set, trips, { selectedTripId: tripId, selectedDayId: dayId });
  },
  deleteItineraryItem: (tripId, dayId, itemId) => {
    const trips = get().trips.map((trip) =>
      trip.id === tripId
        ? {
            ...trip,
            days: trip.days.map((day) =>
              day.id === dayId
                ? { ...day, items: day.items.filter((item) => item.id !== itemId) }
                : day,
            ),
          }
        : trip,
    );

    updateTripsAndPersist(set, trips, { selectedTripId: tripId, selectedDayId: dayId });
  },
}));
