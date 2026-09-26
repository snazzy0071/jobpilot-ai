// Assisted Auto-Apply (migration 0118). "Assisted" is the whole design: JobPilot finds jobs that fit the user's own rules and
// prepares each application, but nothing is applied for until the user has reviewed and approved THAT application, and where a site
// can't be applied to by software the user is handed the link to do it themselves.

export const QUEUE_STATUSES = ["pending_review", "approved", "processing", "needs_manual", "applied", "failed", "skipped", "cancelled"] as const;
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  pending_review: "Waiting for your review",
  approved: "Approved",
  processing: "In progress",
  needs_manual: "Apply yourself",
  applied: "Applied",
  failed: "Couldn't be completed",
  skipped: "Skipped",
  cancelled: "Cancelled",
};

/** Statuses that are finished — never processed again. */
export const TERMINAL_STATUSES: readonly QueueStatus[] = ["applied", "failed", "skipped", "cancelled"];

/** The fixed limits (mirrored by migration 0118's checks and the settings schema). */
export const LIMITS = { minScore: 50, maxScore: 100, maxDaily: 25, maxKeywords: 10, maxLocations: 10, maxPending: 50, maxAttempts: 3 } as const;

/** Bump when the wording the user agrees to changes, so consent is recorded against what they actually saw. */
export const CONSENT_VERSION = "2026-09";

export type AutoApplySettings = {
  enabled: boolean;
  paused: boolean;
  minMatchScore: number;
  roleKeywords: string[];
  locations: string[];
  minSalary: number | null;
  includeUnknownSalary: boolean;
  sponsorOnly: boolean;
  dailyLimit: number;
  cvId: string | null;
  coverLetterId: string | null;
  consentAt: string | null;
  consentVersion: string | null;
};

export const DEFAULT_SETTINGS: AutoApplySettings = {
  enabled: false,
  paused: false,
  minMatchScore: 75,
  roleKeywords: [],
  locations: [],
  minSalary: null,
  includeUnknownSalary: true,
  sponsorOnly: false,
  dailyLimit: 5,
  cvId: null,
  coverLetterId: null,
  consentAt: null,
  consentVersion: null,
};

export type QueueItem = {
  id: string;
  jobId: string | null;
  companyName: string;
  jobTitle: string;
  location: string | null;
  applyUrl: string;
  status: QueueStatus;
  matchScore: number | null;
  sponsorStatus: string | null;
  cvId: string | null;
  coverLetterId: string | null;
  adapter: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  applicationId: string | null;
  approvedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
};

export type QueueEvent = { id: string; queueId: string | null; event: string; detail: Record<string, unknown>; createdAt: string };

/** Everything the rules need to know about one job, gathered before deciding. `salaryMin` is null whenever the listing doesn't say. */
export type JobFacts = {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  applyUrl: string;
  matchScore: number | null;
  sponsorConfirmed: boolean;
  salaryMin: number | null;
  active: boolean;
};
