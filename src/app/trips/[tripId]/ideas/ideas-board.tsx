"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { IdentityCard } from "./identity-card";
import { adoptProposal, createProposal, createTripInvite, deleteCloudTrip, removeTripMember, revokeTripInvites, setProposalReaction, updateMustQuota, updateProposalDetails } from "@/app/collaboration/actions";
import { summarizeConsensus } from "@/lib/collaboration/consensus";
import { isGoogleMapsUrl } from "@/lib/places/google-maps";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { PlaceProposal, ProposalReactionValue, TripMemberRole } from "@/types/collaboration";
import { useTripStore } from "@/store/trip-store";

type SearchPlace = { title: string; address?: string; googlePlaceId?: string; googleMapsUrl?: string; lat?: number; lng?: number; unverified?: boolean };
type BoardProps = {
  currentUserId: string;
  currentMember: { displayName: string; role: TripMemberRole };
  trip: { id: string; title: string; destination: string; mustQuotaEnabled: boolean; mustQuotaLimit: number; version: number; role: TripMemberRole };
  members: Array<{ userId: string; displayName: string; role: string }>;
  days: Array<{ id: string; date: string }>;
  proposals: PlaceProposal[];
};

const reactionText: Record<ProposalReactionValue, string> = { must: "必去", okay: "可以", no: "不要" };
const reactionSymbol: Record<ProposalReactionValue, string> = { must: "★", okay: "●", no: "×" };
const selectedReactionClass: Record<ProposalReactionValue, string> = {
  must: "bg-[#d9b75f] text-[#183833]",
  okay: "bg-[#1a5b4f] text-white",
  no: "bg-[#b43c2f] text-white",
};

