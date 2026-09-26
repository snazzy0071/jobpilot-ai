import { z } from "zod";
import { ASSESSMENT_LABELS, ASSESSMENT_TYPES, type AssessmentType } from "@/lib/graduate-schemes/types";
import { todayInUk } from "@/lib/graduate-schemes/status";
import { parseCsv } from "@/lib/graduate-schemes/csv";

const emptyToNull = (value: string | undefined) => (value ? value : null);
const optionalText = (max: number, message: string) => z.string().trim().max(max, message).optional().transform(emptyToNull);

const httpUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(2000)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, message);

/** One assessment mapping. The source and both dates are required so the claim is always traceable. */
const assessmentFields = {
  schemeId: z.string().uuid("Choose a scheme."),
  type: z.enum(ASSESSMENT_TYPES, "Choose an assessment type."),
  label: optionalText(100, "Keep the name to 100 characters or fewer."),
  provider: optionalText(100, "Keep the provider to 100 characters or fewer."),
  notes: optionalText(1000, "Keep notes to 1,000 characters or fewer."),
  isRequired: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).max(1000).default(0),
  sourceUrl: httpUrl("Enter the source URL, starting with http:// or https://."),
  sourceDate: z.iso.date("Enter a valid source date."),
  verifiedAt: z.iso.date("Enter a valid verification date."),
};

type Rules = { type: AssessmentType; label: string | null; sourceDate: string; verifiedAt: string };

export function assessmentRules(data: Rules, ctx: z.RefinementCtx, today: string = todayInUk()) {
  if (data.type === "other" && !data.label) ctx.addIssue({ code: "custom", message: "Say what this other assessment is.", path: ["label"] });
  if (data.verifiedAt < data.sourceDate) ctx.addIssue({ code: "custom", message: "The verification date can't be before the source date.", path: ["verifiedAt"] });
  if (data.verifiedAt > today) ctx.addIssue({ code: "custom", message: "The verification date can't be in the future.", path: ["verifiedAt"] });
}

export const saveAssessmentSchema = z.object({ id: z.string().uuid().optional(), ...assessmentFields }).superRefine((data, ctx) => assessmentRules(data, ctx));
export const deleteAssessmentSchema = z.object({ id: z.string().uuid() });
export type AssessmentInput = z.infer<typeof saveAssessmentSchema>;

// ---- CSV: employer, scheme_name, assessment_type, label, provider, required, notes, source_url, source_date, verified_at ----

export const ASSESSMENT_CSV_HEADER = ["employer", "scheme_name", "assessment_type", "label", "provider", "required", "notes", "source_url", "source_date", "verified_at"] as const;
export type AssessmentCsvRow = Record<(typeof ASSESSMENT_CSV_HEADER)[number], string> & { rowNumber: number };

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/** Accepts the key (`numerical`) or the display label ("Numerical reasoning test"). */
export function resolveAssessmentType(value: string): AssessmentType | null {
  const n = normalize(value).replace(/ /g, "_");
  const byKey = ASSESSMENT_TYPES.find((key) => key === n);
  if (byKey) return byKey;
  return ASSESSMENT_TYPES.find((key) => normalize(ASSESSMENT_LABELS[key]) === normalize(value)) ?? null;
}

export function parseAssessmentCsv(text: string): { rows: AssessmentCsvRow[] } | { error: string } {
  const table = parseCsv(text.trim());
  if (table.length === 0) return { error: "That CSV is empty." };
  const header = table[0].map((cell) => normalize(cell).replace(/ /g, "_"));
  const missing = ASSESSMENT_CSV_HEADER.filter((column) => !header.includes(column));
  if (missing.length > 0) return { error: `Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.` };
  const unknown = header.filter((column) => column && !(ASSESSMENT_CSV_HEADER as readonly string[]).includes(column));
  if (unknown.length > 0) return { error: `Unknown column${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.` };
  const index = Object.fromEntries(ASSESSMENT_CSV_HEADER.map((column) => [column, header.indexOf(column)]));
  const rows = table.slice(1).map((cells, i) => {
    const row = { rowNumber: i + 2 } as AssessmentCsvRow;
    for (const column of ASSESSMENT_CSV_HEADER) row[column] = (cells[index[column]] ?? "").trim();
    return row;
  });
  return { rows };
}
