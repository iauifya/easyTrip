import { minutesToTime, timeToMinutes } from "../time/itinerary";
import type { ItineraryItem, ItineraryItemType } from "@/types/trip";

const typeKeywords: Array<{
  type: ItineraryItemType;
  keywords: string[];
}> = [
  {
    type: "food",
    keywords: ["餐", "飯", "咖啡", "甜點", "早餐", "午餐", "晚餐", "夜市", "酒吧", "茶", "麵","肉", "店", "吃", "飲", "食", "bar", "cafe", "restaurant", "餐廳", "美食", "小吃","料理"],
  },
  {
    type: "hotel",
    keywords: ["飯店", "酒店", "旅館", "民宿", "住宿", "check in", "check-in", "寄放"],
  },
  {
    type: "transport",
    keywords: ["車站", "機場", "捷運", "高鐵", "台鐵", "公車", "巴士", "碼頭", "轉車", "交通", "bus", "train", "airport", "station", "metro", "subway"],
  },
  {
    type: "shopping",
    keywords: ["百貨", "商場", "購物", "市場", "伴手禮", "市集", "outlet", "shopping", "mall", "market"],
  },
  {
    type: "rest",
    keywords: ["休息", "散步", "放空", "午睡", "緩衝", "relax", "rest", "break"],
  },
  {
    type: "attraction",
    keywords: ["博物館", "美術館", "公園", "展", "廟", "老街", "景點", "塔", "樓", "海邊", "山", "河", "湖", "橋", "動物園", "植物園", "遊樂園", "觀光", "景區", "attraction", "sightseeing", "museum", "park", "beach", "mountain"],
  },
];

const defaultStayMinutes: Record<ItineraryItemType, number> = {
  attraction: 90,
  food: 75,
  hotel: 30,
  transport: 30,
  shopping: 90,
  rest: 45,
};

export function suggestItemType(title: string): ItineraryItemType {
  const normalizedTitle = title.trim().toLowerCase();

  if (!normalizedTitle) {
    return "attraction";
  }

  return (
    typeKeywords.find(({ keywords }) =>
      keywords.some((keyword) => normalizedTitle.includes(keyword.toLowerCase())),
    )?.type ?? "attraction"
  );
}

export function getDefaultItemTimes(items: ItineraryItem[], type: ItineraryItemType = "attraction") {
  const latestEndMinutes =
    items.length > 0
      ? Math.max(...items.map((item) => timeToMinutes(item.endTime)))
      : timeToMinutes("08:00");
  const startMinutes = latestEndMinutes;
  const endMinutes = startMinutes + defaultStayMinutes[type];

  return {
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(endMinutes),
  };
}

export function getDefaultStayMinutes(type: ItineraryItemType) {
  return defaultStayMinutes[type];
}
