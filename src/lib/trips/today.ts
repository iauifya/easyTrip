import type { Trip } from "@/types/trip";

export type TripDayStatus = "past" | "today" | "upcoming";

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayTripDay(trip: Trip | undefined, date = new Date()) {
  if (!trip) {
    return undefined;
  }

  const today = getLocalDateString(date);

  return trip.days.find((day) => day.date === today);
}

export function hasTodayTripDay(trip: Trip, date = new Date()) {
  return Boolean(getTodayTripDay(trip, date));
}

export function getTripDayStatus(dayDate: string, date = new Date()): TripDayStatus {
  const today = getLocalDateString(date);

  if (dayDate === today) {
    return "today";
  }

  return dayDate > today ? "upcoming" : "past";
}
