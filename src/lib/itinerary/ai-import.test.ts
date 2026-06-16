import { describe, expect, it } from "vitest";
import {
  createAiItineraryPrompt,
  getAiItineraryImportDayAssignments,
  parseAiItineraryImport,
} from "./ai-import";
import type { Trip, TripDay } from "@/types/trip";

const payload = {
  version: 1,
  items: [
    {
      title: "Taipei 101",
      address: "No. 7, Section 5, Xinyi Road, Taipei",
      startTime: "10:00",
      endTime: "11:30",
      type: "attraction",
      note: "Book tickets ahead.",
    },
    {
      title: "Yongkang Beef Noodles",
      address: "No. 17, Lane 31, Jinshan South Road, Taipei",
      startTime: "12:00",
      endTime: "13:00",
      type: "food",
    },
  ],
};

describe("AI itinerary import helpers", () => {
  it("parses pure JSON and creates itinerary items", () => {
    const result = parseAiItineraryImport(JSON.stringify(payload));

    expect(result.error).toBeUndefined();
    expect(result.invalidRows).toHaveLength(0);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: "Taipei 101",
      type: "attraction",
      startTime: "10:00",
      endTime: "11:30",
      stayMinutes: 90,
      note: "Book tickets ahead.",
      place: {
        address: "No. 7, Section 5, Xinyi Road, Taipei",
        source: "place_search",
      },
    });
  });

  it("parses JSON wrapped in a markdown code block", () => {
    const result = parseAiItineraryImport(`\`\`\`json
${JSON.stringify(payload, null, 2)}
\`\`\``);

    expect(result.error).toBeUndefined();
    expect(result.items.map((item) => item.title)).toEqual([
      "Taipei 101",
      "Yongkang Beef Noodles",
    ]);
  });

  it("rejects malformed payloads", () => {
    const result = parseAiItineraryImport(JSON.stringify({ version: 1, stops: [] }));

    expect(result.items).toHaveLength(0);
    expect(result.error).toBe("JSON 必須包含 version: 1 與 items 陣列。");
  });

  it("marks invalid rows and imports only valid rows", () => {
    const result = parseAiItineraryImport(
      JSON.stringify({
        version: 1,
        items: [
          payload.items[0],
          {
            title: "Bad stop",
            address: "",
            startTime: "10am",
            endTime: "11:00",
            type: "museum",
          },
          {
            title: "Same time",
            address: "Taipei Main Station",
            startTime: "14:00",
            endTime: "14:00",
            type: "transport",
          },
        ],
      }),
    );

    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Taipei 101");
    expect(result.invalidRows).toHaveLength(2);
    expect(result.invalidRows[0]).toMatchObject({ index: 1 });
    expect(result.invalidRows[1]).toMatchObject({ index: 2 });
  });

  it("does not guess natural language output", () => {
    const result = parseAiItineraryImport("Here is your itinerary: Taipei 101 at 10.");

    expect(result.items).toHaveLength(0);
    expect(result.error).toBe("貼上的內容不是有效的 JSON。");
  });

  it("creates a prompt with trip context and the allowed type enum", () => {
    const trip: Trip = {
      id: "trip",
      title: "Taipei Weekend",
      destination: "Taipei",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      pace: "normal",
      days: [],
    };
    const day: TripDay = {
      id: "day",
      date: "2026-07-01",
      items: [],
    };

    const prompt = createAiItineraryPrompt(trip, day);

    expect(prompt).toContain("Taipei Weekend");
    expect(prompt).toContain("Taipei");
    expect(prompt).toContain("2026-07-01");
    expect(prompt).toContain("attraction, food, hotel, transport, shopping, rest");
    expect(prompt).toContain('"version": 1');
  });

  it("assigns imported overnight items to the next day", () => {
    const result = parseAiItineraryImport(
      JSON.stringify({
        version: 1,
        items: [
          {
            title: "Night market",
            address: "Ningxia Night Market",
            startTime: "22:30",
            endTime: "23:30",
            type: "food",
          },
          {
            title: "Late bar",
            address: "Taipei bar",
            startTime: "23:40",
            endTime: "01:00",
            type: "food",
          },
          {
            title: "Breakfast",
            address: "Taipei breakfast shop",
            startTime: "09:00",
            endTime: "10:00",
            type: "food",
          },
        ],
      }),
    );

    const assignments = getAiItineraryImportDayAssignments(result.items);

    expect(assignments.map((assignment) => assignment.dayOffset)).toEqual([0, 1, 1]);
  });

  it("moves early morning imports after an existing late-night item to the next day", () => {
    const result = parseAiItineraryImport(
      JSON.stringify({
        version: 1,
        items: [
          {
            title: "Airport ride",
            address: "Taipei Main Station",
            startTime: "01:00",
            endTime: "02:00",
            type: "transport",
          },
        ],
      }),
    );

    const assignments = getAiItineraryImportDayAssignments(result.items, [
      {
        id: "item-night",
        placeId: "place-night",
        type: "food",
        title: "Late dinner",
        startTime: "21:00",
        endTime: "23:00",
        stayMinutes: 120,
      },
    ]);

    expect(assignments.map((assignment) => assignment.dayOffset)).toEqual([1]);
  });

  it("treats a large backward time jump as a new day", () => {
    const result = parseAiItineraryImport(
      JSON.stringify({
        version: 1,
        items: [
          {
            title: "Dinner",
            address: "Taipei dinner",
            startTime: "18:00",
            endTime: "20:00",
            type: "food",
          },
          {
            title: "Morning museum",
            address: "Taipei museum",
            startTime: "09:00",
            endTime: "11:00",
            type: "attraction",
          },
        ],
      }),
    );

    const assignments = getAiItineraryImportDayAssignments(result.items);

    expect(assignments.map((assignment) => assignment.dayOffset)).toEqual([0, 1]);
  });
});