export function IdeasBoard({ currentUserId, currentMember, trip, members, days, proposals }: BoardProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPlace[]>([]);
  const [selected, setSelected] = useState<SearchPlace>();
  const [preference, setPreference] = useState<"must" | "okay">("okay");
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [quotaEnabled, setQuotaEnabled] = useState(trip.mustQuotaEnabled);
  const [quotaLimit, setQuotaLimit] = useState(trip.mustQuotaLimit);
  const [pending, startTransition] = useTransition();
  const deleteLocalTrip = useTripStore((state) => state.deleteTrip);
  const allReactions = useMemo(() => proposals.flatMap((proposal) => proposal.reactions), [proposals]);
  const mustCounts = useMemo(() => new Map(members.map((member) => [member.userId, allReactions.filter((reaction) => reaction.userId === member.userId && reaction.value === "must").length])), [allReactions, members]);
  const overLimitMembers = quotaEnabled ? members.filter((member) => (mustCounts.get(member.userId) ?? 0) > quotaLimit) : [];
  const myUsed = mustCounts.get(currentUserId) ?? 0;
  const myRemaining = quotaEnabled ? Math.max(0, quotaLimit - myUsed) : undefined;
  const isOwner = trip.role === "owner";

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel(`trip-ideas:${trip.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "place_proposals", filter: `trip_id=eq.${trip.id}` }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "proposal_reactions", filter: `trip_id=eq.${trip.id}` }, () => router.refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [router, trip.id]);

  useEffect(() => {
    if (selected && query === selected.title) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        if (isGoogleMapsUrl(trimmed)) {
          const response = await fetch("/api/places/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: trimmed }), signal: controller.signal });
          if (response.ok) {
            const place = await response.json();
            setResults([{ title: place.displayName || "Google Maps 地點", address: place.formattedAddress, googlePlaceId: place.googlePlaceId, googleMapsUrl: place.googleMapsUrl, lat: place.lat, lng: place.lng }]);
          }
        } else {
          const response = await fetch(`/api/places/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
          const payload = await response.json();
          setResults(payload.places ?? []);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([{ title: trimmed, unverified: true }]);
      } finally { setSearching(false); }
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, selected]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return setMessage(result.error ?? "操作失敗。");
      setMessage(success); router.refresh();
    });
  }

  function submitProposal() {
    if (!selected) return setMessage("請先從搜尋結果選擇一個地點。");
    if (proposals.some((proposal) => proposal.status === "candidate" && proposal.title.toLocaleLowerCase() === selected.title.toLocaleLowerCase())) return setMessage("候選池已經有相同名稱的地點，可以直接表態。");
    run(() => createProposal({ tripId: trip.id, ...selected, preference }), "已加入候選池。");
    setQuery(""); setSelected(undefined); setResults([]); setPreference("okay");
  }

  function saveQuota() {
    run(() => updateMustQuota(trip.id, quotaEnabled, quotaLimit, trip.version), "必去卡規則已更新。");
  }

  async function makeInvite() {
    const result = await createTripInvite(trip.id);
    if (!result.ok) return setMessage(result.error);
    const absolute = `${window.location.origin}${result.data.urlPath}`;
    setInviteUrl(absolute);
    try { await navigator.clipboard.writeText(absolute); setMessage("邀請連結已複製，有效 30 天。"); } catch { setMessage("邀請連結已建立，請手動複製。"); }
  }

  async function signOut() {
    await getSupabaseBrowserClient()?.auth.signOut();
    router.replace("/trips"); router.refresh();
  }

  function deleteTrip() {
    if (!window.confirm("確定刪除這趟共享旅程？這個動作無法復原。")) return;
    run(async () => {
      const result = await deleteCloudTrip(trip.id);
      if (result.ok) { deleteLocalTrip(trip.id); router.replace("/trips"); }
      return result;
    }, "共享旅程已刪除。");
  }

  return <main className="min-h-screen bg-[#f6f3ea] text-[#183833]"><div className="mx-auto w-full max-w-[88rem] px-5 py-6 sm:px-8 lg:px-10">
    <header className="flex flex-col gap-5 border-b-2 border-[#1a5b4f] pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-black tracking-[0.22em] text-[#b43c2f]">TRIP IDEAS</p><h1 className="mt-2 text-4xl font-black sm:text-6xl">{trip.title}</h1><p className="mt-2 text-[#53635f]">{trip.destination} · {members.length} 位旅伴</p></div><div className="flex flex-wrap items-center gap-2"><Link href="/trips" className="border-2 border-[#183833] bg-white px-4 py-2 font-black">旅程列表</Link>{days[0] ? <Link href={`/trips/${trip.id}/day/${days[0].id}`} className="border-2 border-[#183833] bg-white px-4 py-2 font-black">正式行程</Link> : null}{isOwner ? <button onClick={makeInvite} disabled={pending} className="border-2 border-[#183833] bg-[#d9b75f] px-4 py-2 font-black shadow-[3px_3px_0_#183833]">邀請旅伴</button> : null}<IdentityCard tripId={trip.id} displayName={currentMember.displayName} role={currentMember.role} /><button onClick={signOut} className="border-2 border-[#d8cbb6] bg-white px-4 py-2 text-sm font-black">登出</button></div></header>
    {message ? <p className="mt-4 border-2 border-[#1a5b4f] bg-[#e9efe7] px-4 py-3 text-sm font-black text-[#1a5b4f]">{message}</p> : null}
    {inviteUrl ? <input aria-label="旅伴邀請連結" readOnly value={inviteUrl} className="mt-3 w-full border-2 border-[#d8cbb6] bg-white px-3 py-2 text-sm" /> : null}

    <div className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr] lg:items-start">
      <aside className="grid gap-5 lg:sticky lg:top-5">
        <section className="border-2 border-[#183833] bg-[#0c4160] p-5 text-white shadow-[7px_7px_0_#b43c2f]"><p className="text-sm font-black tracking-[0.18em] text-[#f2d179]">新增候選地點</p><h2 className="mt-2 text-2xl font-black">大家想去哪裡？</h2><label className="mt-4 grid gap-2"><span className="text-sm font-black">搜尋或貼 Maps 連結</span><input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(undefined); setResults([]); }} placeholder="例如：teamLab Borderless" className="border-2 border-white/25 bg-white px-3 py-3 text-[#183833] outline-none" /></label>
          {searching ? <p className="mt-2 text-sm text-white/65">搜尋中…</p> : null}
          {results.length ? <div className="mt-2 grid max-h-60 gap-2 overflow-y-auto">{results.map((place) => <button type="button" key={place.googlePlaceId ?? `${place.title}-${place.address ?? "unverified"}`} onClick={() => { setSelected(place); setQuery(place.title); setResults([]); }} className="border border-white/25 bg-white/10 p-3 text-left hover:bg-white/20"><span className="block font-black">{place.title}</span><span className="mt-1 block text-xs text-white/60">{place.address ?? (place.unverified ? "未驗證地點" : "Google 地點")}</span></button>)}</div> : null}
          <div className="mt-4 grid grid-cols-2 border-2 border-white"><button type="button" onClick={() => setPreference("must")} disabled={quotaEnabled && myRemaining === 0} className={`px-3 py-2 font-black ${preference === "must" ? "bg-[#f2d179] text-[#183833]" : "text-white"} disabled:opacity-40`}>必去{quotaEnabled ? ` (${myRemaining})` : ""}</button><button type="button" onClick={() => setPreference("okay")} className={`border-l-2 border-white px-3 py-2 font-black ${preference === "okay" ? "bg-white text-[#183833]" : "text-white"}`}>想去</button></div>
          <button onClick={submitProposal} disabled={!selected || pending} className="mt-4 w-full border-2 border-[#183833] bg-[#d9b75f] px-4 py-3 font-black text-[#183833] shadow-[4px_4px_0_#183833] disabled:opacity-50">加入候選池</button>
        </section>
        {isOwner ? <><section className="border-2 border-[#183833] bg-white p-5 shadow-[5px_5px_0_#d8cbb6]"><div className="flex items-center justify-between gap-4"><div><p className="font-black">有限必去卡</p><p className="mt-1 text-xs text-[#53635f]">開啟後每人只能選固定張數。</p></div><button type="button" role="switch" aria-checked={quotaEnabled} onClick={() => setQuotaEnabled((value) => !value)} className={`relative h-7 w-12 border-2 border-[#183833] ${quotaEnabled ? "bg-[#1a5b4f]" : "bg-[#d8cbb6]"}`}><span className={`absolute top-0.5 size-5 bg-white transition ${quotaEnabled ? "left-6" : "left-0.5"}`} /></button></div>{quotaEnabled ? <label className="mt-4 grid gap-2"><span className="text-sm font-black">每人額度：{quotaLimit} 張</span><input type="range" min="1" max="5" value={quotaLimit} onChange={(event) => setQuotaLimit(Number(event.target.value))} /></label> : null}<button onClick={saveQuota} disabled={pending || (quotaEnabled === trip.mustQuotaEnabled && quotaLimit === trip.mustQuotaLimit)} className="mt-4 w-full border-2 border-[#183833] px-3 py-2 text-sm font-black disabled:opacity-40">儲存規則</button></section>
        <section className="border-2 border-[#183833] bg-white p-5 shadow-[5px_5px_0_#d8cbb6]"><p className="font-black">成員與安全</p><div className="mt-3 grid gap-2">{members.map((member) => <div key={member.userId} className="flex items-center justify-between gap-2 border-b border-[#d8cbb6] pb-2 text-sm"><span className="font-black">{member.displayName} · {member.role === "owner" ? "主辦人" : "旅伴"}</span>{member.role !== "owner" ? <button onClick={() => run(() => removeTripMember(trip.id, member.userId), "成員已移除。") } className="text-xs font-black text-[#b43c2f]">移除</button> : null}</div>)}</div><button onClick={() => run(() => revokeTripInvites(trip.id), "所有未過期邀請已撤銷。") } className="mt-4 w-full border-2 border-[#183833] px-3 py-2 text-sm font-black">撤銷現有邀請</button><button onClick={deleteTrip} className="mt-2 w-full border-2 border-[#b43c2f] px-3 py-2 text-sm font-black text-[#b43c2f]">刪除共享旅程</button></section></> : null}
      </aside>

      <section className="min-w-0"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-[#b43c2f]">候選池</p><h2 className="text-3xl font-black">{proposals.filter((proposal) => proposal.status === "candidate").length} 個待討論地點</h2></div>{quotaEnabled ? <p className="border-2 border-[#183833] bg-white px-3 py-2 text-sm font-black">你的必去卡：{myUsed}/{quotaLimit}</p> : null}</div>
        {overLimitMembers.length ? <div className="mt-4 border-2 border-[#d9b75f] bg-[#fff7d8] p-4 text-[#6f4e00]"><p className="font-black">共識暫定，採用功能已暫停</p><p className="mt-1 text-sm">等待 {overLimitMembers.map((member) => member.displayName).join("、")} 將必去卡調整到 {quotaLimit} 張內。</p></div> : null}
        <div className="mt-5 grid gap-4 xl:grid-cols-2">{proposals.length ? proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} currentUserId={currentUserId} memberCount={members.length} days={days} quotaEnabled={quotaEnabled} mustAvailable={!quotaEnabled || myUsed < quotaLimit || proposal.reactions.some((reaction) => reaction.userId === currentUserId && reaction.value === "must")} adoptionBlocked={overLimitMembers.length > 0} pending={pending} onReact={(value) => run(() => setProposalReaction(proposal.id, trip.id, value), "表態已更新。") } onAdopt={(dayId) => run(() => adoptProposal(proposal.id, trip.id, dayId, proposal.title, proposal.suggestedType), "已排入正式行程。") } />) : <div className="border-2 border-dashed border-[#183833] bg-white p-8 text-center xl:col-span-2"><h3 className="text-xl font-black">候選池還是空的</h3><p className="mt-2 text-[#53635f]">先搜尋一個地點，只要再點一次偏好就完成提案。</p></div>}</div>
      </section>
    </div>
  </div></main>;
}

