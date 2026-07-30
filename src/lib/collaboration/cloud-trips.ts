import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ItineraryItem, Trip } from "@/types/trip";

export async function loadCloudTrip(tripId: string): Promise<Trip | undefined> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return undefined;
  const [{ data: trip }, { data: days }, { data: items }] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase.from("trip_days").select("*").eq("trip_id", tripId).order("position"),
    supabase.from("itinerary_items").select("*").eq("trip_id", tripId).is("deleted_at", null).order("start_time"),
  ]);
  if (!trip || !days) return undefined;
  return {
    id: trip.id, title: trip.title, destination: trip.destination,
    startDate: trip.start_date, endDate: trip.end_date, pace: trip.pace, cloudVersion: trip.version,
    days: days.map((day) => ({
      id: day.id, date: day.date,
      items: (items ?? []).filter((item) => item.day_id === day.id).map((item): ItineraryItem => ({
        id: item.id, placeId: item.place_id, title: item.title, type: item.item_type,
        startTime: String(item.start_time).slice(0, 5), endTime: String(item.end_time).slice(0, 5),
        stayMinutes: item.stay_minutes, note: item.note ?? undefined, version: item.version,
        place: { id: item.place_id, name: item.title, category: item.item_type, address: item.address ?? undefined,
          googlePlaceId: item.google_place_id ?? undefined, googleMapsUrl: item.google_maps_url ?? undefined,
          lat: item.lat ?? undefined, lng: item.lng ?? undefined, source: "google_place", averageStayMinutes: item.stay_minutes },
      })),
    })),
  };
}

export async function getCloudTripRole(tripId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return undefined;
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return undefined;
  const { data } = await supabase.from("trip_members").select("role").eq("trip_id", tripId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  return data?.role as "owner" | "editor" | undefined;
}

export async function saveCloudTripStructure(trip: Trip, previousVersion: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || await getCloudTripRole(trip.id) !== "owner") return;
  const { data } = await supabase.from("trips").update({
    title: trip.title, destination: trip.destination, start_date: trip.startDate,
    end_date: trip.endDate, pace: trip.pace, version: previousVersion + 1,
  }).eq("id", trip.id).eq("version", previousVersion).select("id").maybeSingle();
  if (!data) throw new Error("旅程設定已被更新，請重新整理。");
  const { error } = await supabase.from("trip_days").upsert(trip.days.map((day, position) => ({ id: day.id, trip_id: trip.id, date: day.date, position })));
  if (error) throw error;
  const { data: existing } = await supabase.from("itinerary_items").select("id").eq("trip_id", trip.id);
  const existingIds = new Set((existing ?? []).map((item) => item.id));
  const missing = trip.days.flatMap((day) => day.items.filter((item) => !existingIds.has(item.id)).map((item) => itemRow(trip.id, day.id, item, 1)));
  if (missing.length) {
    const { error: insertError } = await supabase.from("itinerary_items").insert(missing);
    if (insertError) throw insertError;
  }
}

function itemRow(tripId: string, dayId: string, item: ItineraryItem, version: number) {
  return { id: item.id, trip_id: tripId, day_id: dayId, place_id: item.placeId, title: item.title,
    item_type: item.type, start_time: item.startTime, end_time: item.endTime, stay_minutes: item.stayMinutes,
    note: item.note ?? null, address: item.place?.address ?? null, google_place_id: item.place?.googlePlaceId ?? null,
    google_maps_url: item.place?.googleMapsUrl ?? null, lat: item.place?.lat ?? null, lng: item.place?.lng ?? null, version };
}

export async function saveCloudItineraryItem(tripId: string, dayId: string, item: ItineraryItem, previousVersion?: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  if (previousVersion) {
    const { data } = await supabase.from("itinerary_items").update(itemRow(tripId, dayId, item, previousVersion + 1)).eq("id", item.id).eq("version", previousVersion).select("id").maybeSingle();
    if (!data) throw new Error("行程點已被其他旅伴更新，請重新整理。");
  } else {
    const { error } = await supabase.from("itinerary_items").insert(itemRow(tripId, dayId, item, 1));
    if (error && error.code !== "23505") throw error;
  }
}

export async function softDeleteCloudItineraryItem(item: ItineraryItem) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !item.version) return;
  const { data } = await supabase.from("itinerary_items").update({ deleted_at: new Date().toISOString(), version: item.version + 1 }).eq("id", item.id).eq("version", item.version).select("id").maybeSingle();
  if (!data) throw new Error("行程點已被其他旅伴更新，請重新整理。");
}

export async function restoreCloudItineraryItem(item: ItineraryItem) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !item.version) return;
  await supabase.from("itinerary_items").update({ deleted_at: null, version: item.version + 2 }).eq("id", item.id).eq("version", item.version + 1);
}
