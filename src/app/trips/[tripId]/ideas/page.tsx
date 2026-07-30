import Link from "next/link";
import { redirect } from "next/navigation";
import { IdeasBoard } from "./ideas-board";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PlaceProposal, ProposalReaction } from "@/types/collaboration";

export const dynamic = "force-dynamic";

export default async function IdeasPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = await getSupabaseServerClient();
  if (!supabase) return <Unavailable />;
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/trips/${tripId}/ideas`)}`);

  const [tripResult, membersResult, proposalsResult, reactionsResult, daysResult] = await Promise.all([
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
    supabase.from("trip_members").select("user_id,display_name,role,status").eq("trip_id", tripId).eq("status", "active"),
    supabase.from("place_proposals").select("*").eq("trip_id", tripId).neq("status", "withdrawn").order("created_at", { ascending: false }),
    supabase.from("proposal_reactions").select("proposal_id,user_id,reaction").eq("trip_id", tripId),
    supabase.from("trip_days").select("id,date,position").eq("trip_id", tripId).order("position"),
  ]);
  const trip = tripResult.data;
  const members = membersResult.data ?? [];
  const currentMember = members.find((member) => member.user_id === user.id);
  if (!trip || !currentMember) return <NoAccess />;

  const memberNames = new Map(members.map((member) => [member.user_id, member.display_name]));
  const activeMemberIds = new Set(members.map((member) => member.user_id));
  const reactionsByProposal = new Map<string, ProposalReaction[]>();
  (reactionsResult.data ?? []).forEach((row) => {
    if (!activeMemberIds.has(row.user_id)) return;
    const current = reactionsByProposal.get(row.proposal_id) ?? [];
    current.push({ userId: row.user_id, displayName: memberNames.get(row.user_id) ?? "旅伴", value: row.reaction });
    reactionsByProposal.set(row.proposal_id, current);
  });
  const proposals: PlaceProposal[] = (proposalsResult.data ?? []).map((row) => ({
    id: row.id, tripId: row.trip_id, createdBy: row.created_by, creatorName: memberNames.get(row.created_by) ?? row.creator_name,
    title: row.title, address: row.address ?? undefined, googlePlaceId: row.google_place_id ?? undefined,
    googleMapsUrl: row.google_maps_url ?? undefined, lat: row.lat ?? undefined, lng: row.lng ?? undefined,
    suggestedType: row.suggested_type, status: row.status, adoptedItemId: row.adopted_item_id ?? undefined,
    version: row.version, createdAt: row.created_at, reactions: reactionsByProposal.get(row.id) ?? [],
  }));

  return <IdeasBoard
    currentUserId={user.id}
    currentMember={{ displayName: currentMember.display_name, role: currentMember.role }}
    trip={{ id: trip.id, title: trip.title, destination: trip.destination, mustQuotaEnabled: trip.must_quota_enabled, mustQuotaLimit: trip.must_quota_limit, version: trip.version, role: currentMember.role }}
    members={members.map((member) => ({ userId: member.user_id, displayName: member.display_name, role: member.role }))}
    days={(daysResult.data ?? []).map((day) => ({ id: day.id, date: day.date }))}
    proposals={proposals}
  />;
}

function Unavailable() {
  return <main className="grid min-h-screen place-items-center bg-[#f6f3ea] px-5"><section className="max-w-lg border-2 border-[#183833] bg-white p-6 text-[#183833] shadow-[8px_8px_0_#d9b75f]"><h1 className="text-2xl font-black">雲端協作尚未設定</h1><p className="mt-3 text-[#53635f]">請設定 Supabase 環境變數並執行 migration；本機行程功能仍可繼續使用。</p><Link href="/trips" className="mt-5 inline-flex border-2 border-[#183833] px-4 py-2 font-black">回旅程列表</Link></section></main>;
}
function NoAccess() {
  return <main className="grid min-h-screen place-items-center bg-[#f6f3ea] px-5"><section className="max-w-lg border-2 border-[#183833] bg-white p-6 text-[#183833]"><h1 className="text-2xl font-black">無法開啟這趟共享旅程</h1><p className="mt-3 text-[#53635f]">請使用邀請連結加入，或確認目前登入的帳號。</p><Link href="/trips" className="mt-5 inline-flex border-2 border-[#183833] px-4 py-2 font-black">回旅程列表</Link></section></main>;
}
