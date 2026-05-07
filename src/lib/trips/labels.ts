import type { ItineraryItemType, TripPace } from "@/types/trip";

export const categoryLabels: Record<ItineraryItemType, string> = {
  attraction: "景點",
  food: "美食",
  hotel: "住宿",
  transport: "交通",
  shopping: "購物",
  rest: "休息",
};

export const paceLabels: Record<TripPace, string> = {
  relaxed: "輕鬆節奏",
  normal: "普通節奏",
  packed: "充實節奏",
};
