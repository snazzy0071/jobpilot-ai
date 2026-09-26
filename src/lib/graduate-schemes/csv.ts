import {
  GRADUATE_SCHEME_SECTORS,
  GRADUATE_SCHEME_SECTOR_LABELS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUSES,
  GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS,
  STUDY_STAGES,
  STUDY_STAGE_LABELS,
  type GraduateSchemeSector,
  type GraduateSchemeSponsorshipStatus,
  type StudyStage,
} from "@/lib/graduate-schemes/types";

/**
 * The columns every import must have (the original field set), plus optional ones an import may include. A cell holding
 * several values (locations, study stages) separates them with `;` — commas are already the column delimiter.
 */
export const GRADUATE_SCHEME_CSV_HEADER = [
  "employer",
  "scheme_name",
  "sector",
  "salary",
  "locations",
  "sponsorship_status",
  "notes",
  "source_url",
  "source_date",
  "verified_at",
] as const;

export const GRADUATE_SCHEME_CSV_OPTIONAL = [
  "slug",
  "description",
  "study_stages",
  "opens_on",
  "deadline_on",
  "rolling",
  "assessment_notes",
  "application_url",
  "salary_min",
  "salary_max",
  "published",
] as const;

const ALL_COLUMNS = [...GRADUATE_SCHEME_CSV_HEADER, ...GRADUATE_SCHEME_CSV_OPTIONAL] as const;

export type GraduateSchemeCsvRow = Record<(typeof ALL_COLUMNS)[number], string> & { rowNumber: number };

/**
 * Minimal RFC4180 parser — handles quoted fields and doubled-quote
 * escaping, same approach scripts/import-sponsors.mjs uses for the
 * (much larger) sponsor register CSV, reimplemented here in TypeScript
 * since that script isn't importable into the Next.js app.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\r") {
      // swallowed; \r\n handled by the \n branch below
    } else if (char === "\n") {
      pushRow();
    } else {
      field += char;
    }
  }
  // Final field/row if the text didn't end on a newline.
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Accepts either the DB enum key ("technology") or its display label ("Technology") — forgiving of whichever an admin pastes in from a spreadsheet. */
export function resolveSector(value: string): GraduateSchemeSector | null {
  const normalized = normalize(value);
  const byKey = GRADUATE_SCHEME_SECTORS.find((key) => key === normalized);
  if (byKey) return byKey;
  const byLabel = GRADUATE_SCHEME_SECTORS.find(
    (key) => normalize(GRADUATE_SCHEME_SECTOR_LABELS[key]) === normalized,
  );
  return byLabel ?? null;
}

export function resolveSponsorshipStatus(value: string): GraduateSchemeSponsorshipStatus | null {
  const normalized = normalize(value);
  const byKey = GRADUATE_SCHEME_SPONSORSHIP_STATUSES.find((key) => key === normalized);
  if (byKey) return byKey;
  const byLabel = GRADUATE_SCHEME_SPONSORSHIP_STATUSES.find(
    (key) => normalize(GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[key]) === normalized,
  );
  return byLabel ?? null;
}

/** Parses raw CSV text into header-mapped rows, validating only the header shape — per-field validation happens against importGraduateSchemeRowSchema, one row at a time, so one bad row doesn't block the rest of a batch. */
export function parseGraduateSchemeCsv(text: string): { rows: GraduateSchemeCsvRow[]; columns: string[] } | { error: string } {
  const table = parseCsv(text.trim());
  if (table.length === 0) return { error: "That CSV is empty." };

  const header = table[0].map((cell) => normalize(cell).replace(/ /g, "_"));
  const missing = GRADUATE_SCHEME_CSV_HEADER.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { error: `Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.` };
  }

  const columnIndex = Object.fromEntries(ALL_COLUMNS.map((column) => [column, header.indexOf(column)]));
  const unknown = header.filter((column) => column && !(ALL_COLUMNS as readonly string[]).includes(column));
  if (unknown.length > 0) {
    return { error: `Unknown column${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. A misspelt column would be silently ignored, so it is refused.` };
  }

  const rows: GraduateSchemeCsvRow[] = table.slice(1).map((cells, index) => {
    const row = { rowNumber: index + 2 } as GraduateSchemeCsvRow;
    for (const column of ALL_COLUMNS) {
      row[column] = columnIndex[column] >= 0 ? (cells[columnIndex[column]] ?? "").trim() : "";
    }
    return row;
  });

  return { rows, columns: ALL_COLUMNS.filter((column) => columnIndex[column] >= 0) };
}

/** Resolves a `;`-separated cell against a controlled vocabulary (keys or display labels). Reports what it couldn't match instead of dropping it. */
function resolveList<T extends string>(value: string, keys: readonly T[], labels: Record<T, string>): { values: T[]; invalid: string[] } {
  const values: T[] = [];
  const invalid: string[] = [];
  for (const raw of value.split(";")) {
    const item = normalize(raw).replace(/ /g, "_");
    if (!item) continue;
    const key = keys.find((k) => k === item || normalize(labels[k]) === normalize(raw));
    if (key) {
      if (!values.includes(key)) values.push(key);
    } else invalid.push(raw.trim());
  }
  return { values, invalid };
}

export const resolveStudyStages = (value: string) => resolveList<StudyStage>(value, STUDY_STAGES, STUDY_STAGE_LABELS);

/** yes/no style cells. Blank means "use the default"; anything else unrecognised is an error rather than a guess. */
export function resolveBoolean(value: string): boolean | null | "invalid" {
  const v = normalize(value);
  if (v === "") return null;
  if (["yes", "y", "true", "1"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  return "invalid";
}
