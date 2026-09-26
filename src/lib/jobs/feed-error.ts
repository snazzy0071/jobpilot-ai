// What went wrong talking to a job feed, in terms the sync runner and the admin page can act on. Deliberately never
// carries the request URL: Adzuna's credentials are query parameters.

export type JobFeedErrorKind =
  | "not_configured" // credentials missing on this deployment
  | "auth" // the provider rejected the credentials (401/403)
  | "rate_limit" // 429 that outlasted the retries
  | "http" // any other non-2xx
  | "network" // timeout / connection failure
  | "bad_response"; // 2xx, but not a body this adapter understands

export class JobFeedError extends Error {
  readonly kind: JobFeedErrorKind;

  constructor(kind: JobFeedErrorKind, message: string) {
    super(message);
    this.name = "JobFeedError";
    this.kind = kind;
  }

  /** Errors that will fail identically for every remaining request in the run — stop instead of hammering the provider. */
  get isFatal(): boolean {
    return this.kind === "auth" || this.kind === "not_configured" || this.kind === "rate_limit";
  }
}
