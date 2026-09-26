"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { campusCrewApplicationSchema } from "@/lib/campus-crew/schemas";
import { consumeIpRateLimit } from "@/lib/rate-limit/ip-limit";
import { echoFields, type EchoedValues } from "@/lib/forms/echo";

const CAMPUS_CREW_FIELDS = ["name", "email", "university", "course", "studyYear", "motivation", "reach"] as const;

export type CampusCrewResult = { error: string; values?: EchoedValues } | { success: string } | void;

const RATE_LIMIT_MESSAGE = "Too many applications sent, try again in a bit.";

export async function submitCampusCrewApplication(_prevState: CampusCrewResult, formData: FormData): Promise<CampusCrewResult> {
  if (!(await consumeIpRateLimit("lead_campus_crew", { windowSeconds: 60 * 60, maxRequests: 5 }))) {
    return { error: RATE_LIMIT_MESSAGE, values: echoFields(formData, CAMPUS_CREW_FIELDS) };
  }

  const parsed = campusCrewApplicationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    university: formData.get("university"),
    course: formData.get("course") || undefined,
    studyYear: formData.get("studyYear") || undefined,
    motivation: formData.get("motivation"),
    reach: formData.get("reach") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: echoFields(formData, CAMPUS_CREW_FIELDS) };

  // Service role, after the rate limit and validation above: the table has no policy for anyone else (migration 0126).
  const supabase = createAdminClient();
  const { error } = await supabase.from("campus_crew_applications").insert({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    university: parsed.data.university,
    course: parsed.data.course,
    study_year: parsed.data.studyYear,
    motivation: parsed.data.motivation,
    reach: parsed.data.reach,
  });
  if (error) return { error: "Something went wrong, try again in a moment.", values: echoFields(formData, CAMPUS_CREW_FIELDS) };

  return { success: "Thanks, your application is in. We review every one and will email you if we would like to talk." };
}
