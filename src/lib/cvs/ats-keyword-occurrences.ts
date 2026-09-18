// Occurrence counts are computed here, deterministically, from the raw
// job description text — never asked of the model. Counting exact
// substring occurrences is a trivial, exact operation for code and a
// famously unreliable one for an LLM to self-report; the AI's job is
// judgment (which terms matter, how important, where a missing one
// belongs), not arithmetic it isn't well-suited to.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive, whole-word/phrase count of `term` in `text` — how
 * many times the job description actually mentions it, the real signal
 * behind "importance". Uses alphanumeric-adjacency lookarounds rather
 * than `\b`: real regex word boundaries only fire on a transition
 * between a word character and a non-word one, which silently breaks
 * for a term ending in a non-word character — "C++" against "C++ is a
 * bonus" fails to match with `\bC\+\+\b`, since neither the trailing `+`
 * nor the space after it is a "word" character for `\b` to anchor on.
 * This checks only that neither side of the match is itself
 * alphanumeric, so "C++" matches "C++ is a bonus" but not "C++17".
 */
export function countTermOccurrences(term: string, text: string): number {
  const trimmed = term.trim();
  if (!trimmed) return 0;
  const pattern = new RegExp(`(?<![a-zA-Z0-9])${escapeRegExp(trimmed)}(?![a-zA-Z0-9])`, "gi");
  return (text.match(pattern) ?? []).length;
}
