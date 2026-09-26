import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { consumeRateLimit } from "@/lib/ai/rate-limit";
import { publicEnv } from "@/lib/env";

/** Whether this account signs in with an email and password (an account that only ever used Google/LinkedIn/Apple has no password to confirm). */
export function hasPasswordSignIn(user: Pick<User, "identities">): boolean {
  return (user.identities ?? []).some((identity) => identity.provider === "email");
}

/**
 * Re-authentication for the actions that take an account over or destroy it (changing the password or the email address, deleting
 * the account): a valid session cookie alone is not enough. Anyone who briefly holds a session (a shared computer, a stolen cookie)
 * could otherwise lock the owner out for good by changing the password, or move the account to their own email. The person must
 * type their CURRENT password, checked with a real sign-in on a throwaway client that keeps no session and touches no cookies.
 * Attempts are rate limited per user so this cannot be used to guess the password.
 *
 * Returns an error message to show, or null when confirmed. OAuth-only accounts (no password) are not asked.
 */
export async function verifyCurrentPassword(user: User, password: unknown): Promise<string | null> {
  if (!hasPasswordSignIn(user) || !user.email) return null;

  const supplied = typeof password === "string" ? password : "";
  if (supplied.length === 0) return "Enter your current password to confirm this change.";

  const limit = await consumeRateLimit(user.id, "reauth_password");
  if (!limit.allowed) return "Too many attempts. Wait a minute and try again.";

  const client = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: user.email, password: supplied });
  if (data.session) await client.auth.signOut({ scope: "local" });
  if (error || data.user?.id !== user.id) return "That isn't your current password.";
  return null;
}
