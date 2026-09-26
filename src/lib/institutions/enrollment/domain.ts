import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Best-effort enrolment by verified email domain, run when an address is CONFIRMED (email link or OAuth sign-in). The database only
 * enrols a confirmed address (enroll_via_verified_domain, migration 0119), so this is the moment it can first succeed for someone
 * who signed up before confirming. It never blocks sign-in: a full institution or any error just means they are not enrolled yet
 * and can retry from Settings.
 */
export async function enrollByVerifiedDomain(userId: string): Promise<void> {
  try {
    await createAdminClient().rpc("enroll_via_verified_domain", { p_user_id: userId });
  } catch {
    // Deliberately ignored — see above.
  }
}
