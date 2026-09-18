"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { newsletterSubscribeSchema } from "@/lib/newsletter/schemas";
import { consumeIpRateLimit } from "@/lib/rate-limit/ip-limit";

export type NewsletterResult = { error: string } | { success: string } | void;

const RATE_LIMIT_MESSAGE = "Too many attempts — try again in a bit.";

/**
 * `source` is required, not inferred — the only two callers of this
 * action are the dedicated /newsletter page (where submitting the form
 * *is* the consent) and the free ATS checker's separate
 * `marketingConsent` checkbox (src/components/marketing/free-ats-
 * checker-form.tsx), which only invokes this action at all when that
 * checkbox is checked. This action never has a third way to be reached,
 * so "never subscribe unchecked users" is enforced by construction at
 * the one call site where a checkbox exists, not by anything in here —
 * but `source` still has to be a real, validated value so a consent
 * record always says which of those two surfaces it came from.
 *
 * Upsert, not insert-then-catch-duplicate: a resubscribe after a prior
 * unsubscribe must actually reactivate the row (fresh consent
 * timestamp/source, status back to `subscribed`, `unsubscribed_at`
 * cleared) rather than silently no-op behind the table's unique email
 * constraint. Runs through the service-role client because the table's
 * RLS deliberately grants anon only INSERT (migration 0011) — an anon
 * UPDATE policy would let anyone flip any other email's subscription
 * status without proving they own it, which is a worse outcome than
 * requiring this one write to go through server-side code instead.
 */
export async function subscribeToNewsletter(
  _prevState: NewsletterResult,
  formData: FormData,
): Promise<NewsletterResult> {
  if (!(await consumeIpRateLimit("lead_newsletter", { windowSeconds: 60 * 60, maxRequests: 5 }))) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const parsed = newsletterSubscribeSchema.safeParse({
    email: formData.get("email"),
    source: formData.get("source"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("newsletter_subscribers").upsert(
    {
      email: parsed.data.email,
      consent_source: parsed.data.source,
      subscribed_at: new Date().toISOString(),
      status: "subscribed",
      unsubscribed_at: null,
    },
    { onConflict: "email" },
  );

  if (error) {
    return { error: "Something went wrong — try again in a moment." };
  }

  return { success: "You're subscribed — thanks for signing up." };
}
