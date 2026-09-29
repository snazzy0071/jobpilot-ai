import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { parseRedirectParam } from "@/lib/auth/safe-redirect";
import { resolvePostAuthPath } from "@/lib/auth/role-redirect";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMPERSONATION_COOKIE } from "@/lib/auth/impersonation";

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

// The one write path exempt from the impersonation block below — see
// that route's own comment for why it has to be a fixed path outside
// /dashboard rather than a Server Action.
const IMPERSONATION_EXIT_PATH = "/api/admin/impersonation/exit";

// Kept in sync with src/lib/auth/impersonation.ts's own constant — this
// is a coarser, faster check (no permission re-verification, since
// blocking a write a little too eagerly is harmless and this only ever
// needs to answer "is there plausibly an active session", not resolve
// one for real data access) than getActiveImpersonation() itself, which
// remains the authority actually consulted for every data read.
const MAX_IMPERSONATION_DURATION_MS = 60 * 60 * 1000;

async function getImpersonationForRequest(
  request: NextRequest,
  realUserId: string | undefined,
): Promise<{ id: string } | null> {
  if (!realUserId) return null;
  const sessionId = request.cookies.get(IMPERSONATION_COOKIE)?.value;
  if (!sessionId) return null;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("admin_impersonation_sessions")
    .select("id, admin_user_id, started_at")
    .eq("id", sessionId)
    .is("ended_at", null)
    .maybeSingle();
  if (!row || row.admin_user_id !== realUserId) return null;
  if (Date.now() - new Date(row.started_at).getTime() > MAX_IMPERSONATION_DURATION_MS) return null;

  return { id: row.id };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requiresAuth = AUTHENTICATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isGuestOnlyPath = GUEST_ONLY_PATHS.includes(pathname);
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/institution-admin");
  const isWrite = request.method !== "GET" && request.method !== "HEAD";

  // A plain GET to an ordinary public page (not auth-gated, not a guest-only page, not the admin/institution-admin
  // area, not a write) needs none of the checks below, so it skips updateSession() entirely rather than paying a
  // real Supabase auth.getUser() round trip — and the Set-Cookie header that call writes on every response — for
  // every single public pageview. That Set-Cookie is also what was forcing every public page's response
  // uncacheable (`Cache-Control: private, no-store`) regardless of that page's own `revalidate` export: middleware
  // that mutates cookies on a request opts Next.js out of serving/storing a cached response for it. Every check
  // that actually needs to know `user` is covered by the four flags above — this only skips the ones that don't.
  if (!requiresAuth && !isGuestOnlyPath && !isAdminArea && !isWrite) {
    return NextResponse.next();
  }

  const { supabaseResponse, user, supabase } = await updateSession(request);

  if (requiresAuth && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isGuestOnlyPath && user) {
    // An explicit ?redirect= (e.g. bounced here from a protected page
    // before signing in, then navigating straight back to /login) is kept
    // only if it is valid for this role. Otherwise this is the role's own
    // home — an admin or institution-admin landing on /login while already
    // signed in must not get swept into the user dashboard.
    const explicitRedirect = parseRedirectParam(request.nextUrl.searchParams.get("redirect"));
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const target = resolvePostAuthPath(profile?.role, explicitRedirect);
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Admin "View as user" impersonation — see src/lib/auth/impersonation.ts
  // for the full design. Two rules, enforced here rather than per-page
  // or per-action because this is the one point every request
  // (Server Action, route handler, or plain navigation) already passes
  // through and can't route around:
  //
  // 1. Every write (anything not GET/HEAD) is rejected outright, except
  //    the one dedicated exit endpoint — "View as user" is view-only by
  //    design, and this is what actually makes that true rather than a
  //    UI convention an admin could click past. Redirects back to the
  //    same page with a query flag rather than a bare error response,
  //    since a real Server Action on an ordinary dashboard page (e.g.
  //    "Delete CV") is exactly what an admin poking around while
  //    impersonating might genuinely click — this fails gracefully
  //    instead of surfacing a raw fetch error.
  // 2. GET navigation to any admin-area route bounces back to
  //    /dashboard instead of rendering — the mental model is "you are
  //    currently in this user's shoes"; getting back to being an admin
  //    always goes through the explicit exit action, never just by
  //    typing a /admin URL while a session is still active.
  if (user) {
    const impersonation = await getImpersonationForRequest(request, user.id);
    if (impersonation) {
      if (isWrite && pathname !== IMPERSONATION_EXIT_PATH) {
        const blockedUrl = new URL(pathname, request.url);
        blockedUrl.searchParams.set("impersonation_blocked", "1");
        return NextResponse.redirect(blockedUrl);
      }

      if (!isWrite && isAdminArea) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
