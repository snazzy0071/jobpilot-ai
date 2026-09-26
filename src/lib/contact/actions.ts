"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { contactMessageSchema } from "@/lib/contact/schemas";
import { sendContactAcknowledgementEmail } from "@/lib/contact/send-acknowledgement-email";
import { consumeIpRateLimit } from "@/lib/rate-limit/ip-limit";
import { echoFields, type EchoedValues } from "@/lib/forms/echo";

const CONTACT_FIELDS = ["name", "email", "subject", "message"] as const;

export type ContactResult = { error: string; values?: EchoedValues } | { success: string } | void;

const RATE_LIMIT_MESSAGE = "Too many messages sent — try again in a bit.";

export async function submitContactMessage(
  _prevState: ContactResult,
  formData: FormData,
): Promise<ContactResult> {
  if (!(await consumeIpRateLimit("lead_contact", { windowSeconds: 60 * 60, maxRequests: 5 }))) {
    return { error: RATE_LIMIT_MESSAGE, values: echoFields(formData, CONTACT_FIELDS) };
  }

  const parsed = contactMessageSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: echoFields(formData, CONTACT_FIELDS) };
  }

  // Service role, after the rate limit and validation above: the tables no longer accept anonymous inserts (migration 0124), so the
  // only way in is through this action and its checks.
  const supabase = createAdminClient();
  const { error } = await supabase.from("contact_messages").insert(parsed.data);

  if (error) {
    return { error: "Something went wrong — try again in a moment.", values: echoFields(formData, CONTACT_FIELDS) };
  }

  await sendContactAcknowledgementEmail(parsed.data.email, parsed.data.name);

  return { success: "Message sent — we'll get back to you soon." };
}
