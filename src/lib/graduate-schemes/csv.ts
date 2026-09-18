import {
  GRADUATE_SCHEME_SECTORS,
  GRADUATE_SCHEME_SECTOR_LABELS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUSES,
  GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS,
  type GraduateSchemeSector,
  type GraduateSchemeSponsorshipStatus,
} from "@/lib/graduate-schemes/types";

/**
 * Expected header, in order — same field set the manual admin form
 * takes, plus `locations` as a `;`-separated list within one CSV cell
 * (commas are already the column separator, so a comma-separated list
 * inside one field isn't safe here the way it is in the plain-text
 * form input).
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

export type GraduateSchemeCsvRow = Record<(typeof GRADUATE_SCHEME_CSV_HEADER)[number], string> & { rowNumber: number };

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
export function parseGraduateSchemeCsv(text: string): { rows: GraduateSchemeCsvRow[] } | { error: string } {
  const table = parseCsv(text.trim());
  if (table.length === 0) return { error: "That CSV is empty." };

  const header = table[0].map((cell) => normalize(cell).replace(/ /g, "_"));
  const missing = GRADUATE_SCHEME_CSV_HEADER.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return { error: `Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.` };
  }

  const columnIndex = Object.fromEntries(GRADUATE_SCHEME_CSV_HEADER.map((column) => [column, header.indexOf(column)]));

  const rows: GraduateSchemeCsvRow[] = table.slice(1).map((cells, index) => {
    const row = { rowNumber: index + 2 } as GraduateSchemeCsvRow;
    for (const column of GRADUATE_SCHEME_CSV_HEADER) {
      row[column] = (cells[columnIndex[column]] ?? "").trim();
    }
    return row;
  });

  return { rows };
}
