"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCvEditorData, listCvs } from "@/lib/cvs/queries";
import { buildCvPlainText, computeFormatIssues } from "@/lib/cvs/ats-format-checks";
import { runAtsScan } from "@/lib/cvs/ats-actions";
import { createInterviewSession } from "@/lib/interviews/actions";
import { createApplication } from "@/lib/applications/actions";
import { INTERVIEW_DIFFICULTIES, INTERVIEW_MODES } from "@/lib/interviews/types";
import { getPublishedSchemeById } from "@/lib/graduate-schemes/queries";
import { buildSchemeBrief } from "@/lib/graduate-schemes/preparation/brief";
import type { GraduateScheme } from "@/lib/graduate-schemes/types";

// Every step here works for the SIGNED-IN user on a PUBLISHED scheme, and delegates the real work to the existing tools'
// own server actions — so their plan limits, metering and ownership checks apply exactly as they do there (an ATS scan is a
// metered tailored scan, an interview a metered chat/voice interview). What this file adds is only the link back to the
// scheme, so progress can be shown per user and scheme.

export type PrepResult<T = object> = ({ error: string } | ({ ok: true } & T));

const idSchema = z.string().uuid();

async function loadScheme(schemeId: string): Promise<GraduateScheme | null> {
  if (!idSchema.safeParse(schemeId).success) return null;
  return getPublishedSchemeById(schemeId);
}

function refresh(scheme: GraduateScheme) {
  revalidatePath(`/dashboard/graduate-schemes/${scheme.slug}/prepare`);
  revalidatePath(`/graduate-schemes/${scheme.slug}`);
}

async function ensureStarted(userId: string, schemeId: string, cvId?: string | null): Promise<{ error: string } | { cvId: string | null }> {
  const supabase = await createClient();
  const { data: existing } = await supabase.from("graduate_scheme_preparations").select("id, cv_id").eq("user_id", userId).eq("scheme_id", schemeId).maybeSingle();
  if (existing) {
    if (cvId !== undefined && cvId !== existing.cv_id) {
      const { error } = await supabase.from("graduate_scheme_preparations").update({ cv_id: cvId }).eq("id", existing.id).eq("user_id", userId);
      if (error) return { error: "Couldn't save your CV choice — try again." };
      return { cvId };
    }
    return { cvId: existing.cv_id };
  }
  const { error } = await supabase.from("graduate_scheme_preparations").insert({ user_id: userId, scheme_id: schemeId, cv_id: cvId ?? null });
  // A second tab starting the same journey is fine: the unique (user, scheme) row already exists.
  if (error && error.code !== "23505") return { error: "Couldn't start your preparation — try again." };
  return { cvId: cvId ?? null };
}

/** Step 1: start preparing this scheme. Idempotent. */
export async function startPreparation(input: { schemeId: string }): Promise<PrepResult> {
  const user = await requireUser();
  const scheme = await loadScheme(input.schemeId);
  if (!scheme) return { error: "That graduate scheme couldn't be found." };
  const started = await ensureStarted(user.id, scheme.id);
  if ("error" in started) return started;
  refresh(scheme);
  return { ok: true };
}

/** Step 2: choose which of your CVs to prepare. The CV must be yours (and the database checks that again). */
export async function chooseCvForScheme(input: { schemeId: string; cvId: string }): Promise<PrepResult> {
  const user = await requireUser();
  const scheme = await loadScheme(input.schemeId);
  if (!scheme) return { error: "That graduate scheme couldn't be found." };
  if (!idSchema.safeParse(input.cvId).success) return { error: "Choose a CV." };
  const cvs = await listCvs(user.id);
  if (!cvs.some((cv) => cv.id === input.cvId && !cv.isArchived)) return { error: "That CV couldn't be found." };

  const started = await ensureStarted(user.id, scheme.id, input.cvId);
  if ("error" in started) return started;
  refresh(scheme);
  return { ok: true };
}

const scanInput = z.object({ schemeId: idSchema, jobDescription: z.string().trim().max(20000).optional() });

/**
 * Step 3: ATS check of the chosen CV against the scheme. Uses the scheme's own text (buildSchemeBrief) unless the user pastes
 * the employer's posting. The scan itself is the ordinary tailored ATS scan (same prompt, same monthly allowance, same
 * plan gating); afterwards it is linked to this scheme so the score shows up here and on the scheme page.
 */
