"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateMyDisplayName } from "@/app/collaboration/actions";

export function ProfileNameForm({ defaultName, nextPath }: { defaultName: string; nextPath: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultName);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await updateMyDisplayName(displayName);
      if (!result.ok) return setError(result.error);
      router.replace(nextPath);
      router.refresh();
    });
  }

  return <form onSubmit={submit} className="mt-6 grid gap-3">
    <label className="grid gap-2">
      <span className="text-sm font-black">顯示名稱</span>
      <input
        required
        autoFocus
        maxLength={30}
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        className="border-2 border-[#183833] bg-white px-4 py-3 text-lg font-black outline-none focus:border-[#1a5b4f]"
      />
    </label>
    <p className="text-xs leading-5 text-[#53635f]">已先幫你填好，可直接確認或改成平常使用的名字。</p>
    <button disabled={pending || !displayName.trim()} className="min-h-12 border-2 border-[#183833] bg-[#d9b75f] px-4 py-3 font-black shadow-[4px_4px_0_#183833] disabled:opacity-50">
      {pending ? "儲存中…" : "用這個名稱繼續"}
    </button>
    {error ? <p className="border-2 border-[#b43c2f] bg-[#fff4ef] p-3 text-sm font-black text-[#b43c2f]">{error}</p> : null}
  </form>;
}