function ProposalCard({ proposal, currentUserId, memberCount, days, quotaEnabled, mustAvailable, adoptionBlocked, pending, onReact, onAdopt }: { proposal: PlaceProposal; currentUserId: string; memberCount: number; days: Array<{ id: string; date: string }>; quotaEnabled: boolean; mustAvailable: boolean; adoptionBlocked: boolean; pending: boolean; onReact: (value: ProposalReactionValue) => void; onAdopt: (dayId: string) => void }) {
  const router = useRouter();
  const summary = summarizeConsensus(proposal.reactions, memberCount);
  const mine = proposal.reactions.find((reaction) => reaction.userId === currentUserId)?.value;
  const [dayId, setDayId] = useState(days[0]?.id ?? "");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(proposal.title);
  const [draftAddress, setDraftAddress] = useState(proposal.address ?? "");
  const [editError, setEditError] = useState("");
  const [editPending, startEditTransition] = useTransition();
  const remainingResponses = Math.max(0, memberCount - summary.responses);
  const consensusReady = remainingResponses === 0 && summary.no === 0;
  const selectedDayIndex = days.findIndex((day) => day.id === dayId);
  const hasSelectedDay = selectedDayIndex >= 0;
  const statusLabel = proposal.status === "adopted"
    ? "已採用"
    : summary.label === "popular"
      ? "全員通過"
      : summary.label === "pending"
        ? `等待 ${remainingResponses} 人`
        : summary.label === "skip"
          ? "建議略過"
          : "有分歧";
  const statusClass = proposal.status === "adopted" || summary.label === "popular"
    ? "border-[#1a5b4f] bg-[#e9efe7] text-[#1a5b4f]"
    : summary.label === "pending"
      ? "border-[#d9b75f] bg-[#fff7d8] text-[#6f4e00]"
      : "border-[#b43c2f] bg-[#fff0ed] text-[#b43c2f]";
  const adoptionReason = adoptionBlocked
    ? "仍有旅伴超過必去卡額度，調整完成後才會開放。"
    : remainingResponses > 0
      ? `還有 ${remainingResponses} 位旅伴尚未投票。`
      : summary.no > 0
        ? `有 ${summary.no} 位旅伴選擇「不要」，請先取得共識。`
        : days.length === 0
          ? "這趟旅程目前沒有可排入的日期。"
          : !hasSelectedDay
            ? "可用日期已更新，請重新整理後再選擇。"
          : "";
  const canAdopt = proposal.status === "candidate" && consensusReady && !adoptionBlocked && hasSelectedDay;
  const canEdit = proposal.status === "candidate" && proposal.createdBy === currentUserId;

  function openEditor() {
    setDraftTitle(proposal.title);
    setDraftAddress(proposal.address ?? "");
    setEditError("");
    setEditing(true);
  }

  function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError("");
    startEditTransition(async () => {
      const result = await updateProposalDetails(proposal.id, proposal.tripId, draftTitle, draftAddress, proposal.version);
      if (!result.ok) return setEditError(result.error);
      setEditing(false);
      router.refresh();
    });
  }

  return <article className={`border-2 border-[#183833] p-5 shadow-[6px_6px_0_#d8cbb6] ${proposal.status === "adopted" ? "bg-[#e9efe7]" : "bg-[#fffdf7]"}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-[#7c4b32]">{proposal.creatorName} 提案</p>
        {editing ? <form onSubmit={saveDetails} className="mt-3 grid gap-3 border-2 border-[#d8cbb6] bg-white p-3">
          <label className="grid gap-1">
            <span className="text-xs font-black">地點名稱</span>
            <input required maxLength={100} value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} className="border-2 border-[#183833] px-3 py-2 font-black outline-none focus:border-[#1a5b4f]" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-black">地址（選填）</span>
            <input maxLength={300} value={draftAddress} onChange={(event) => setDraftAddress(event.target.value)} placeholder="例如：東京都澀谷區神宮前 1-2-3" className="border-2 border-[#d8cbb6] px-3 py-2 text-sm outline-none focus:border-[#1a5b4f]" />
          </label>
          <p className="text-xs leading-5 text-[#53635f]">修正名稱或補充地址不會改變既有投票。</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setEditing(false)} className="border-2 border-[#d8cbb6] px-3 py-2 text-sm font-black">取消</button>
            <button disabled={editPending || draftTitle.trim().length < 2} className="border-2 border-[#183833] bg-[#d9b75f] px-3 py-2 text-sm font-black disabled:opacity-50">{editPending ? "儲存中…" : "儲存資料"}</button>
          </div>
          {editError ? <p className="text-xs font-black text-[#b43c2f]">{editError}</p> : null}
        </form> : <><h3 className="mt-1 text-2xl font-black">{proposal.title}</h3><p className="mt-2 text-sm leading-6 text-[#53635f]">{proposal.address ?? "尚未取得正式地址"}</p></>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className={`border-2 px-2 py-1 text-xs font-black ${statusClass}`}>{statusLabel}</span>
        {canEdit && !editing ? <button type="button" onClick={openEditor} className="text-xs font-black text-[#1a5b4f] underline underline-offset-4">編輯資料</button> : null}
      </div>
    </div>
    <div className="mt-4 border-t-2 border-[#d8cbb6] pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">{proposal.status === "candidate" ? "你的選擇" : "投票結果"}</p>
          <p className="mt-1 text-xs text-[#53635f]">{proposal.status === "candidate" ? "請選一個，之後仍可更改" : "此提案已停止投票"}</p>
        </div>
        <span className="shrink-0 border border-[#d8cbb6] bg-white px-2 py-1 text-xs font-black">已表態 {summary.responses}/{memberCount}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(["must", "okay", "no"] as const).map((value) => {
          const isSelected = mine === value;
          return <button
            key={value}
            type="button"
            aria-label={`${reactionText[value]}，目前 ${summary[value]} 票`}
            aria-pressed={isSelected}
            disabled={pending || proposal.status !== "candidate" || (value === "must" && !mustAvailable)}
            onClick={() => onReact(value)}
            className={`min-h-16 border-2 border-[#183833] px-2 py-2 text-sm font-black transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#183833] ${isSelected ? selectedReactionClass[value] : "bg-white"} disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`}
          >
            <span className="block">{isSelected ? "✓" : reactionSymbol[value]} {reactionText[value]}</span>
            <span className="mt-1 block text-xs opacity-70">{summary[value]} 票</span>
          </button>;
        })}
      </div>
      <p className="mt-2 text-xs font-black text-[#53635f]">{mine ? `你選了「${reactionText[mine]}」` : "你尚未投票"}</p>
    </div>
    {quotaEnabled && mine === "must" ? <p className="mt-2 text-xs font-black text-[#7c4b32]">這個選擇使用 1 張必去卡。</p> : null}
    {proposal.googleMapsUrl ? <a href={proposal.googleMapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-black text-[#1a5b4f] underline">查看 Google Maps</a> : null}
    {proposal.status === "candidate" ? canAdopt
      ? <div className="mt-4 border-t-2 border-[#d8cbb6] pt-4">
        <p className="text-sm font-black text-[#1a5b4f]">全員已完成投票，可以排入行程</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">選擇排入日期</span>
            <select value={dayId} onChange={(event) => setDayId(event.target.value)} className="w-full border-2 border-[#183833] bg-white px-2 py-2 text-sm font-black">{days.map((day, index) => <option key={day.id} value={day.id}>第 {index + 1} 天 · {day.date}</option>)}</select>
          </label>
          <button onClick={() => onAdopt(dayId)} disabled={!dayId || pending} className="border-2 border-[#183833] bg-[#d9b75f] px-3 py-2 text-sm font-black shadow-[3px_3px_0_#183833] disabled:opacity-40">
            加入第 {selectedDayIndex + 1} 天行程
          </button>
        </div>
      </div>
      : <div className="mt-4 border-2 border-dashed border-[#d8cbb6] bg-white/70 px-3 py-3">
        <p className="text-sm font-black">尚未開放加入行程</p>
        <p className="mt-1 text-xs leading-5 text-[#53635f]">{adoptionReason}</p>
      </div>
      : proposal.adoptedItemId ? <p className="mt-4 text-sm font-black text-[#1a5b4f]">已加入正式行程</p> : null}
  </article>;
}
