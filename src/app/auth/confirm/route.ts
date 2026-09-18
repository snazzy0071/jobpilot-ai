import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { toSafeRedirectPath } from "@/lib/auth/safe-redirect";
import { sendWelcomeEmailOnce } from "@/lib/auth/welcome-email";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = toSafeRedirectPath(searchParams.get("next"));

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Only the signup confirmation path — never password recovery,
      // which reuses this same route with type=recovery.
      if (type === "signup" && data.user?.email) {
        await sendWelcomeEmailOnce(data.user.id, data.user.email, (data.user.user_metadata?.full_name as string | undefined) ?? null);
      }
      return NextResponse.redirect(`${origin}${next}`);
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
