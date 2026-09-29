import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * A plain anon-key client with no cookies and no session — for reads on
 * genuinely public data only (blog posts, comparison pages, graduate
 * schemes, advice guides, the visa sponsor register, plans), gated purely
 * by each table's own "Anyone can view..." RLS policy, never by a
 * per-request session.
 *
 * `createClient()` (src/lib/supabase/server.ts), the client almost every
 * other query function in this app uses, is bound to `cookies()` (so
 * Next.js marks the whole route dynamic just from importing it) and, on
 * top of that, resolves "is this admin currently impersonating someone"
 * on every call — a real `auth.getUser()` round trip plus a database
 * lookup, paid even by a fully anonymous visitor who was never signed in,
 * for a query that never reads `auth.uid()` in the first place. Public
 * marketing/content pages have no session to bind to and nothing to
 * impersonate, so this client skips both costs entirely, and — because it
 * never touches `cookies()` — the page that uses it stays eligible for
 * `export const revalidate` (ISR) instead of being forced fully dynamic.
 *
 * Never use this for anything that must reflect a signed-in user's own
 * identity or role-scoped data — that's exactly what `createClient()` is
 * for. This one is for the subset of reads any RLS policy already labels
 * "Anyone can view...".
 */
export function createPublicClient() {
  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
