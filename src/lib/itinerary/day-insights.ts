import { getSortedItems, getTightGapItemIds, timeToMinutes } from "../time/itinerary";
import type { ItineraryItem, TripPace } from "@/types/trip";

type NextStopStatus = "empty" | "upcoming" | "active" | "finished";

type NextStopInsight = {
  status: NextStopStatus;
  item?: ItineraryItem;
  itemIndex: number;
  message: string;
  actionLabel: string;
};

type DayWarning = {
  id: string;
  title: string;
  message: string;
};

type DayProgress = {
  completed: number;
  total: number;
  percent: number;
};

const maxStopsByPace: Record<TripPace, number> = {
  relaxed: 4,
  normal: 5,
  packed: 7,
  unlimited: Number.POSITIVE_INFINITY,
};

const maxStayMinutesByPace: Record<TripPace, number> = {
  relaxed: 360,
  normal: 480,
  packed: 600,
  unlimited: Number.POSITIVE_INFINITY,
};

function getMinutesLabel(minutes: number) {
  if (minutes <= 0) {
    return "現在";
  }

  if (minutes < 60) {
    return `${minutes} 分鐘後`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return restMinutes === 0 ? `${hours} 小時後` : `${hours} 小時 ${restMinutes} 分鐘後`;
}

export function getNextStopInsight(
  items: ItineraryItem[],
  currentTime: string,
): NextStopInsight {
  const sortedItems = getSortedItems(items);
  const currentMinutes = timeToMinutes(currentTime);

  if (sortedItems.length === 0) {
    return {
      status: "empty",
      itemIndex: -1,
      message: "今天還沒有安排項目，可以先新增一個想去的地點。",
      actionLabel: "待安排",
    };
  }

  const activeIndex = sortedItems.findIndex(
    (item) =>
      timeToMinutes(item.startTime) <= currentMinutes && currentMinutes <= timeToMinutes(item.endTime),
  );

  if (activeIndex >= 0) {
    const item = sortedItems[activeIndex];

    return {
      status: "active",
      item,
      itemIndex: activeIndex,
      message: `${item.endTime} 前結束這一站，下一站前記得保留找路和移動時間。`,
      actionLabel: "正在進行",
    };
  }

  const upcomingIndex = sortedItems.findIndex((item) => timeToMinutes(item.startTime) > currentMinutes);

  if (upcomingIndex >= 0) {
    const item = sortedItems[upcomingIndex];
    const minutesUntilStart = timeToMinutes(item.startTime) - currentMinutes;

    return {
      status: "upcoming",
      item,
      itemIndex: upcomingIndex,
      message: `${getMinutesLabel(minutesUntilStart)}抵達，建議提早留一點找路時間。`,
      actionLabel: "下一站",
    };
  }

  return {
    status: "finished",
    itemIndex: sortedItems.length - 1,
    message: "今天的行程都完成了，可以放心休息或新增臨時想去的地點。",
    actionLabel: "已完成",
  };
}

export function getDayWarnings(items: ItineraryItem[], pace: TripPace): DayWarning[] {
  const sortedItems = getSortedItems(items);
  const tightGapItemIds = getTightGapItemIds(sortedItems);
  const totalStayMinutes = sortedItems.reduce((sum, item) => sum + item.stayMinutes, 0);
  const warnings: DayWarning[] = [];

  if (sortedItems.length > maxStopsByPace[pace]) {
    warnings.push({
      id: "too-many-stops",
      title: "行程站點偏多",
      message: `這個節奏建議最多 ${maxStopsByPace[pace]} 站，目前有 ${sortedItems.length} 站，容易變成一直趕路。`,
    });
  }

  if (totalStayMinutes > maxStayMinutesByPace[pace]) {
    warnings.push({
      id: "too-long",
      title: "停留時間偏長",
      message: "今天安排的停留時間較長，建議保留吃飯、休息和迷路緩衝。",
    });
  }

  if (tightGapItemIds.size > 0) {
    warnings.push({
      id: "tight-gaps",
      title: "移動緩衝不足",
      message: `有 ${tightGapItemIds.size} 個行程間隔小於 20 分鐘，對不熟路線的人會比較吃力。`,
    });
  }

  return warnings;
}

export function getDayProgress(items: ItineraryItem[], currentTime: string): DayProgress {
  const sortedItems = getSortedItems(items);
  const currentMinutes = timeToMinutes(currentTime);
  const completed = sortedItems.filter((item) => timeToMinutes(item.endTime) < currentMinutes).length;
  const percent = sortedItems.length === 0 ? 0 : Math.round((completed / sortedItems.length) * 100);

  return {
    completed,
    total: sortedItems.length,
    percent,
  };
}

export function getCurrentTimeString(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}
