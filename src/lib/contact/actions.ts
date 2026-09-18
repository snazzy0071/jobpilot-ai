"use server";

import { createClient } from "@/lib/supabase/server";
import { contactMessageSchema } from "@/lib/contact/schemas";
import { sendContactAcknowledgementEmail } from "@/lib/contact/send-acknowledgement-email";
import { consumeIpRateLimit } from "@/lib/rate-limit/ip-limit";

export type ContactResult = { error: string } | { success: string } | void;

const RATE_LIMIT_MESSAGE = "Too many messages sent — try again in a bit.";

export async function submitContactMessage(
  _prevState: ContactResult,
  formData: FormData,
): Promise<ContactResult> {
  if (!(await consumeIpRateLimit("lead_contact", { windowSeconds: 60 * 60, maxRequests: 5 }))) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const parsed = contactMessageSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert(parsed.data);

  if (error) {
    return { error: "Something went wrong — try again in a moment." };
  }

  await sendContactAcknowledgementEmail(parsed.data.email, parsed.data.name);

  return { success: "Message sent — we'll get back to you soon." };
}
