import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseRedirectParam } from "@/lib/auth/safe-redirect";
import { resolvePostAuthPath } from "@/lib/auth/role-redirect";
import { sendWelcomeEmailOnce } from "@/lib/auth/welcome-email";
import { enrollByVerifiedDomain } from "@/lib/institutions/enrollment/domain";
import { parseSchemeSignupParams } from "@/lib/graduate-schemes/signup-context";
import { findPublishedScheme, rememberScheme } from "@/lib/graduate-schemes/signup-server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const explicitNext = parseRedirectParam(searchParams.get("next"));

  // Supabase redirects back here with `error`/`error_description` instead
  // of `code` when the provider rejects the request (e.g. not enabled in
  // the dashboard yet) — surface that instead of a generic dead end.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // OAuth has no separate "confirmed" step — every successful
      // exchange lands here, first sign-in or the hundredth, so dedup
      // is entirely on sendWelcomeEmailOnce's own persisted flag.
      if (data.user?.email) {
        await sendWelcomeEmailOnce(data.user.id, data.user.email, (data.user.user_metadata?.full_name as string | undefined) ?? null);
      }
      if (data.user) await enrollByVerifiedDomain(data.user.id);
      // Signing up (or in) from a graduate scheme's page: remember the scheme on the account so onboarding can end in its
      // preparation flow. Only a real, published scheme is kept.
      const scheme = await findPublishedScheme(parseSchemeSignupParams(Object.fromEntries(searchParams)));
      if (scheme) await rememberScheme(scheme.slug);
      // Same rule as the password sign-in path: an explicit ?next= is kept
      // only if valid for this role, otherwise the role's own home.
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      return NextResponse.redirect(`${origin}${resolvePostAuthPath(profile?.role, explicitNext)}`);
    }
    return redirectWithError(origin, error.message);
  }

  return redirectWithError(origin, providerError ?? "Sign-in failed. Please try again.");
}

function redirectWithError(origin: string, message: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
