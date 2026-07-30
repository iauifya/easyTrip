import { create } from "zustand";
import type { ItineraryItem, Trip } from "@/types/trip";
import { sampleTrip, sampleTrips } from "@/data/sample-trip";
import { clearTrips, loadTrips, saveTrips } from "@/lib/storage/trip-storage";
import {
  loadCloudTrip,
  restoreCloudItineraryItem,
  saveCloudItineraryItem,
  softDeleteCloudItineraryItem,
  saveCloudTripStructure,
} from "@/lib/collaboration/cloud-trips";

type TripStore = {
  trips: Trip[];
  selectedTripId: string;
  selectedDayId: string;
  hasHydrated: boolean;
  cloudError: string;
  hydrateTrips: () => void;
  hydrateCloudTrip: (tripId: string) => Promise<boolean>;
  clearCloudError: () => void;
  setSelectedTripId: (tripId: string) => void;
  setSelectedDayId: (dayId: string) => void;
  addTrip: (trip: Trip) => void;
  updateTrip: (trip: Trip) => void;
  deleteTrip: (tripId: string) => void;
  addItineraryItem: (tripId: string, dayId: string, item: ItineraryItem) => void;
  addItineraryItems: (tripId: string, dayId: string, items: ItineraryItem[]) => void;
  updateItineraryItem: (tripId: string, dayId: string, item: ItineraryItem) => void;
  deleteItineraryItem: (tripId: string, dayId: string, itemId: string) => void;
  restoreItineraryItem: (tripId: string, dayId: string, item: ItineraryItem) => void;
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
  cloudError: "",
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
  hydrateCloudTrip: async (tripId) => {
    try {
      const cloudTrip = await loadCloudTrip(tripId);
      if (!cloudTrip) return false;
      const trips = get().trips.some((trip) => trip.id === tripId)
        ? get().trips.map((trip) => (trip.id === tripId ? cloudTrip : trip))
        : [...get().trips, cloudTrip];
      saveTrips(trips);
      set({ trips, selectedTripId: tripId, selectedDayId: cloudTrip.days[0]?.id ?? "", hasHydrated: true, cloudError: "" });
      return true;
    } catch (error) {
      set({ cloudError: error instanceof Error ? error.message : "雲端行程載入失敗。" });
      return false;
    }
  },
  clearCloudError: () => set({ cloudError: "" }),
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
    const cloudTrip = trip.cloudVersion ? { ...trip, cloudVersion: trip.cloudVersion + 1 } : trip;
    const trips = get().trips.map((item) => (item.id === trip.id ? cloudTrip : item));
    const selectedDayExists = trip.days.some((day) => day.id === get().selectedDayId);

    saveTrips(trips);
    set({
      trips,
      selectedDayId:
        trip.id === get().selectedTripId && !selectedDayExists
          ? getFirstDayId(trip)
          : get().selectedDayId,
    });
    if (trip.cloudVersion) void saveCloudTripStructure(cloudTrip, trip.cloudVersion).catch((error) => set({ cloudError: error instanceof Error ? error.message : "雲端旅程更新失敗。" }));
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
    const cloudItem = { ...item, version: item.version ?? 1 };
    const trips = get().trips.map((trip) =>
      trip.id === tripId
        ? {
            ...trip,
            days: trip.days.map((day) =>
              day.id === dayId ? { ...day, items: [...day.items, cloudItem] } : day,
            ),
          }
        : trip,
    );

    updateTripsAndPersist(set, trips, { selectedTripId: tripId, selectedDayId: dayId });
    void saveCloudItineraryItem(tripId, dayId, cloudItem).catch((error) => set({ cloudError: error instanceof Error ? error.message : "雲端新增失敗。" }));
  },
  addItineraryItems: (tripId, dayId, items) => {
    if (items.length === 0) {
      return;
    }

    const cloudItems = items.map((item) => ({ ...item, version: item.version ?? 1 }));
    const trips = get().trips.map((trip) =>
      trip.id === tripId
        ? {
            ...trip,
            days: trip.days.map((day) =>
              day.id === dayId ? { ...day, items: [...day.items, ...cloudItems] } : day,
            ),
          }
        : trip,
    );

    updateTripsAndPersist(set, trips, { selectedTripId: tripId, selectedDayId: dayId });
    cloudItems.forEach((item) => void saveCloudItineraryItem(tripId, dayId, item).catch((error) => set({ cloudError: error instanceof Error ? error.message : "雲端匯入失敗。" })));
  },
  updateItineraryItem: (tripId, dayId, item) => {
    const previous = get().trips.find((trip) => trip.id === tripId)?.days.find((day) => day.id === dayId)?.items.find((current) => current.id === item.id);
    const cloudItem = { ...item, version: previous?.version ? previous.version + 1 : 1 };
    const trips = get().trips.map((trip) =>
      trip.id === tripId
        ? {
            ...trip,
            days: trip.days.map((day) =>
              day.id === dayId
                ? {
                    ...day,
                    items: day.items.map((currentItem) =>
                      currentItem.id === item.id ? cloudItem : currentItem,
                    ),
                  }
                : day,
            ),
          }
        : trip,
    );

    updateTripsAndPersist(set, trips, { selectedTripId: tripId, selectedDayId: dayId });
    void saveCloudItineraryItem(tripId, dayId, cloudItem, previous?.version).catch((error) => set({ cloudError: error instanceof Error ? error.message : "雲端更新衝突，請重新整理。" }));
  },
  deleteItineraryItem: (tripId, dayId, itemId) => {
    const deletedItem = get().trips.find((trip) => trip.id === tripId)?.days.find((day) => day.id === dayId)?.items.find((item) => item.id === itemId);
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
    if (deletedItem) void softDeleteCloudItineraryItem(deletedItem).catch((error) => set({ cloudError: error instanceof Error ? error.message : "雲端刪除衝突，請重新整理。" }));
  },
  restoreItineraryItem: (tripId, dayId, item) => {
    const restored = { ...item, version: item.version ? item.version + 2 : item.version };
    const trips = get().trips.map((trip) => trip.id === tripId ? { ...trip, days: trip.days.map((day) => day.id === dayId ? { ...day, items: [...day.items, restored] } : day) } : trip);
    updateTripsAndPersist(set, trips, { selectedTripId: tripId, selectedDayId: dayId });
    void restoreCloudItineraryItem(item).catch((error) => set({ cloudError: error instanceof Error ? error.message : "復原失敗。" }));
  },
}));
