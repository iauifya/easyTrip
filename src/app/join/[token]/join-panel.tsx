"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { joinTrip } from "@/app/collaboration/actions";

export function JoinPanel({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setBusy(true); setError("");
    const result = await joinTrip(token);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.replace(`/trips/${result.data.tripId}/ideas`);
  }

  return <div className="grid gap-3"><button onClick={join} disabled={busy} className="min-h-12 border-2 border-[#183833] bg-[#d9b75f] px-4 py-3 font-black shadow-[4px_4px_0_#183833] disabled:opacity-60">{busy ? "加入中…" : "加入共享旅程"}</button>{error ? <p className="border-2 border-[#b43c2f] bg-[#fff4ef] p-3 text-sm font-black text-[#b43c2f]">{error}</p> : null}</div>;
}
