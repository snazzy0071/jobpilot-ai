import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getPublishedSchemeBySlug } from "@/lib/graduate-schemes/queries";
import { GRAD_SCHEME_METADATA_KEY, readPendingSchemeSlug, schemePreparePath } from "@/lib/graduate-schemes/signup-context";
import type { GraduateScheme } from "@/lib/graduate-schemes/types";

/** A published scheme for a slug, or null. A lookup failure degrades to "no scheme context" — signup and onboarding must never break over it. */
export async function findPublishedScheme(slug: string | null): Promise<GraduateScheme | null> {
  if (!slug) return null;
  try {
    return await getPublishedSchemeBySlug(slug);
  } catch {
    return null;
  }
}

/** The published scheme this account came to prepare for, if any. */
export async function getPendingScheme(user: { user_metadata?: Record<string, unknown> | null } | null | undefined): Promise<GraduateScheme | null> {
  return findPublishedScheme(readPendingSchemeSlug(user));
}

/** Records the scheme on the signed-in account. Best-effort: losing it only means landing on the dashboard instead. */
export async function rememberScheme(slug: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { [GRAD_SCHEME_METADATA_KEY]: slug } });
  if (error) console.error("rememberScheme failed:", error.message);
}

/**
 * Where to send someone who has just finished onboarding: the scheme's preparation flow if they signed up for one (and it is
 * still published), otherwise the dashboard exactly as before. The remembered scheme is cleared once used, so it steers this
 * one arrival and nothing after it.
 */
export async function resolvePostOnboardingPath(user: { user_metadata?: Record<string, unknown> | null }): Promise<string> {
  const scheme = await getPendingScheme(user);
  if (readPendingSchemeSlug(user)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ data: { [GRAD_SCHEME_METADATA_KEY]: null } });
    if (error) console.error("clearing the pending scheme failed:", error.message);
  }
  return scheme ? schemePreparePath(scheme.slug) : "/dashboard";
}
