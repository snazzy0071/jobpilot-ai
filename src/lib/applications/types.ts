// Canonical source for the job application tracker domain — mirrors
// migration 0063's real Postgres shape (public.applications /
// application_status_history / application_reminders). See that
// migration's own header comment for why this is a separate table from
// saved_jobs (src/lib/jobs/types.ts's SavedJob) rather than the same
// one with an extra status column: a wishlist bookmark and a tracked
// application are different lifecycles with different fields, and
// applications isn't tied to a synced jobs row the way a saved bookmark
// is — company/title/url are this domain's own fields, with only an
// optional link back to a real listing.

import type { JobSponsorMatchStatus } from "@/lib/jobs/sponsor-match";

export const APPLICATION_STATUSES = ["wishlist", "applied", "interview", "offer", "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/**
 * One public.applications row. `sponsorStatus`/`matchScore` are
 * snapshots resolved server-side whenever the application is saved
 * (src/lib/applications/actions.ts) — never user-typed. Before
 * `frozenAt` is set they keep reflecting live data on every save
 * (migration 0064's own comment covers why); the first time `status`
 * reaches `'applied'`, `sponsorStatus`/`matchScore`/
 * `submittedCvVersionId` are frozen and `frozenAt` is set — after
 * that, none of the four ever change again, enforced by migration
 * 0065's own trigger, not just by this app's code. `cvId` is the live
 * picker selection (can keep changing); `submittedCvVersionId` is the
 * specific CV version that was actually current the moment this
 * application was frozen — a different, historical fact `cvId` alone
 * can't represent once the CV keeps being edited afterwards.
 */
export type Application = {
  id: string;
  jobId: string | null;
  cvId: string | null;
  coverLetterId: string | null;
  companyName: string;
  jobTitle: string;
  location: string | null;
  salary: string | null;
  url: string | null;
  deadline: string | null;
  status: ApplicationStatus;
  notes: string | null;
  appliedAt: string | null;
  sponsorStatus: JobSponsorMatchStatus | null;
  matchScore: number | null;
  submittedCvVersionId: string | null;
  frozenAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** One public.application_status_history row — written by migration 0063's own trigger, never inserted directly by application code. `fromStatus` is null for the row logged when the application was first created. */
export type ApplicationStatusHistoryEntry = {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  changedAt: string;
};

// Matches migration 0066's public.reminder_delivery_status exactly.
export const REMINDER_DELIVERY_STATUSES = ["pending", "sent", "failed"] as const;
export type ReminderDeliveryStatus = (typeof REMINDER_DELIVERY_STATUSES)[number];

/**
 * One public.application_reminders row (migrations 0063/0066).
 * `completedAt` null means still outstanding — the user's own "done
 * with this reminder" state, separate from delivery: a reminder can be
 * delivered (email sent, shown in-app) and still not yet marked
 * complete, or marked complete before its delivery time even arrives
 * (the user handled it early and dismissed it).
 *
 * `emailStatus`/`inAppStatus` are null exactly when that channel
 * wasn't requested (`sendEmail`/`sendInApp` false) — migration 0066's
 * own check constraint enforces this at the DB level, not just by
 * convention. Once requested, `src/lib/applications/reminders/
 * actions.ts` sets the status to `'pending'` at creation, and the
 * dispatch job (`GET /api/cron/dispatch-reminders`) is the only thing
 * that ever moves it to `'sent'`/`'failed'`.
 */
export type ApplicationReminder = {
  id: string;
  applicationId: string;
  remindAt: string;
  message: string;
  completedAt: string | null;
  sendEmail: boolean;
  sendInApp: boolean;
  emailStatus: ReminderDeliveryStatus | null;
  emailSentAt: string | null;
  emailError: string | null;
  inAppStatus: ReminderDeliveryStatus | null;
  inAppSentAt: string | null;
  createdAt: string;
};
