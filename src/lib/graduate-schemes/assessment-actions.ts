"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { createClient } from "@/lib/supabase/server";
import { deleteAssessmentSchema, parseAssessmentCsv, resolveAssessmentType, saveAssessmentSchema, type AssessmentInput } from "@/lib/graduate-schemes/assessment-schemas";
import { resolveBoolean } from "@/lib/graduate-schemes/csv";

export type AssessmentMutationResult = { error: string } | { success: string };
export type AssessmentImportResult = { error: string } | { dryRun: boolean; createdCount: number; updatedCount: number; errors: { rowNumber: number; message: string }[] };

// Same permission as the rest of the graduate-scheme data, checked in every action (a Server Action is directly reachable),
// with each change audit-logged. Writes run as the caller, so the table's admin RLS policies (migration 0112) are a second gate.

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
  revalidatePath("/deadlines");
  if (slug) revalidatePath(`/graduate-schemes/${slug}`);
}

function toRow(data: AssessmentInput) {
  return {
    scheme_id: data.schemeId,
    assessment_type: data.type,
    label: data.label,
    provider: data.provider,
    notes: data.notes,
    is_required: data.isRequired,
    display_order: data.displayOrder,
    source_url: data.sourceUrl,
    source_date: data.sourceDate,
    verified_at: data.verifiedAt,
  };
}

const DUPLICATE = "That scheme already has this assessment (same type and name) — edit the existing one instead.";

/** Adds a mapping, or updates it when `id` is given. Evidence (source + dates) is required with every save. */
export async function saveSchemeAssessment(input: unknown): Promise<AssessmentMutationResult> {
  const who = await actor();
  const parsed = saveAssessmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: scheme } = await supabase.from("graduate_schemes").select("slug").eq("id", parsed.data.schemeId).maybeSingle();
  if (!scheme) return { error: "That scheme couldn't be found." };

  if (parsed.data.id) {
    const { error } = await supabase.from("graduate_scheme_assessments").update(toRow(parsed.data)).eq("id", parsed.data.id).eq("scheme_id", parsed.data.schemeId);
    if (error) return { error: error.code === "23505" ? DUPLICATE : "Couldn't save that assessment — try again." };
    await audit(who, "graduate_scheme.assessment_update", parsed.data.id, { schemeId: parsed.data.schemeId, type: parsed.data.type });
  } else {
    const { data, error } = await supabase.from("graduate_scheme_assessments").insert(toRow(parsed.data)).select("id").single();
    if (error) return { error: error.code === "23505" ? DUPLICATE : "Couldn't add that assessment — try again." };
    await audit(who, "graduate_scheme.assessment_add", data.id, { schemeId: parsed.data.schemeId, type: parsed.data.type });
  }
  revalidate(scheme.slug);
  return { success: "Saved." };
}

export async function deleteSchemeAssessment(input: { id: string }): Promise<AssessmentMutationResult> {
  const who = await actor();
  const parsed = deleteAssessmentSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("graduate_scheme_assessments").delete().eq("id", parsed.data.id).select("scheme_id, assessment_type, graduate_schemes(slug)").maybeSingle();
  if (error) return { error: "Couldn't delete that assessment — try again." };

  await audit(who, "graduate_scheme.assessment_delete", parsed.data.id, { schemeId: data?.scheme_id ?? null, type: data?.assessment_type ?? null });
  const parent = Array.isArray(data?.graduate_schemes) ? data?.graduate_schemes[0] : data?.graduate_schemes;
  revalidate((parent as { slug: string } | null | undefined)?.slug);
  return { success: "Deleted." };
}

/**
 * Bulk add/update mappings from CSV. Rows are matched to schemes by employer + scheme name (which must already exist), each
 * carries its own evidence, a bad row is skipped and reported by number, and `dryRun` saves nothing.
 */
