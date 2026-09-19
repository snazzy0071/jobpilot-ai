import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveImpersonation } from "@/lib/auth/impersonation";

/**
 * The real, unswapped session client — always bound to whoever is
 * actually authenticated by the browser's own cookies, regardless of
 * any active impersonation. src/lib/auth/session.ts's
 * getCurrentUser()/getCurrentProfile() (and therefore every
 * requireAdmin()/requireInstitutionAdmin() permission check) use this
 * directly, never the impersonation-aware createClient() below — an
 * admin's own identity and permissions must always be resolved from
 * their own real session, never from whatever createClient() happens
 * to be returning for a page render at that moment.
 */
export async function createRealSessionClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component; safe to ignore
            // when middleware is refreshing sessions on every request.
          }
        },
      },
    },
  );
}

// Every data-query function in this app calls createClient() below,
// often several times per page render (once per query). Resolving
// impersonation involves a real auth.getUser() round trip plus a
// database lookup — cache()'d so that cost is paid at most once per
// request, no matter how many times createClient() itself is called
// within it, the same reasoning src/lib/auth/session.ts's own cache()
// wrapping already documents for getCurrentUser().
const resolveImpersonationForRequest = cache(async (): Promise<boolean> => {
  const real = await createRealSessionClient();
  const {
    data: { user: realUser },
  } = await real.auth.getUser();
  const impersonation = await getActiveImpersonation(realUser?.id ?? null);
  return impersonation !== null;
});

/**
 * The client almost every data-query function in this app calls.
 * Transparently backed by the service role (RLS bypassed) instead of
 * the caller's own session whenever a verified admin "View as user"
 * impersonation is active for the real, currently-authenticated
 * session — every such query already filters explicitly by an
 * explicit userId parameter (never relies on auth.uid() alone; see any
 * file under src/lib/cvs, src/lib/applications, etc.), which is what
 * actually scopes the result correctly once RLS itself is out of the
 * picture, without needing to touch any of those query functions
 * individually.
 *
 * This bypass is only ever exercised for reads: every mutation path
 * (any Server Action, any non-GET route handler) is rejected upstream
 * at proxy.ts for the entire duration of an active impersonation,
 * before it ever reaches code that would call this function to write
 * anything.
 */
export async function createClient() {
  const isImpersonating = await resolveImpersonationForRequest();
  if (isImpersonating) return createAdminClient();

  return createRealSessionClient();
}
