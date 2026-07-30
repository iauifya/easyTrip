import Link from "next/link";
import { AuthPanel } from "./auth-panel";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/trips";
  const supabase = await getSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : undefined;
  const profile = user
    ? (await supabase?.from("profiles").select("display_name").eq("id", user.id).maybeSingle())?.data
    : undefined;

  return <main className="grid min-h-screen place-items-center bg-[#f6f3ea] px-5 text-[#183833]"><section className="w-full max-w-md border-2 border-[#183833] bg-[#fffdf7] p-6 shadow-[8px_8px_0_#1a5b4f]">
    <p className="text-sm font-black tracking-[0.22em] text-[#b43c2f]">EASYTRIP ACCOUNT</p>
    <h1 className="mt-2 text-3xl font-black">和旅伴一起規劃</h1>
    <p className="mb-6 mt-3 leading-7 text-[#53635f]">登入後即可加入共享旅程、提出想去的地點並共同編輯正式行程。</p>
    {params.error ? <p className="mb-4 border-2 border-[#b43c2f] bg-[#fff4ef] p-3 text-sm font-black text-[#b43c2f]">{params.error}</p> : null}
    {user ? <div className="grid gap-3"><div><p className="font-black">已登入：{profile?.display_name || user.email}</p><p className="mt-1 text-xs text-[#53635f]">{user.email}</p></div><Link href={nextPath} className="border-2 border-[#183833] bg-[#d9b75f] px-4 py-3 text-center font-black">繼續</Link></div> : <AuthPanel nextPath={nextPath} configured={isSupabaseConfigured()} />}
  </section></main>;
}
