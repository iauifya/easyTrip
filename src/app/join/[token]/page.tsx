import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { JoinPanel } from "./join-panel";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await getSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : undefined;
  const profile = user
    ? (await supabase?.from("profiles").select("display_name").eq("id", user.id).maybeSingle())?.data
    : undefined;
  const next = `/join/${token}`;

  return <main className="grid min-h-screen place-items-center bg-[#f6f3ea] px-5 text-[#183833]"><section className="w-full max-w-lg border-2 border-[#183833] bg-[#fffdf7] p-6 shadow-[8px_8px_0_#1a5b4f]">
    <p className="text-sm font-black tracking-[0.22em] text-[#b43c2f]">TRIP INVITATION</p>
    <h1 className="mt-2 text-3xl font-black">一起把想去的地方排進旅程</h1>
    <p className="my-5 leading-7 text-[#53635f]">加入後可以提出候選地點、表達必去／可以／不要，也能和旅伴一起編輯正式行程。</p>
    {user ? <><p className="mb-1 text-sm font-black text-[#1a5b4f]">你將以「{profile?.display_name || user.email}」加入</p><p className="mb-4 text-xs text-[#53635f]">{user.email}</p><JoinPanel token={token} /></> : <Link href={`/auth?next=${encodeURIComponent(next)}`} className="block border-2 border-[#183833] bg-[#d9b75f] px-4 py-3 text-center font-black shadow-[4px_4px_0_#183833]">登入後加入</Link>}
  </section></main>;
}
