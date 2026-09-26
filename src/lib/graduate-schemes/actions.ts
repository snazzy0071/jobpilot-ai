"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { createClient } from "@/lib/supabase/server";
import {
  createGraduateSchemeSchema,
  updateGraduateSchemeSchema,
  deleteGraduateSchemeSchema,
  setPublishedSchema,
  updateSchemeDatesSchema,
  verifySchemeSchema,
  importGraduateSchemeRowSchema,
  type GraduateSchemeInput,
} from "@/lib/graduate-schemes/schemas";
import {
  parseGraduateSchemeCsv,
  resolveBoolean,
  resolveSector,
  resolveSponsorshipStatus,
  resolveStudyStages,
} from "@/lib/graduate-schemes/csv";
import { slugify, uniqueSlug } from "@/lib/graduate-schemes/slug";
import { todayInUk } from "@/lib/graduate-schemes/status";

export type GraduateSchemeActionResult = { error: string } | { id: string };
export type GraduateSchemeMutationResult = { error: string } | { success: string } | void;

export type GraduateSchemeImportResult =
  | { error: string }
  | {
      dryRun: boolean;
      createdCount: number;
      updatedCount: number;
      errors: { rowNumber: number; message: string }[];
    };

// Every action needs the `manage_graduate_schemes` permission — not merely "is an admin". The pages' layout checks it too,
// but a Server Action is reachable directly, so the check is repeated at the top of each one. Writes go through the
// caller's own session, so the table's admin RLS policies (migration 0058) are a second gate. Each change is audit-logged.

async function actor() {
  const { user } = await requirePermission("manage_graduate_schemes");
  return { id: user.id, email: user.email ?? null };
}

async function audit(who: { id: string; email: string | null }, action: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await logAdminAction({ actorId: who.id, actorEmail: who.email, action, entityType: "graduate_scheme", entityId, metadata });
}

