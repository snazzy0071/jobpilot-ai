// Cleaning for text and values that arrive from a third-party job feed. Pure (no server-only import) so the
// normalizers that use it are unit-testable against real-shaped payloads.
//
// Why this matters beyond tidiness: a batch upsert is one statement, so a single bad value (a non-http URL, an
// unparseable date) that reaches the database fails the check constraint for the whole batch, not just that row. The
// normalizers therefore reject or null such values here, one listing at a time.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  pound: "£",
  euro: "€",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  bull: "•",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Feed descriptions sometimes carry markup and entities. Returns plain text with block breaks kept as line breaks. */
export function cleanFeedText(value: string | null | undefined): string {
  if (!value) return "";
  const withBreaks = value.replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n").replace(/<\s*li[^>]*>/gi, "• ");
  const withoutTags = withBreaks.replace(/<[^>]*>/g, " ");
  return decodeEntities(withoutTags)
    .replace(/\u0000/g, "")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A job's link must be a real http(s) URL — it is what the candidate clicks to apply, and the column enforces it. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** An ISO timestamp, or null for anything that doesn't parse (never guessed, never "now"). A date in the future is rejected too: a "posted tomorrow" listing would sort above everything real. */
export function safePostedAt(value: string | null | undefined, now: number = Date.now()): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const time = Date.parse(trimmed);
  if (!Number.isFinite(time)) return null;
  if (time > now + 24 * 3_600_000) return null;
  return new Date(time).toISOString();
}
