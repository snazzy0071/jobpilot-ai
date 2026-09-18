/**
 * Normalizes an email address into the form used as the Quick Scan rate
 * limit key — real provider aliasing rules, not a guess: a plain
 * lowercase/trim would let someone burn through a fresh "2 per month"
 * allowance just by adding a "+" tag, which most providers (Gmail,
 * Outlook, Yahoo, FastMail...) treat as delivering to the same mailbox.
 * Gmail/Googlemail additionally ignore dots in the local part — that
 * rule is Gmail-specific, not applied to other domains, where a dot can
 * be a genuinely different mailbox.
 */
export function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex === -1) return trimmed;

  let local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  const plusIndex = local.indexOf("+");
  if (plusIndex !== -1) local = local.slice(0, plusIndex);

  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replaceAll(".", "");
  }

  return `${local}@${domain}`;
}
