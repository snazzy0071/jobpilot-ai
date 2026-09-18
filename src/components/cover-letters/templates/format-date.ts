/** UK business-letter date convention — "10 September 2026", not "9/10/2026". Computed at render time, never stored, so the letter always shows today's date whenever it's viewed or exported. */
export function formatUkLetterDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
