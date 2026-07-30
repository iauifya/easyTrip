"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthPanel({ nextPath, configured }: { nextPath: string; configured: boolean }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function callbackUrl() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  }

  async function signInWithGoogle() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setMessage("尚未設定 Supabase。");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) { setMessage(error.message); setBusy(false); }
  }

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setMessage("尚未設定 Supabase。");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl() },
    });
    setBusy(false);
    setMessage(error ? error.message : "Email 登入連結已寄出，請到信箱完成登入。");
  }

  if (!configured) {
    return <p className="border-2 border-[#d9b75f] bg-[#fff7d8] p-4 font-black text-[#6f4e00]">尚未設定雲端服務。請依照 .env.example 加入 Supabase 環境變數。</p>;
  }

  return (
    <div className="grid gap-4">
      <button type="button" onClick={signInWithGoogle} disabled={busy} className="min-h-12 border-2 border-[#183833] bg-white px-4 py-3 font-black shadow-[4px_4px_0_#d8cbb6] disabled:opacity-60">使用 Google 繼續</button>
      <div className="flex items-center gap-3 text-xs font-black text-[#7c4b32]"><span className="h-px flex-1 bg-[#d8cbb6]" />或使用 Email<span className="h-px flex-1 bg-[#d8cbb6]" /></div>
      <form onSubmit={sendMagicLink} className="grid gap-3">
        <label className="grid gap-2"><span className="text-sm font-black">Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="border-2 border-[#d8cbb6] bg-white px-4 py-3 outline-none focus:border-[#1a5b4f]" /></label>
        <p className="text-xs leading-5 text-[#53635f]">不用設定密碼，我們會寄一封登入信到你的信箱。</p>
        <button disabled={busy} className="min-h-12 border-2 border-[#183833] bg-[#d9b75f] px-4 py-3 font-black shadow-[4px_4px_0_#183833] disabled:opacity-60">寄送 Email 登入連結</button>
      </form>
      {message ? <p className="border-2 border-[#1a5b4f] bg-[#e9efe7] p-3 text-sm font-black text-[#1a5b4f]">{message}</p> : null}
    </div>
  );
}
