"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultStayMinutes, suggestItemType } from "@/lib/itinerary/item-suggestions";
import { minutesToTime, timeToMinutes } from "@/lib/time/itinerary";
import type { ProposalReactionValue } from "@/types/collaboration";
import type { ItineraryItemType, Trip } from "@/types/trip";

export type CollaborationActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function currentUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return undefined;
  return (await supabase.auth.getUser()).data.user;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("must_quota_reached")) return "必去卡已用完，請先調整其他選擇。";
  if (message.includes("quota_adjustment_required")) return "仍有成員超過必去卡額度，調整完成後才能採用。";
  if (message.includes("consensus_incomplete")) return "還有旅伴尚未完成投票。";
  if (message.includes("consensus_blocked")) return "有旅伴選擇「不要」，請先取得共識。";
  if (message.includes("invalid_display_name")) return "顯示名稱需為 1 到 30 個字。";
  if (message.includes("invalid_proposal_title")) return "地點名稱需為 2 到 100 個字。";
  if (message.includes("invalid_proposal_address")) return "地址不能超過 300 個字。";
  if (message.includes("version_conflict")) return "提案剛被其他畫面更新，請重新整理後再試。";
  if (message.includes("not_allowed")) return "只有原提案者能編輯尚未採用的提案。";
  if (message.includes("duplicate key")) return "這個操作已經完成，請重新整理。";
  return message || "操作失敗，請稍後再試。";
}

