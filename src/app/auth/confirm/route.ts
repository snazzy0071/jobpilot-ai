import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { parseRedirectParam } from "@/lib/auth/safe-redirect";
import { resolvePostAuthPath } from "@/lib/auth/role-redirect";
import { sendWelcomeEmailOnce } from "@/lib/auth/welcome-email";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Always explicit in practice (signup sets next=/signup/verified,
  // password recovery sets next=/reset-password) — this fallback only
  // matters for a malformed/stale link, but stays role-aware rather
  // than a hardcoded /dashboard for the same reason every other
  // auth-completion redirect in this file does.
  const explicitNext = parseRedirectParam(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Only the signup confirmation path — never password recovery,
      // which reuses this same route with type=recovery.
      if (type === "signup" && data.user?.email) {
        await sendWelcomeEmailOnce(data.user.id, data.user.email, (data.user.user_metadata?.full_name as string | undefined) ?? null);
      }
      const { data: profile } = data.user
        ? await supabase.from("profiles").select("role").eq("id", data.user.id).single()
        : { data: null };
      return NextResponse.redirect(`${origin}${resolvePostAuthPath(profile?.role, explicitNext)}`);
    }
    return redirectWithError(origin, error.message);
  }

  return redirectWithError(origin, "This confirmation link is invalid or has expired.");
}

function redirectWithError(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
