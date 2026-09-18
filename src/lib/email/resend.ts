import "server-only";
import { Resend } from "resend";
import { getEmailEnv } from "@/lib/email/env";
import { createAdminClient } from "@/lib/supabase/admin";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) client = new Resend(getEmailEnv().RESEND_API_KEY);
  return client;
}

export type EmailAttachment = { filename: string; content: Buffer };

const MAX_ATTEMPTS = 3;
// Between attempt 1->2 and 2->3 — short on purpose, since this runs
// inline inside whatever Server Action/route called sendEmail() and
// that caller is waiting on it; this isn't a background queue with
// room for minutes-long backoff.
const RETRY_DELAY_MS = [500, 1500];

// Resend's own documented error codes
// (https://resend.com/docs/api-reference/errors), classified once
// here rather than guessed at each call site. Only these four are
// genuinely transient — a rate limit, a concurrent-idempotency clash,
// or a server-side fault that might not recur a moment later.
// Everything else in Resend's taxonomy (a malformed address, a bad or
// missing API key, a monthly/daily quota already exhausted, a
// validation failure) is permanent for the lifetime of this call:
// retrying changes nothing about a request that's wrong in the same
// way every time, so those fail on the first attempt instead of
// wasting the two retries below on a guaranteed repeat.
const RETRYABLE_ERROR_NAMES = new Set(["rate_limit_exceeded", "concurrent_idempotent_requests", "internal_server_error", "application_error"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Best-effort by design, same reasoning src/lib/admin/audit/log.ts's
 * own logAdminAction() documents: a logging failure must never make a
 * real email send (already succeeded or already exhausted its
 * retries) look like something else went wrong to the caller. Only
 * "safe" fields ever reach this table (migration 0081's own comment)
 * — recipient, template key, outcome, attempt count, and Resend's own
 * short error code — never the subject or HTML body, either of which
 * could carry content specific to that email.
 */
async function logEmailSend(params: {
  recipient: string;
  template: string;
  status: "sent" | "failed";
  attempts: number;
  errorName?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("email_send_logs").insert({
      recipient: params.recipient,
      template: params.template,
      status: params.status,
      attempts: params.attempts,
      error_name: params.errorName ?? null,
    });
  } catch (err) {
    console.error("logEmailSend failed:", err);
  }
}

/**
 * The one place this app sends real email — every caller already goes
 * through this, so retrying transient Resend failures and recording
 * every attempt to `email_send_logs` (migration 0081) is a real
 * improvement for existing call sites, not something they need to
 * change to get. Still throws once every attempt is exhausted or the
 * failure is a permanent one, exactly as before — every caller's own
 * try/catch (or deliberate "best-effort, log and move on" choice, e.g.
 * src/lib/quick-scan/send-report-email.ts's own comment on why a
 * failure here must never undo an already-shown result) keeps working
 * unchanged.
 *
 * `template` is a short, caller-chosen key ("application_reminder",
 * "institution_invite", "quick_scan_report") identifying which email
 * this is for later triage at /admin/email-logs — not the subject
 * line, which can vary per send (e.g. it embeds a score) in a way the
 * log table deliberately doesn't need to retain.
 */
export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  template: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const resend = getClient();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { error } = await resend.emails.send({
      from: getEmailEnv().RESEND_FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });

    if (!error) {
      await logEmailSend({ recipient: options.to, template: options.template, status: "sent", attempts: attempt });
      return;
    }

    const isLastAttempt = attempt === MAX_ATTEMPTS;
    const isRetryable = RETRYABLE_ERROR_NAMES.has(error.name);
    if (isLastAttempt || !isRetryable) {
      await logEmailSend({ recipient: options.to, template: options.template, status: "failed", attempts: attempt, errorName: error.name });
      throw new Error(`Resend error: ${error.message}`);
    }

    await sleep(RETRY_DELAY_MS[attempt - 1]);
  }
}
