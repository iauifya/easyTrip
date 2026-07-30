import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/trips";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await getSupabaseServerClient();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = (await supabase.auth.getUser()).data.user;
      if (user?.app_metadata.provider === "email") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name_confirmed")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile?.display_name_confirmed) {
          const profileUrl = new URL("/auth/profile", url.origin);
          profileUrl.searchParams.set("next", next);
          return NextResponse.redirect(profileUrl);
        }
      }

      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const errorUrl = new URL("/auth", url.origin);
  errorUrl.searchParams.set("error", "登入連結無效或已過期，請重新登入。");
  errorUrl.searchParams.set("next", next);
  return NextResponse.redirect(errorUrl);
}
