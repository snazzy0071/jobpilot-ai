/** How long a confirmation link stays valid after it is emailed. */
export const CONFIRMATION_TTL_HOURS = 72;

export function isConfirmationExpired(sentAt: string | null, now: Date = new Date()): boolean {
  if (!sentAt) return true;
  const sent = new Date(sentAt).getTime();
  if (Number.isNaN(sent)) return true;
  return now.getTime() - sent > CONFIRMATION_TTL_HOURS * 60 * 60 * 1000;
}

export type ConfirmationOutcome = "confirmed" | "already_confirmed" | "expired" | "invalid";

/** What a confirmation click should do for a stored row, given today's time. Pure so every case is unit-tested. */
export function decideConfirmation(row: { status: string; confirmation_sent_at: string | null } | null, now: Date = new Date()): ConfirmationOutcome {
  if (!row) return "invalid";
  if (row.status === "subscribed") return "already_confirmed";
  // An unsubscribed row that follows an old link stays unsubscribed: the person has since said no.
  if (row.status !== "pending") return "invalid";
  return isConfirmationExpired(row.confirmation_sent_at, now) ? "expired" : "confirmed";
}
