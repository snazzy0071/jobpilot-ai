const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Every email template built from raw strings (not JSX, which escapes automatically) must run interpolated text through this — some of that text is AI-generated from a job description the caller supplied, so it's untrusted input, not just display copy. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
