import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Idempotent on purpose — a repeat click on the same link (or a stale
 * cached page reload) must not report failure just because the row was
 * already flipped to `unsubscribed` by the first click. Matches by the
 * unguessable `unsubscribe_token` alone, never a row id, so the link
 * itself is the only credential needed.
 */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("newsletter_subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();

  return !error && !!data;
}
