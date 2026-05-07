import type { ItineraryItem } from "@/types/trip";

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number) {
  const minutesInDay = 24 * 60;
  const normalizedMinutes = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getSortedItems(items: ItineraryItem[]) {
  return [...items].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function hasTightGap(previous: ItineraryItem, next: ItineraryItem, minimumGapMinutes = 20) {
  const previousEnd = timeToMinutes(previous.endTime);
  const nextStart = timeToMinutes(next.startTime);

  return nextStart - previousEnd < minimumGapMinutes;
}

export function getTightGapItemIds(items: ItineraryItem[], minimumGapMinutes = 20) {
  const sortedItems = getSortedItems(items);
  const tightItemIds = new Set<string>();

  for (let index = 1; index < sortedItems.length; index += 1) {
    const previous = sortedItems[index - 1];
    const next = sortedItems[index];

    if (hasTightGap(previous, next, minimumGapMinutes)) {
      tightItemIds.add(next.id);
    }
  }

  return tightItemIds;
}

export function getNextItem(items: ItineraryItem[], currentTime: string) {
  const currentMinutes = timeToMinutes(currentTime);

  return getSortedItems(items).find((item) => timeToMinutes(item.endTime) >= currentMinutes);
}
