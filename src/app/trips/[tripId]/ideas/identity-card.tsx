"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateMyDisplayName } from "@/app/collaboration/actions";
import type { TripMemberRole } from "@/types/collaboration";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts.slice(0, 2).map((part) => Array.from(part)[0]).join("").toUpperCase();
  return Array.from(parts[0] ?? "旅伴").slice(0, 2).join("").toUpperCase();
}

export function IdentityCard({ tripId, displayName }: { tripId: string; displayName: string; role: TripMemberRole }) {
  const router = useRouter();
  const [draftName, setDraftName] = useState(displayName);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleEditor() {
    setMessage("");
    setDraftName(displayName);
    setOpen((value) => !value);
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      const result = await updateMyDisplayName(draftName, tripId);
      if (!result.ok) return setMessage(result.error);
      setOpen(false);
      setMessage("顯示名稱已更新。");
      router.refresh();
    });
  }

  return <div className="relative">
    <button
      type="button"
      aria-expanded={open}
      onClick={toggleEditor}
      className="flex min-h-12 items-center gap-3 border-2 border-[#183833] bg-white px-3 py-2 text-left shadow-[3px_3px_0_#d8cbb6]"
    >
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1a5b4f] text-xs font-black text-white">{initials(displayName)}</span>
      <span className="block max-w-36 truncate text-sm font-black">{displayName}</span>
    </button>

    {open ? <form onSubmit={save} className="absolute right-0 z-30 mt-3 grid w-80 max-w-[calc(100vw-2.5rem)] gap-3 border-2 border-[#183833] bg-[#fffdf7] p-4 shadow-[6px_6px_0_#183833]">
      <div>
        <p className="font-black">編輯顯示名稱</p>
        <p className="mt-1 text-xs leading-5 text-[#53635f]">旅伴會在這趟旅程中看到這個名稱。</p>
      </div>
      <label className="grid gap-2">
        <span className="text-xs font-black">這趟旅程的名稱</span>
        <input
          required
          autoFocus
          maxLength={30}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          className="border-2 border-[#183833] bg-white px-3 py-2 font-black outline-none focus:border-[#1a5b4f]"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="border-2 border-[#d8cbb6] bg-white px-3 py-2 text-sm font-black">取消</button>
        <button disabled={pending || !draftName.trim()} className="border-2 border-[#183833] bg-[#d9b75f] px-3 py-2 text-sm font-black disabled:opacity-50">{pending ? "儲存中…" : "儲存"}</button>
      </div>
      {message ? <p className="text-xs font-black text-[#b43c2f]">{message}</p> : null}
    </form> : null}
    {!open && message ? <p className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs font-black text-[#1a5b4f]">{message}</p> : null}
  </div>;
}