export async function syncTripToCloud(trip: Trip): Promise<CollaborationActionResult<{ tripId: string }>> {
  const user = await currentUser();
  const admin = getSupabaseAdminClient();
  if (!user) return { ok: false, error: "請先登入。" };
  if (!admin) return { ok: false, error: "雲端管理金鑰尚未設定。" };

  try {
    const { data: existing } = await admin.from("trips").select("owner_id").eq("id", trip.id).maybeSingle();
    if (existing && existing.owner_id !== user.id) return { ok: false, error: "同一旅程 ID 已屬於其他帳號。" };

    await admin.from("trips").upsert({
      id: trip.id, owner_id: user.id, title: trip.title, destination: trip.destination,
      start_date: trip.startDate, end_date: trip.endDate, pace: trip.pace,
    });
    const { data: profile } = await admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    const displayName = String(profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "主辦人");
    await admin.from("trip_members").upsert({ trip_id: trip.id, user_id: user.id, display_name: displayName, role: "owner", status: "active" });
    await admin.from("trip_days").upsert(trip.days.map((day, position) => ({ id: day.id, trip_id: trip.id, date: day.date, position })));
    const rows = trip.days.flatMap((day) => day.items.map((item) => ({
      id: item.id, trip_id: trip.id, day_id: day.id, place_id: item.placeId, title: item.title,
      item_type: item.type, start_time: item.startTime, end_time: item.endTime, stay_minutes: item.stayMinutes,
      note: item.note, address: item.place?.address, google_place_id: item.place?.googlePlaceId,
      google_maps_url: item.place?.googleMapsUrl, lat: item.place?.lat, lng: item.place?.lng, created_by: user.id,
    })));
    if (rows.length) await admin.from("itinerary_items").upsert(rows);
    revalidatePath(`/trips/${trip.id}/ideas`);
    return { ok: true, data: { tripId: trip.id } };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function createTripInvite(tripId: string): Promise<CollaborationActionResult<{ urlPath: string; expiresAt: string }>> {
  const user = await currentUser();
  const admin = getSupabaseAdminClient();
  if (!user || !admin) return { ok: false, error: "請先登入並完成 Supabase 設定。" };
  const { data: trip } = await admin.from("trips").select("owner_id").eq("id", tripId).maybeSingle();
  if (trip?.owner_id !== user.id) return { ok: false, error: "只有主辦人能建立邀請。" };

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("trip_invites").insert({ trip_id: tripId, token_hash: tokenHash(token), created_by: user.id, expires_at: expiresAt });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { urlPath: `/join/${token}`, expiresAt } };
}

export async function revokeTripInvites(tripId: string): Promise<CollaborationActionResult> {
  const user = await currentUser();
  const admin = getSupabaseAdminClient();
  if (!user || !admin) return { ok: false, error: "請先登入並完成雲端設定。" };
  const { data: trip } = await admin.from("trips").select("owner_id").eq("id", tripId).maybeSingle();
  if (trip?.owner_id !== user.id) return { ok: false, error: "只有主辦人能撤銷邀請。" };
  const { error } = await admin.from("trip_invites").update({ revoked_at: new Date().toISOString() }).eq("trip_id", tripId).is("revoked_at", null);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function removeTripMember(tripId: string, memberId: string): Promise<CollaborationActionResult> {
  const user = await currentUser();
  const admin = getSupabaseAdminClient();
  if (!user || !admin) return { ok: false, error: "請先登入並完成雲端設定。" };
  if (memberId === user.id) return { ok: false, error: "主辦人不能移除自己。" };
  const { data: trip } = await admin.from("trips").select("owner_id").eq("id", tripId).maybeSingle();
  if (trip?.owner_id !== user.id) return { ok: false, error: "只有主辦人能移除成員。" };
  const { error } = await admin.from("trip_members").update({ status: "removed" }).eq("trip_id", tripId).eq("user_id", memberId).eq("role", "editor");
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/trips/${tripId}/ideas`);
  return { ok: true, data: undefined };
}

export async function deleteCloudTrip(tripId: string): Promise<CollaborationActionResult> {
  const supabase = await getSupabaseServerClient();
  const user = await currentUser();
  if (!supabase || !user) return { ok: false, error: "請先登入。" };
  const { error } = await supabase.from("trips").delete().eq("id", tripId).eq("owner_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true, data: undefined };
}

export async function joinTrip(token: string): Promise<CollaborationActionResult<{ tripId: string }>> {
  const user = await currentUser();
  const admin = getSupabaseAdminClient();
  if (!user) return { ok: false, error: "請先登入。" };
  if (!admin) return { ok: false, error: "雲端服務尚未完成設定。" };

  const { data: invite } = await admin.from("trip_invites").select("trip_id,expires_at,revoked_at").eq("token_hash", tokenHash(token)).maybeSingle();
  if (!invite || invite.revoked_at || new Date(invite.expires_at) <= new Date()) return { ok: false, error: "邀請連結無效或已過期。" };
  const { data: existingMember } = await admin.from("trip_members").select("status").eq("trip_id", invite.trip_id).eq("user_id", user.id).maybeSingle();
  if (existingMember?.status === "active") return { ok: true, data: { tripId: invite.trip_id } };
  const { data: profile } = await admin.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const displayName = String(profile?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "旅伴");
  const { error } = await admin.from("trip_members").upsert({ trip_id: invite.trip_id, user_id: user.id, display_name: displayName, role: "editor", status: "active" });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { tripId: invite.trip_id } };
}

export async function updateMustQuota(tripId: string, enabled: boolean, limit: number, expectedVersion: number): Promise<CollaborationActionResult> {
  const supabase = await getSupabaseServerClient();
  const user = await currentUser();
  if (!supabase || !user) return { ok: false, error: "請先登入。" };
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) return { ok: false, error: "必去卡額度需介於 1 到 5 張。" };
  const { data, error } = await supabase.from("trips").update({ must_quota_enabled: enabled, must_quota_limit: limit, version: expectedVersion + 1 }).eq("id", tripId).eq("owner_id", user.id).eq("version", expectedVersion).select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "設定已被其他人更新，請重新整理。" };
  revalidatePath(`/trips/${tripId}/ideas`);
  return { ok: true, data: undefined };
}

export async function updateMyDisplayName(displayName: string, tripId?: string): Promise<CollaborationActionResult> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "請先登入。" };
  const normalizedName = displayName.trim().replace(/\s+/g, " ");
  if (normalizedName.length < 1 || normalizedName.length > 30) {
    return { ok: false, error: "顯示名稱需為 1 到 30 個字。" };
  }

  const { error } = await supabase.rpc("set_my_display_name", {
    target_display_name: normalizedName,
    target_trip_id: tripId ?? null,
  });
  if (error) return { ok: false, error: errorMessage(error) };

  revalidatePath("/trips");
  if (tripId) revalidatePath(`/trips/${tripId}/ideas`);
  return { ok: true, data: undefined };
}

export type ProposalInput = { tripId: string; title: string; address?: string; googlePlaceId?: string; googleMapsUrl?: string; lat?: number; lng?: number; preference: "must" | "okay" };

export async function createProposal(input: ProposalInput): Promise<CollaborationActionResult> {
  const supabase = await getSupabaseServerClient();
  const user = await currentUser();
  if (!supabase || !user) return { ok: false, error: "請先登入。" };
  if (input.title.trim().length < 2) return { ok: false, error: "請先選擇或輸入地點。" };
  const { data: member } = await supabase.from("trip_members").select("display_name").eq("trip_id", input.tripId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member) return { ok: false, error: "你不是這趟旅程的成員。" };
  const { data: proposal, error } = await supabase.from("place_proposals").insert({
    trip_id: input.tripId, created_by: user.id, creator_name: member.display_name,
    title: input.title.trim(), address: input.address || null, google_place_id: input.googlePlaceId || null,
    google_maps_url: input.googleMapsUrl || null, lat: input.lat ?? null, lng: input.lng ?? null,
    suggested_type: suggestItemType(input.title),
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  const { error: reactionError } = await supabase.rpc("set_proposal_reaction", { target_proposal_id: proposal.id, target_reaction: input.preference });
  if (reactionError) {
    await supabase.from("place_proposals").update({ status: "withdrawn" }).eq("id", proposal.id);
    return { ok: false, error: errorMessage(reactionError) };
  }
  revalidatePath(`/trips/${input.tripId}/ideas`);
  return { ok: true, data: undefined };
}

export async function updateProposalDetails(
  proposalId: string,
  tripId: string,
  title: string,
  address: string,
  expectedVersion: number,
): Promise<CollaborationActionResult> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "請先登入。" };
  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  const normalizedAddress = address.trim().replace(/\s+/g, " ");
  if (normalizedTitle.length < 2 || normalizedTitle.length > 100) {
    return { ok: false, error: "地點名稱需為 2 到 100 個字。" };
  }
  if (normalizedAddress.length > 300) {
    return { ok: false, error: "地址不能超過 300 個字。" };
  }

  const { error } = await supabase.rpc("update_proposal_details", {
    target_proposal_id: proposalId,
    target_title: normalizedTitle,
    target_address: normalizedAddress,
    target_type: suggestItemType(normalizedTitle),
    expected_version: expectedVersion,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/trips/${tripId}/ideas`);
  return { ok: true, data: undefined };
}

export async function setProposalReaction(proposalId: string, tripId: string, value: ProposalReactionValue): Promise<CollaborationActionResult> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "請先登入。" };
  const { error } = await supabase.rpc("set_proposal_reaction", { target_proposal_id: proposalId, target_reaction: value });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/trips/${tripId}/ideas`);
  return { ok: true, data: undefined };
}

export async function adoptProposal(proposalId: string, tripId: string, dayId: string, title: string, type?: ItineraryItemType): Promise<CollaborationActionResult<{ itemId: string }>> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { ok: false, error: "請先登入。" };
  const { data: items } = await supabase.from("itinerary_items").select("end_time").eq("day_id", dayId).is("deleted_at", null).order("end_time", { ascending: false }).limit(1);
  const startMinutes = items?.[0]?.end_time ? timeToMinutes(String(items[0].end_time).slice(0, 5)) + 30 : 8 * 60;
  const itemType = type ?? suggestItemType(title);
  const endMinutes = startMinutes + getDefaultStayMinutes(itemType);
  const { data, error } = await supabase.rpc("adopt_proposal", {
    target_proposal_id: proposalId, target_day_id: dayId,
    target_start: minutesToTime(startMinutes), target_end: minutesToTime(endMinutes), target_type: itemType,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/trips/${tripId}/ideas`);
  return { ok: true, data: { itemId: String(data) } };
}
