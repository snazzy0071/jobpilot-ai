// The adapter contract. An adapter is the ONLY thing that knows how to get an application to one kind of destination, so supporting a
// new site means adding one adapter — the queue, review, consent, limits, retries, tracker logging and audit are all shared.
//
// Rules every adapter must follow (the runner enforces the consequences):
//  - Only apply through a route the destination offers for this purpose (an official API, a documented email address, a partner
//    programme). Never automate a website's own forms in a way its terms or protections forbid.
//  - If the destination shows a CAPTCHA, a bot check, a login wall or any other protection, return `blocked`. The runner then hands
//    the application to the user to do themselves and NEVER retries or works around it.
//  - Never put CV text, cover-letter text or credentials into an error message: `reason` is stored and shown to the user.

export type ApplyPackage = {
  queueId: string;
  applyUrl: string;
  companyName: string;
  jobTitle: string;
  /** The CV / cover letter the user chose for this application (ids only — an adapter that needs the content fetches it itself). */
  cvId: string | null;
  coverLetterId: string | null;
};

export type AdapterOutcome =
  /** Sent. `reference` is whatever confirmation the destination gave, if any. */
  | { kind: "submitted"; reference?: string }
  /** This destination can't be applied to by software: the user must apply themselves. Not a failure. */
  | { kind: "manual_required"; reason: string }
  /** A protection (CAPTCHA, bot check, login wall) was met. Never retried, never bypassed. */
  | { kind: "blocked"; reason: string }
  /** A temporary problem (timeout, 5xx, rate limit): worth another try later. */
  | { kind: "retryable_error"; reason: string }
  /** It will never work for this job (e.g. the listing has gone). */
  | { kind: "permanent_error"; reason: string };

export interface ApplyAdapter {
  id: string;
  label: string;
  /** Whether this adapter can send an application without the user doing it. The assisted fallback cannot. */
  canSubmit: boolean;
  /** Whether this adapter handles this destination at all. */
  supports(applyUrl: string): boolean;
  apply(pkg: ApplyPackage): Promise<AdapterOutcome>;
}
