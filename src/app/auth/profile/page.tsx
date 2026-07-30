import { redirect } from "next/navigation";
import { ProfileNameForm } from "./profile-name-form";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeNext(value?: string) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/trips";
}

export default async function ProfileNamePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const nextPath = safeNext(params.next);
  const supabase = await getSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : undefined;
  if (!supabase || !user) redirect(`/auth?next=${encodeURIComponent(nextPath)}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const defaultName = profile?.display_name || user.email?.split("@")[0] || "";

  return <main className="grid min-h-screen place-items-center bg-[#f6f3ea] px-5 text-[#183833]">
    <section className="w-full max-w-md border-2 border-[#183833] bg-[#fffdf7] p-6 shadow-[8px_8px_0_#d9b75f]">
      <p className="text-sm font-black tracking-[0.22em] text-[#b43c2f]">YOUR TRIP NAME</p>
      <h1 className="mt-2 text-3xl font-black">旅伴要怎麼稱呼你？</h1>
      <p className="mt-3 leading-7 text-[#53635f]">這是你在共享旅程中顯示的名稱，之後仍可隨時修改。</p>
      <ProfileNameForm defaultName={defaultName} nextPath={nextPath} />
    </section>
  </main>;
}