export async function runSchemeAtsScan(input: { schemeId: string; jobDescription?: string }): Promise<PrepResult<{ scanId: string; score: number }>> {
  const user = await requireUser();
  const parsed = scanInput.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const scheme = await loadScheme(parsed.data.schemeId);
  if (!scheme) return { error: "That graduate scheme couldn't be found." };

  const supabase = await createClient();
  const { data: prep } = await supabase.from("graduate_scheme_preparations").select("cv_id").eq("user_id", user.id).eq("scheme_id", scheme.id).maybeSingle();
  if (!prep?.cv_id) return { error: "Choose a CV first." };
  const cv = await getCvEditorData(user.id, prep.cv_id);
  if (!cv) return { error: "That CV couldn't be found — choose another." };

  const cvText = buildCvPlainText(cv);
  if (!cvText.trim()) return { error: "That CV has no content yet — add some before scanning." };

  const result = await runAtsScan({
    versionId: cv.versionId,
    jobDescription: parsed.data.jobDescription || buildSchemeBrief(scheme),
    cvText,
    formatIssues: computeFormatIssues(cv),
  });
  if ("error" in result) return { error: result.error };

  const { error } = await supabase.from("ats_scans").update({ graduate_scheme_id: scheme.id }).eq("id", result.scan.id).eq("user_id", user.id);
  if (error) return { error: "The scan ran, but couldn't be linked to this scheme — it is in your ATS history." };
  refresh(scheme);
  return { ok: true, scanId: result.scan.id, score: result.scan.overallScore };
}

const interviewInput = z.object({ schemeId: idSchema, mode: z.enum(INTERVIEW_MODES), difficulty: z.enum(INTERVIEW_DIFFICULTIES) });

/**
 * Step 5: a mock interview for this scheme. Resumes the one already in progress rather than starting a second; otherwise sets
 * one up through the ordinary interview setup (the credit is spent when the conversation actually begins, as usual) with the
 * employer and scheme name, the chosen CV, and the scheme's own text as context.
 */
export async function startSchemeInterview(input: { schemeId: string; mode: string; difficulty: string }): Promise<PrepResult<{ sessionId: string; resumed: boolean }>> {
  const user = await requireUser();
  const parsed = interviewInput.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };
  const scheme = await loadScheme(parsed.data.schemeId);
  if (!scheme) return { error: "That graduate scheme couldn't be found." };

  const supabase = await createClient();
  const { data: open } = await supabase.from("interview_sessions").select("id").eq("user_id", user.id).eq("graduate_scheme_id", scheme.id).eq("status", "in_progress").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (open) return { ok: true, sessionId: open.id, resumed: true };

  const { data: prep } = await supabase.from("graduate_scheme_preparations").select("cv_id").eq("user_id", user.id).eq("scheme_id", scheme.id).maybeSingle();
  if (!prep?.cv_id) return { error: "Choose a CV first." };

  const form = new FormData();
  form.set("cvId", prep.cv_id);
  form.set("company", scheme.employer);
  form.set("role", scheme.schemeName);
  form.set("jobDescription", buildSchemeBrief(scheme));
  form.set("mode", parsed.data.mode);
  form.set("difficulty", parsed.data.difficulty);
  const created = await createInterviewSession(form);
  if ("error" in created) return { error: created.error };

  const { error } = await supabase.from("interview_sessions").update({ graduate_scheme_id: scheme.id }).eq("id", created.sessionId).eq("user_id", user.id);
  if (error) return { error: "The interview was set up, but couldn't be linked to this scheme — it is in your interview list." };
  refresh(scheme);
  return { ok: true, sessionId: created.sessionId, resumed: false };
}

/** Step 6: put the scheme in the job tracker (Wishlist), with its real deadline, location, salary and link. One per scheme. */
export async function addSchemeToTracker(input: { schemeId: string }): Promise<PrepResult<{ applicationId: string; existing: boolean }>> {
  const user = await requireUser();
  const scheme = await loadScheme(input.schemeId);
  if (!scheme) return { error: "That graduate scheme couldn't be found." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("applications").select("id").eq("user_id", user.id).eq("graduate_scheme_id", scheme.id).maybeSingle();
  if (existing) return { ok: true, applicationId: existing.id, existing: true };

  const { data: prep } = await supabase.from("graduate_scheme_preparations").select("cv_id").eq("user_id", user.id).eq("scheme_id", scheme.id).maybeSingle();

  const form = new FormData();
  form.set("companyName", scheme.employer);
  form.set("jobTitle", scheme.schemeName);
  if (scheme.locations.length > 0) form.set("location", scheme.locations.join(", ").slice(0, 200));
  if (scheme.salary) form.set("salary", scheme.salary);
  form.set("url", scheme.applicationUrl ?? scheme.sourceUrl);
  if (scheme.deadlineOn) form.set("deadline", scheme.deadlineOn);
  form.set("status", "wishlist");
  if (prep?.cv_id) form.set("cvId", prep.cv_id);
  const created = await createApplication(form);
  if ("error" in created) return { error: created.error };

  const { error } = await supabase.from("applications").update({ graduate_scheme_id: scheme.id }).eq("id", created.application.id).eq("user_id", user.id);
  if (error) {
    // Roll back so a retry doesn't leave a duplicate un-linked application behind.
    await supabase.from("applications").delete().eq("id", created.application.id).eq("user_id", user.id);
    if (error.code === "23505") {
      const { data: winner } = await supabase.from("applications").select("id").eq("user_id", user.id).eq("graduate_scheme_id", scheme.id).maybeSingle();
      if (winner) return { ok: true, applicationId: winner.id, existing: true };
    }
    return { error: "Couldn't add that scheme to your tracker — try again." };
  }
  refresh(scheme);
  return { ok: true, applicationId: created.application.id, existing: false };
}
