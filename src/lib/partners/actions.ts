"use server";

import { createClient } from "@/lib/supabase/server";
import { partnerInquirySchema } from "@/lib/partners/schemas";
import { consumeIpRateLimit } from "@/lib/rate-limit/ip-limit";

export type PartnerInquiryResult = { error: string } | { success: string } | void;

const RATE_LIMIT_MESSAGE = "Too many inquiries sent — try again in a bit.";

export async function submitPartnerInquiry(
  _prevState: PartnerInquiryResult,
  formData: FormData,
): Promise<PartnerInquiryResult> {
  if (!(await consumeIpRateLimit("lead_partner", { windowSeconds: 60 * 60, maxRequests: 5 }))) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const parsed = partnerInquirySchema.safeParse({
    organisationName: formData.get("organisationName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    partnershipType: formData.get("partnershipType"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("partner_inquiries").insert({
    organisation_name: parsed.data.organisationName,
    contact_name: parsed.data.contactName,
    email: parsed.data.email,
    partnership_type: parsed.data.partnershipType,
    message: parsed.data.message,
  });

  if (error) {
    return { error: "Something went wrong — try again in a moment." };
  }

  return { success: "Thanks — we'll get back to you within a business day." };
}
