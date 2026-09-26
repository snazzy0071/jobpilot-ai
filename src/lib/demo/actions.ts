"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { demoRequestSchema } from "@/lib/demo/schemas";
import { sendDemoAcknowledgementEmail } from "@/lib/demo/send-acknowledgement-email";
import { consumeIpRateLimit } from "@/lib/rate-limit/ip-limit";
import { echoFields, type EchoedValues } from "@/lib/forms/echo";

const DEMO_FIELDS = ["institutionName", "contactName", "email", "role", "studentPopulation", "message"] as const;

export type DemoRequestResult = { error: string; values?: EchoedValues } | { success: string } | void;

const RATE_LIMIT_MESSAGE = "Too many requests sent — try again in a bit.";

export async function requestDemo(
  _prevState: DemoRequestResult,
  formData: FormData,
): Promise<DemoRequestResult> {
  if (!(await consumeIpRateLimit("lead_demo", { windowSeconds: 60 * 60, maxRequests: 5 }))) {
    return { error: RATE_LIMIT_MESSAGE, values: echoFields(formData, DEMO_FIELDS) };
  }

  const parsed = demoRequestSchema.safeParse({
    institutionName: formData.get("institutionName"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    role: formData.get("role") || undefined,
    studentPopulation: formData.get("studentPopulation") || undefined,
    message: formData.get("message") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, values: echoFields(formData, DEMO_FIELDS) };
  }

  // Service role, after the rate limit and validation above: the tables no longer accept anonymous inserts (migration 0124), so the
  // only way in is through this action and its checks.
  const supabase = createAdminClient();
  const { error } = await supabase.from("demo_requests").insert({
    institution_name: parsed.data.institutionName,
    contact_name: parsed.data.contactName,
    email: parsed.data.email,
    role: parsed.data.role ?? null,
    student_population: parsed.data.studentPopulation ?? null,
    message: parsed.data.message ?? null,
  });

  if (error) {
    return { error: "Something went wrong — try again in a moment.", values: echoFields(formData, DEMO_FIELDS) };
  }

  await sendDemoAcknowledgementEmail(parsed.data.email, parsed.data.contactName, parsed.data.institutionName);

  return { success: "Thanks — we'll be in touch shortly to set up a time." };
}
