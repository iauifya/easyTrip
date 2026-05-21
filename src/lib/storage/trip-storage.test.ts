import { afterEach, describe, expect, it } from "vitest";
import { sampleTrips } from "@/data/sample-trip";
import { clearTrips, loadTrips, saveTrips } from "./trip-storage";

const storageKey = "easytrip.trips.v1";

function removeWindow() {
  Reflect.deleteProperty(globalThis, "window");
}

function installStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));

  const localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage },
  });

  return store;
}

describe("trip storage adapter", () => {
  afterEach(() => {
    removeWindow();
  });

  it("falls back to sample trips when storage is unavailable", () => {
    removeWindow();

    expect(loadTrips()).toEqual(sampleTrips);
  });

  it("loads persisted trips from localStorage", () => {
    installStorage({
      [storageKey]: JSON.stringify([sampleTrips[0]]),
    });

    expect(loadTrips()).toEqual([sampleTrips[0]]);
  });

  it("hydrates legacy itinerary items with place data", () => {
    installStorage({
      [storageKey]: JSON.stringify([
        {
          ...sampleTrips[0],
          days: [
            {
              id: "day-legacy",
              date: "2026-06-13",
              items: [
                {
                  id: "item-legacy",
                  placeId: "place-legacy",
                  type: "food",
                  title: "巷口午餐",
                  startTime: "12:00",
                  endTime: "13:00",
                  stayMinutes: 60,
                },
              ],
            },
          ],
        },
      ]),
    });

    expect(loadTrips()[0].days[0].items[0].place).toMatchObject({
      id: "place-legacy",
      name: "巷口午餐",
      category: "food",
      source: "manual",
      averageStayMinutes: 60,
    });
  });

  it("refreshes old sample templates with exact route locations", () => {
    installStorage({
      [storageKey]: JSON.stringify([
        {
          ...sampleTrips[0],
          days: [
            {
              id: "day-1",
              date: "2026-06-13",
              items: [
                {
                  id: "item-hotel",
                  placeId: "place-hotel",
                  type: "hotel",
                  title: "飯店寄放行李",
                  startTime: "10:00",
                  endTime: "10:30",
                  stayMinutes: 30,
                  place: {
                    id: "place-hotel",
                    name: "飯店寄放行李",
                    category: "hotel",
                    address: "台北市中山區中山北路二段",
                  },
                },
              ],
            },
          ],
        },
      ]),
    });

    expect(loadTrips()[0]).toEqual(sampleTrips[0]);
  });

  it("falls back to sample trips when persisted data is malformed", () => {
    installStorage({
      [storageKey]: "{bad json",
    });

    expect(loadTrips()).toEqual(sampleTrips);
  });

  it("filters invalid stored entries and keeps valid trips", () => {
    installStorage({
      [storageKey]: JSON.stringify([{ id: "bad" }, sampleTrips[0]]),
    });

    expect(loadTrips()).toEqual([sampleTrips[0]]);
  });

  it("saves trips as JSON", () => {
    const store = installStorage();

    saveTrips([sampleTrips[0]]);

    expect(store.get(storageKey)).toBe(JSON.stringify([sampleTrips[0]]));
  });

  it("clears persisted trips", () => {
    const store = installStorage({
      [storageKey]: JSON.stringify([sampleTrips[0]]),
    });

    clearTrips();

    expect(store.has(storageKey)).toBe(false);
  });
});