function revalidate(slug?: string) {
  revalidatePath("/admin/graduate-schemes");
  revalidatePath("/graduate-schemes");
  revalidatePath("/graduate-visa-sponsorship");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/graduate-schemes/${slug}`);
}

function schemeInputFromFormData(formData: FormData) {
  return {
    slug: formData.get("slug") || undefined,
    employer: formData.get("employer"),
    schemeName: formData.get("schemeName"),
    sector: formData.get("sector"),
    description: formData.get("description") || undefined,
    salary: formData.get("salary") || undefined,
    salaryMin: formData.get("salaryMin") || undefined,
    salaryMax: formData.get("salaryMax") || undefined,
    locations: formData.get("locations") || undefined,
    studyStages: formData.getAll("studyStages"),
    opensOn: formData.get("opensOn") || undefined,
    deadlineOn: formData.get("deadlineOn") || undefined,
    isRolling: formData.get("isRolling") === "on",
    sponsorshipStatus: formData.get("sponsorshipStatus"),
    assessmentNotes: formData.get("assessmentNotes") || undefined,
    applicationUrl: formData.get("applicationUrl") || undefined,
    notes: formData.get("notes") || undefined,
    sourceUrl: formData.get("sourceUrl"),
    sourceDate: formData.get("sourceDate"),
    verifiedAt: formData.get("verifiedAt"),
    isPublished: formData.get("isPublished") === "on",
  };
}

function rowFromInput(data: GraduateSchemeInput, slug: string) {
  return {
    slug,
    employer: data.employer,
    scheme_name: data.schemeName,
    sector: data.sector,
    description: data.description,
    salary: data.salary,
    salary_min: data.salaryMin,
    salary_max: data.salaryMax,
    locations: data.locations,
    study_stages: data.studyStages,
    opens_on: data.opensOn,
    deadline_on: data.deadlineOn,
    is_rolling: data.isRolling,
    sponsorship_status: data.sponsorshipStatus,
    assessment_notes: data.assessmentNotes,
    application_url: data.applicationUrl,
    notes: data.notes,
    source_url: data.sourceUrl,
    source_date: data.sourceDate,
    verified_at: data.verifiedAt,
    is_published: data.isPublished,
  };
}

const DUPLICATE_MESSAGE = "A scheme with that employer and scheme name (or that URL slug) already exists.";

export async function createGraduateScheme(formData: FormData): Promise<GraduateSchemeActionResult> {
  const who = await actor();

  const parsed = createGraduateSchemeSchema.safeParse(schemeInputFromFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const slug = parsed.data.slug ?? slugify(parsed.data.employer, parsed.data.schemeName);
  const { data: taken } = await supabase.from("graduate_schemes").select("slug").like("slug", `${slug}%`);
  const finalSlug = parsed.data.slug ? parsed.data.slug : uniqueSlug(slug, new Set((taken ?? []).map((row) => row.slug)));

  const { data, error } = await supabase.from("graduate_schemes").insert(rowFromInput(parsed.data, finalSlug)).select("id").single();
  if (error) {
    if (error.code === "23505") return { error: DUPLICATE_MESSAGE };
    return { error: "Couldn't create that scheme — try again." };
  }

  await audit(who, "graduate_scheme.create", data.id, { slug: finalSlug, employer: parsed.data.employer, scheme: parsed.data.schemeName });
  revalidate(finalSlug);
  return { id: data.id };
}

export async function updateGraduateScheme(_prevState: GraduateSchemeMutationResult, formData: FormData): Promise<GraduateSchemeMutationResult> {
  const who = await actor();

  const parsed = updateGraduateSchemeSchema.safeParse({ id: formData.get("id"), ...schemeInputFromFormData(formData) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("graduate_schemes").select("slug").eq("id", parsed.data.id).maybeSingle();
  if (!existing) return { error: "That scheme couldn't be found." };
  // Changing a slug breaks every link and search result for the old one, so it only changes when an admin deliberately edits it.
  const slug = parsed.data.slug ?? existing.slug;

  const { error } = await supabase.from("graduate_schemes").update(rowFromInput(parsed.data, slug)).eq("id", parsed.data.id);
  if (error) {
    if (error.code === "23505") return { error: DUPLICATE_MESSAGE };
    return { error: "Couldn't save that scheme — try again." };
  }

  await audit(who, "graduate_scheme.update", parsed.data.id, { slug, isPublished: parsed.data.isPublished });
  revalidate(slug);
  if (slug !== existing.slug) revalidatePath(`/graduate-schemes/${existing.slug}`);
  return { success: "Saved." };
}

export async function setSchemePublished(input: { id: string; isPublished: boolean }): Promise<GraduateSchemeMutationResult> {
  const who = await actor();
  const parsed = setPublishedSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("graduate_schemes").update({ is_published: parsed.data.isPublished }).eq("id", parsed.data.id).select("slug").maybeSingle();
  if (error || !data) return { error: "Couldn't update that scheme — try again." };

  await audit(who, parsed.data.isPublished ? "graduate_scheme.publish" : "graduate_scheme.unpublish", parsed.data.id);
  revalidate(data.slug);
  return { success: parsed.data.isPublished ? "Published." : "Unpublished." };
}

export async function deleteGraduateScheme(_prevState: GraduateSchemeMutationResult, formData: FormData): Promise<GraduateSchemeMutationResult> {
  const who = await actor();

  const parsed = deleteGraduateSchemeSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("graduate_schemes").delete().eq("id", parsed.data.id).select("slug").maybeSingle();
  if (error) return { error: "Couldn't delete that scheme — try again." };

  await audit(who, "graduate_scheme.delete", parsed.data.id, { slug: data?.slug ?? null });
  revalidate(data?.slug);
  return { success: "Deleted." };
}

/**
 * Bulk create/update from pasted CSV text. Every row is validated with the same schema as the manual form; a bad row is
 * reported by row number and skipped without blocking the rest, and `dryRun` reports what would happen without saving.
 * A row matches an existing scheme by (employer, scheme name): it is UPDATED in place — only the columns the CSV actually
 * contains are changed, so re-importing a short CSV never blanks a deadline or description it didn't mention — otherwise
 * it is created with a generated slug. Created/updated counts come from a real lookup, not a guess.
 */
export async function importGraduateSchemes(csvText: string, options: { dryRun?: boolean } = {}): Promise<GraduateSchemeImportResult> {
  const who = await actor();
  const dryRun = options.dryRun ?? false;

  const parsedCsv = parseGraduateSchemeCsv(csvText);
  if ("error" in parsedCsv) return { error: parsedCsv.error };
  if (parsedCsv.rows.length === 0) return { error: "That CSV has no data rows." };
  if (parsedCsv.rows.length > 500) return { error: "Import at most 500 schemes at a time." };

  const present = new Set(parsedCsv.columns);
  const errors: { rowNumber: number; message: string }[] = [];
  const valid: { rowNumber: number; data: GraduateSchemeInput }[] = [];
  const seen = new Set<string>();

  for (const row of parsedCsv.rows) {
    const fail = (message: string) => errors.push({ rowNumber: row.rowNumber, message });

    const sector = resolveSector(row.sector);
    if (!sector) {
      fail(`Unrecognised sector "${row.sector}".`);
      continue;
    }
    const sponsorshipStatus = resolveSponsorshipStatus(row.sponsorship_status);
    if (!sponsorshipStatus) {
      fail(`Unrecognised sponsorship status "${row.sponsorship_status}".`);
      continue;
    }
    const stages = resolveStudyStages(row.study_stages);
    if (stages.invalid.length > 0) {
      fail(`Unrecognised study stage "${stages.invalid[0]}".`);
      continue;
    }
    const rolling = resolveBoolean(row.rolling);
    const published = resolveBoolean(row.published);
    if (rolling === "invalid" || published === "invalid") {
      fail(`"${rolling === "invalid" ? "rolling" : "published"}" must be yes or no.`);
      continue;
    }

    const parsed = importGraduateSchemeRowSchema.safeParse({
      rowNumber: row.rowNumber,
      slug: row.slug || undefined,
      employer: row.employer,
      schemeName: row.scheme_name,
      sector,
      description: row.description || undefined,
      salary: row.salary || undefined,
      salaryMin: row.salary_min || undefined,
      salaryMax: row.salary_max || undefined,
      // The CSV cell separates several locations with `;` (commas are the column delimiter).
      locations: row.locations.replace(/;/g, ",") || undefined,
      studyStages: stages.values,
      opensOn: row.opens_on || undefined,
      deadlineOn: row.deadline_on || undefined,
      isRolling: rolling ?? false,
      sponsorshipStatus,
      assessmentNotes: row.assessment_notes || undefined,
      applicationUrl: row.application_url || undefined,
      notes: row.notes || undefined,
      sourceUrl: row.source_url,
      sourceDate: row.source_date,
      verifiedAt: row.verified_at,
      isPublished: published ?? true,
    });
    if (!parsed.success) {
      fail(parsed.error.issues[0].message);
      continue;
    }

    const key = `${parsed.data.employer.toLowerCase()}||${parsed.data.schemeName.toLowerCase()}`;
    if (seen.has(key)) {
      fail("Duplicate of an earlier row in this file (same employer and scheme).");
      continue;
    }
    seen.add(key);
    valid.push({ rowNumber: row.rowNumber, data: parsed.data });
  }

  if (valid.length === 0) return { dryRun, createdCount: 0, updatedCount: 0, errors };

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase.from("graduate_schemes").select("id, employer, scheme_name, slug");
  if (existingError) return { error: "Couldn't check existing schemes — try again." };

  const byKey = new Map((existing ?? []).map((row) => [`${row.employer.toLowerCase()}||${row.scheme_name.toLowerCase()}`, row]));
  const takenSlugs = new Set((existing ?? []).map((row) => row.slug));

  const toCreate: ReturnType<typeof rowFromInput>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];

  for (const { rowNumber, data } of valid) {
    const match = byKey.get(`${data.employer.toLowerCase()}||${data.schemeName.toLowerCase()}`);
    if (match) {
      const full = rowFromInput(data, match.slug);
      // Only the columns the CSV contains (plus the always-required ones) — never blank what the file didn't mention.
      const columnFor: Record<string, (keyof typeof full)[]> = {
        slug: ["slug"],
        description: ["description"],
        study_stages: ["study_stages"],
        opens_on: ["opens_on"],
        deadline_on: ["deadline_on"],
        rolling: ["is_rolling"],
        assessment_notes: ["assessment_notes"],
        application_url: ["application_url"],
        salary_min: ["salary_min"],
        salary_max: ["salary_max"],
        published: ["is_published"],
        salary: ["salary"],
        locations: ["locations"],
        notes: ["notes"],
      };
      const patch: Record<string, unknown> = {
        employer: full.employer,
        scheme_name: full.scheme_name,
        sector: full.sector,
        sponsorship_status: full.sponsorship_status,
        source_url: full.source_url,
        source_date: full.source_date,
        verified_at: full.verified_at,
      };
      for (const [column, fields] of Object.entries(columnFor)) {
        if (!present.has(column)) continue;
        for (const field of fields) patch[field] = full[field];
      }
      if (patch.slug && patch.slug !== match.slug && takenSlugs.has(patch.slug as string)) {
        errors.push({ rowNumber, message: `The slug "${patch.slug}" is already used by another scheme.` });
        continue;
      }
      toUpdate.push({ id: match.id, patch });
    } else {
      const base = data.slug ?? slugify(data.employer, data.schemeName);
      if (data.slug && takenSlugs.has(data.slug)) {
        errors.push({ rowNumber, message: `The slug "${data.slug}" is already used by another scheme.` });
        continue;
      }
      const slug = data.slug ?? uniqueSlug(base, takenSlugs);
      takenSlugs.add(slug);
      toCreate.push(rowFromInput(data, slug));
    }
  }

  const result = { dryRun, createdCount: toCreate.length, updatedCount: toUpdate.length, errors: errors.sort((a, b) => a.rowNumber - b.rowNumber) };
  if (dryRun) return result;

  if (toCreate.length > 0) {
    const { error } = await supabase.from("graduate_schemes").insert(toCreate);
    if (error) return { error: "Couldn't save the new schemes — nothing was created. Try again." };
  }
  for (const { id, patch } of toUpdate) {
    const { error } = await supabase.from("graduate_schemes").update(patch).eq("id", id);
    if (error) return { error: `Created ${toCreate.length}, but couldn't update every existing scheme — re-run the import to finish.` };
  }

  await audit(who, "graduate_scheme.import", null, { created: toCreate.length, updated: toUpdate.length, skipped: errors.length });
  revalidate();
  return result;
}

