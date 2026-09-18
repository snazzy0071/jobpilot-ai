export type ConsentCategory = "analytics" | "marketing";

export type ConsentPreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

// `decidedAt === null` means no choice has ever been made — this, not
// `analytics`/`marketing` being `false`, is what the banner checks to
// decide whether to show itself, and what every consent-gated read
// checks before treating a category as denied vs. simply undecided.
export type ConsentState = ConsentPreferences & { decidedAt: string | null };

export const DEFAULT_CONSENT_STATE: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  decidedAt: null,
};