export async function importAssessmentMappings(csvText: string, options: { dryRun?: boolean } = {}): Promise<AssessmentImportResult> {
  const who = await actor();
  const dryRun = options.dryRun ?? false;

  const csv = parseAssessmentCsv(csvText);
  if ("error" in csv) return { error: csv.error };
  if (csv.rows.length === 0) return { error: "That CSV has no data rows." };
  if (csv.rows.length > 500) return { error: "Import at most 500 rows at a time." };

  const supabase = await createClient();
  const { data: schemes, error: schemesError } = await supabase.from("graduate_schemes").select("id, employer, scheme_name, slug");
  if (schemesError) return { error: "Couldn't load the schemes — try again." };
  const schemeByKey = new Map((schemes ?? []).map((s) => [`${s.employer.toLowerCase()}||${s.scheme_name.toLowerCase()}`, s]));

  const errors: { rowNumber: number; message: string }[] = [];
  const valid: { rowNumber: number; data: AssessmentInput; slug: string }[] = [];
  const seen = new Set<string>();

  for (const row of csv.rows) {
    const fail = (message: string) => errors.push({ rowNumber: row.rowNumber, message });
    const scheme = schemeByKey.get(`${row.employer.toLowerCase()}||${row.scheme_name.toLowerCase()}`);
    if (!scheme) {
      fail(`No scheme "${row.scheme_name}" for "${row.employer}" — add the scheme first.`);
      continue;
    }
    const type = resolveAssessmentType(row.assessment_type);
    if (!type) {
      fail(`Unrecognised assessment type "${row.assessment_type}".`);
      continue;
    }
    const required = resolveBoolean(row.required);
    if (required === "invalid") {
      fail('"required" must be yes or no.');
      continue;
    }
    const parsed = saveAssessmentSchema.safeParse({
      schemeId: scheme.id,
      type,
      label: row.label || undefined,
      provider: row.provider || undefined,
      notes: row.notes || undefined,
      isRequired: required ?? true,
      sourceUrl: row.source_url,
      sourceDate: row.source_date,
      verifiedAt: row.verified_at,
    });
    if (!parsed.success) {
      fail(parsed.error.issues[0].message);
      continue;
    }
    const key = `${scheme.id}||${type}||${parsed.data.label ?? ""}`;
    if (seen.has(key)) {
      fail("Duplicate of an earlier row (same scheme, assessment type and name).");
      continue;
    }
    seen.add(key);
    valid.push({ rowNumber: row.rowNumber, data: parsed.data, slug: scheme.slug });
  }

  if (valid.length === 0) return { dryRun, createdCount: 0, updatedCount: 0, errors };

  const { data: existing, error: existingError } = await supabase.from("graduate_scheme_assessments").select("id, scheme_id, assessment_type, label").in("scheme_id", [...new Set(valid.map((v) => v.data.schemeId))]);
  if (existingError) return { error: "Couldn't check existing assessments — try again." };
  const existingByKey = new Map((existing ?? []).map((e) => [`${e.scheme_id}||${e.assessment_type}||${e.label ?? ""}`, e.id]));

  const toCreate = valid.filter((v) => !existingByKey.has(`${v.data.schemeId}||${v.data.type}||${v.data.label ?? ""}`));
  const toUpdate = valid.filter((v) => existingByKey.has(`${v.data.schemeId}||${v.data.type}||${v.data.label ?? ""}`));
  const result = { dryRun, createdCount: toCreate.length, updatedCount: toUpdate.length, errors };
  if (dryRun) return result;

  if (toCreate.length > 0) {
    const { error } = await supabase.from("graduate_scheme_assessments").insert(toCreate.map((v) => toRow(v.data)));
    if (error) return { error: "Couldn't save the new assessments — nothing was created. Try again." };
  }
  for (const v of toUpdate) {
    const id = existingByKey.get(`${v.data.schemeId}||${v.data.type}||${v.data.label ?? ""}`)!;
    const { error } = await supabase.from("graduate_scheme_assessments").update(toRow(v.data)).eq("id", id);
    if (error) return { error: `Created ${toCreate.length}, but couldn't update every existing assessment — re-run the import to finish.` };
  }

  await audit(who, "graduate_scheme.assessment_import", null, { created: toCreate.length, updated: toUpdate.length, skipped: errors.length });
  for (const slug of new Set(valid.map((v) => v.slug))) revalidate(slug);
  return result;
}
