import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { toSafeRedirectPath } from "@/lib/auth/safe-redirect";

// Route tiers:
//   - Public: everything not listed below — no guard, open to anyone.
//   - User / institution-admin / system-admin: need *some* session here;
//     which role is actually required is checked in that route group's
//     own layout (requireUser/requireInstitutionAdmin/requireAdmin), not
//     here — proxy only gates authentication, not authorization.
const AUTHENTICATED_PREFIXES = [
  "/dashboard", // user
  "/onboarding", // user, pre-completion
  "/reset-password", // needs the recovery session from a valid email link
  "/signup/verified", // needs the session email confirmation establishes
  "/institution-admin", // institution-admin
  "/admin", // system-admin
];

// Already-authenticated visitors shouldn't land back on these. Exact
// matches only — nested pages like /signup/check-email and
// /signup/verified must NOT be swept up by a "/signup" prefix match.
const GUEST_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const requiresAuth = AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (requiresAuth && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (GUEST_ONLY_PATHS.includes(pathname) && user) {
    const redirectTo = toSafeRedirectPath(request.nextUrl.searchParams.get("redirect"));
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
