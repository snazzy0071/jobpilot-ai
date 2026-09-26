"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { newsletterSubscribeSchema } from "@/lib/newsletter/schemas";
import { consumeIpRateLimit } from "@/lib/rate-limit/ip-limit";
import { generateConfirmationToken, hashConfirmationToken } from "@/lib/newsletter/confirmation";
import { sendNewsletterConfirmationEmail } from "@/lib/newsletter/send-confirmation-email";
import { echoFields, type EchoedValues } from "@/lib/forms/echo";

const NEWSLETTER_FIELDS = ["email"] as const;

export type NewsletterResult = { error: string; values?: EchoedValues } | { success: string } | void;

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
 * Double opt-in: a new or returning address is stored as `pending` with only the hash of a one-time token, and the owner of the
 * address gets a confirmation email; nothing is `subscribed` until they open that link (src/lib/newsletter/confirmation.ts).
 * Upsert, not insert-then-catch-duplicate, so a person who unsubscribed can start again and a repeat request refreshes the link.
 * Runs through the service-role client because the table has no policy for anon or authenticated users at all (migration 0124).
 */
export async function subscribeToNewsletter(
  _prevState: NewsletterResult,
  formData: FormData,
): Promise<NewsletterResult> {
  if (!(await consumeIpRateLimit("lead_newsletter", { windowSeconds: 60 * 60, maxRequests: 5 }))) {
    return { error: RATE_LIMIT_MESSAGE, values: echoFields(formData, NEWSLETTER_FIELDS) };
  }

  const parsed = newsletterSubscribeSchema.safeParse({
    email: formData.get("email"),
    source: formData.get("source"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: echoFields(formData, NEWSLETTER_FIELDS) };
  }

  const admin = createAdminClient();
  const CHECK_INBOX = { success: "Almost there. Check your inbox and click the link in our email to confirm your subscription." };

  // Same answer whether or not the address is already on the list, so this form can't be used to find out who is subscribed.
  const { data: existing } = await admin.from("newsletter_subscribers").select("status").eq("email", parsed.data.email).maybeSingle();
  if (existing?.status === "subscribed") return CHECK_INBOX;

  // Double opt-in: nobody is subscribed until the owner of the address opens the emailed link. Only the token's hash is stored.
  const token = generateConfirmationToken();
  const { error } = await admin.from("newsletter_subscribers").upsert(
    {
      email: parsed.data.email,
      consent_source: parsed.data.source,
      status: "pending",
      unsubscribed_at: null,
      confirm_token_hash: hashConfirmationToken(token),
      confirmation_sent_at: new Date().toISOString(),
      confirmed_at: null,
    },
    { onConflict: "email" },
  );
  if (error) {
    return { error: "Something went wrong, try again in a moment.", values: echoFields(formData, NEWSLETTER_FIELDS) };
  }

  try {
    await sendNewsletterConfirmationEmail(parsed.data.email, token);
  } catch (err) {
    console.error("subscribeToNewsletter: confirmation email failed:", err);
    return { error: "We couldn't send the confirmation email just now. Please try again in a little while.", values: echoFields(formData, NEWSLETTER_FIELDS) };
  }

  return CHECK_INBOX;
}
