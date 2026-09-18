"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createGraduateSchemeSchema,
  updateGraduateSchemeSchema,
  deleteGraduateSchemeSchema,
  importGraduateSchemeRowSchema,
} from "@/lib/graduate-schemes/schemas";
import { parseGraduateSchemeCsv, resolveSector, resolveSponsorshipStatus } from "@/lib/graduate-schemes/csv";

export type GraduateSchemeActionResult = { error: string } | { id: string };
export type GraduateSchemeMutationResult = { error: string } | { success: string } | void;

export type GraduateSchemeImportResult =
  | { error: string }
  | {
      createdCount: number;
      updatedCount: number;
      errors: { rowNumber: number; message: string }[];
    };

function schemeInputFromFormData(formData: FormData) {
  return {
    employer: formData.get("employer"),
    schemeName: formData.get("schemeName"),
    sector: formData.get("sector"),
    salary: formData.get("salary") || undefined,
    locations: formData.get("locations") || undefined,
    sponsorshipStatus: formData.get("sponsorshipStatus"),
    notes: formData.get("notes") || undefined,
    sourceUrl: formData.get("sourceUrl"),
    sourceDate: formData.get("sourceDate"),
    verifiedAt: formData.get("verifiedAt"),
  };
}

/** requireAdmin() is the real permission boundary here just as much as the RLS policies migration 0058 added — the form and this action both run under /admin, but the database itself will reject the write if the session somehow isn't an admin's (e.g. a role changed mid-session). */
export async function createGraduateScheme(formData: FormData): Promise<GraduateSchemeActionResult> {
  await requireAdmin();

  const parsed = createGraduateSchemeSchema.safeParse(schemeInputFromFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("graduate_schemes")
    .insert({
      employer: parsed.data.employer,
      scheme_name: parsed.data.schemeName,
      sector: parsed.data.sector,
      salary: parsed.data.salary,
      locations: parsed.data.locations,
      sponsorship_status: parsed.data.sponsorshipStatus,
      notes: parsed.data.notes,
      source_url: parsed.data.sourceUrl,
      source_date: parsed.data.sourceDate,
      verified_at: parsed.data.verifiedAt,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "A scheme with that employer and scheme name already exists." };
    return { error: "Couldn't create that scheme — try again." };
  }

  revalidatePath("/admin/graduate-schemes");
  revalidatePath("/graduate-visa-sponsorship");
  return { id: data.id };
}

export async function updateGraduateScheme(
  _prevState: GraduateSchemeMutationResult,
  formData: FormData,
): Promise<GraduateSchemeMutationResult> {
  await requireAdmin();

  const parsed = updateGraduateSchemeSchema.safeParse({
    id: formData.get("id"),
    ...schemeInputFromFormData(formData),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("graduate_schemes")
    .update({
      employer: parsed.data.employer,
      scheme_name: parsed.data.schemeName,
      sector: parsed.data.sector,
      salary: parsed.data.salary,
      locations: parsed.data.locations,
      sponsorship_status: parsed.data.sponsorshipStatus,
      notes: parsed.data.notes,
      source_url: parsed.data.sourceUrl,
      source_date: parsed.data.sourceDate,
      verified_at: parsed.data.verifiedAt,
    })
    .eq("id", parsed.data.id);

  if (error) {
    if (error.code === "23505") return { error: "A scheme with that employer and scheme name already exists." };
    return { error: "Couldn't save that scheme — try again." };
  }

  revalidatePath("/admin/graduate-schemes");
  revalidatePath("/graduate-visa-sponsorship");
  return { success: "Saved." };
}

export async function deleteGraduateScheme(
  _prevState: GraduateSchemeMutationResult,
  formData: FormData,
): Promise<GraduateSchemeMutationResult> {
  await requireAdmin();

  const parsed = deleteGraduateSchemeSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.from("graduate_schemes").delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that scheme — try again." };

  revalidatePath("/admin/graduate-schemes");
  revalidatePath("/graduate-visa-sponsorship");
  return { success: "Deleted." };
}

/**
 * Bulk upsert from pasted CSV text (src/lib/graduate-schemes/csv.ts's
 * parser) — one row at a time so a single malformed row doesn't block
 * the rest of a batch, same "report per-row, don't fail the whole
 * import" spirit as the sponsor register sync's own error handling.
 * Created-vs-updated counts come from a real pre-upsert lookup (which
 * (employer, scheme_name) pairs already exist), not a guess — same
 * discipline scripts/import-sponsors.mjs's snapshotExistingSponsors
 * applies for the same reason.
 */
export async function importGraduateSchemes(csvText: string): Promise<GraduateSchemeImportResult> {
  await requireAdmin();

  const parsedCsv = parseGraduateSchemeCsv(csvText);
  if ("error" in parsedCsv) return { error: parsedCsv.error };
  if (parsedCsv.rows.length === 0) return { error: "That CSV has no data rows." };

  const errors: { rowNumber: number; message: string }[] = [];
  const validRows: {
    employer: string;
    scheme_name: string;
    sector: string;
    salary: string | null;
    locations: string[];
    sponsorship_status: string;
    notes: string | null;
    source_url: string;
    source_date: string;
    verified_at: string;
  }[] = [];

  for (const row of parsedCsv.rows) {
    const sector = resolveSector(row.sector);
    if (!sector) {
      errors.push({ rowNumber: row.rowNumber, message: `Unrecognised sector "${row.sector}".` });
      continue;
    }
    const sponsorshipStatus = resolveSponsorshipStatus(row.sponsorship_status);
    if (!sponsorshipStatus) {
      errors.push({ rowNumber: row.rowNumber, message: `Unrecognised sponsorship status "${row.sponsorship_status}".` });
      continue;
    }

    const parsed = importGraduateSchemeRowSchema.safeParse({
      rowNumber: row.rowNumber,
      employer: row.employer,
      schemeName: row.scheme_name,
      sector,
      salary: row.salary || undefined,
      // The CSV cell separates multiple locations with `;` (commas are
      // already the column delimiter); the shared schema's transform
      // splits on `,`/newline, matching the plain-text admin form.
      locations: row.locations.replace(/;/g, ",") || undefined,
      sponsorshipStatus,
      notes: row.notes || undefined,
      sourceUrl: row.source_url,
      sourceDate: row.source_date,
      verifiedAt: row.verified_at,
    });

    if (!parsed.success) {
      errors.push({ rowNumber: row.rowNumber, message: parsed.error.issues[0].message });
      continue;
    }

    validRows.push({
      employer: parsed.data.employer,
      scheme_name: parsed.data.schemeName,
      sector: parsed.data.sector,
      salary: parsed.data.salary,
      locations: parsed.data.locations,
      sponsorship_status: parsed.data.sponsorshipStatus,
      notes: parsed.data.notes,
      source_url: parsed.data.sourceUrl,
      source_date: parsed.data.sourceDate,
      verified_at: parsed.data.verifiedAt,
    });
  }

  if (validRows.length === 0) return { createdCount: 0, updatedCount: 0, errors };

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("graduate_schemes")
    .select("employer, scheme_name");
  if (existingError) return { error: "Couldn't check existing schemes — try again." };

  const existingKeys = new Set((existing ?? []).map((row) => `${row.employer}||${row.scheme_name}`));
  const createdCount = validRows.filter((row) => !existingKeys.has(`${row.employer}||${row.scheme_name}`)).length;
  const updatedCount = validRows.length - createdCount;

  const { error: upsertError } = await supabase
    .from("graduate_schemes")
    .upsert(validRows, { onConflict: "employer,scheme_name" });
  if (upsertError) return { error: "Couldn't save those schemes — try again." };

  revalidatePath("/admin/graduate-schemes");
  revalidatePath("/graduate-visa-sponsorship");
  return { createdCount, updatedCount, errors };
}