/**
 * Correct a scheme's dates (opening, deadline, rolling) together with the evidence they came from. The source and the
 * verification date are required in the same request, so a date can't change without saying where it was checked.
 */
export async function updateSchemeDates(input: {
  id: string;
  opensOn: string;
  deadlineOn: string;
  isRolling: boolean;
  sourceUrl: string;
  sourceDate: string;
  verifiedAt: string;
}): Promise<GraduateSchemeMutationResult> {
  const who = await actor();
  const parsed = updateSchemeDatesSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase.from("graduate_schemes").select("slug, opens_on, deadline_on, is_rolling").eq("id", parsed.data.id).maybeSingle();
  if (!before) return { error: "That scheme couldn't be found." };

  const { error } = await supabase
    .from("graduate_schemes")
    .update({
      opens_on: parsed.data.opensOn,
      deadline_on: parsed.data.deadlineOn,
      is_rolling: parsed.data.isRolling,
      source_url: parsed.data.sourceUrl,
      source_date: parsed.data.sourceDate,
      verified_at: parsed.data.verifiedAt,
    })
    .eq("id", parsed.data.id);
  if (error) return { error: "Couldn't save those dates — try again." };

  await audit(who, "graduate_scheme.dates_update", parsed.data.id, {
    before: { opensOn: before.opens_on, deadlineOn: before.deadline_on, isRolling: before.is_rolling },
    after: { opensOn: parsed.data.opensOn, deadlineOn: parsed.data.deadlineOn, isRolling: parsed.data.isRolling },
  });
  revalidate(before.slug);
  revalidatePath("/deadlines");
  return { success: "Dates saved." };
}

/** "I re-checked the source today and the dates still stand": stamps the verification date (UK today) and changes nothing else. */
export async function verifySchemeDates(input: { id: string }): Promise<GraduateSchemeMutationResult> {
  const who = await actor();
  const parsed = verifySchemeSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const today = todayInUk();
  const { data, error } = await supabase.from("graduate_schemes").update({ verified_at: today }).eq("id", parsed.data.id).select("slug, source_date").maybeSingle();
  if (error || !data) return { error: "Couldn't verify that scheme — try again." };

  await audit(who, "graduate_scheme.verify", parsed.data.id, { verifiedAt: today });
  revalidate(data.slug);
  revalidatePath("/deadlines");
  return { success: "Verified." };
}
