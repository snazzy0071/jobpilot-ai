import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderEmailLayout, emailHeading, emailParagraph, emailButton } from "@/lib/email/layout";
import { siteConfig } from "@/config/site";

type DueReminderRow = {
  id: string;
  user_id: string;
  application_id: string;
  message: string;
  email_status: string | null;
  in_app_status: string | null;
  applications: { company_name: string; job_title: string } | null;
};

export type DispatchRemindersResult = {
  processed: number;
  emailsSent: number;
  emailsFailed: number;
  inAppMarked: number;
};

// How long a claimed-but-never-resolved row ('sending' with no matching
// 'sent'/'failed' follow-up — a crashed run, a route that timed out
// mid-send) sits before a later invocation is allowed to treat it as due
// again. Comfortably longer than a single dispatch run should ever take,
// short enough that a genuinely stuck reminder isn't silently lost for
// long.
const CLAIM_STALE_MS = 10 * 60 * 1000;

function buildReminderEmailHtml(companyName: string, jobTitle: string, message: string, applicationId: string): string {
  const link = `${siteConfig.domain}/dashboard/applications/${applicationId}/edit`;
  return renderEmailLayout({
    previewText: `Reminder: ${jobTitle} at ${companyName}`,
    bodyHtml: [
      emailHeading(`Reminder: ${jobTitle} at ${companyName}`),
      emailParagraph(message),
      emailButton("Open this application", link),
    ].join(""),
  });
}

/**
 * Atomically claims one reminder's email channel before anything sends —
 * an UPDATE's WHERE clause is evaluated atomically by Postgres, so of any
 * two overlapping dispatch runs racing the same row, only one can ever
 * flip `email_status` away from `'pending'` (or away from a stale
 * `'sending'`, see CLAIM_STALE_MS) and get back a matching row. The loser
 * gets `null` back and skips the row entirely — this is what makes "the
 * same reminder is not sent twice" true under concurrent invocations,
 * not just under normal single-run operation.
 *
 * Two separate conditional UPDATEs rather than one `.or()` filter string
 * — same avoidance this file already applies to its due-reminder
 * queries below, and it also doubles as the natural place to enforce
 * "only steal a stale claim, never an active one": the second attempt's
 * own `.lt("email_claimed_at", ...)` filter refuses to match a row
 * another invocation just claimed a moment ago.
 */
async function claimEmailReminder(supabase: SupabaseClient, reminderId: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const staleCutoffIso = new Date(Date.now() - CLAIM_STALE_MS).toISOString();

  const { data: claimedPending } = await supabase
    .from("application_reminders")
    .update({ email_status: "sending", email_claimed_at: nowIso })
    .eq("id", reminderId)
    .eq("email_status", "pending")
    .select("id")
    .maybeSingle();
  if (claimedPending) return true;

  const { data: claimedStale } = await supabase
    .from("application_reminders")
    .update({ email_status: "sending", email_claimed_at: nowIso })
    .eq("id", reminderId)
    .eq("email_status", "sending")
    .lt("email_claimed_at", staleCutoffIso)
    .select("id")
    .maybeSingle();
  return !!claimedStale;
}

/**
 * Finds every reminder whose `remind_at` has arrived and still has at
 * least one channel outstanding, then actually delivers it — a real
 * email via src/lib/email/resend.ts for a claimed email channel, and a
 * state flip to `'sent'` for `in_app_status = 'pending'` rows (there's
 * nothing to "send" for in-app beyond recording that the moment arrived
 * — that recorded state is what makes a reminder show as due wherever
 * the UI already lists reminders; migration 0066's own comment covers
 * why a cron-driven write is used here rather than a value computed live
 * on every render: it's a real, auditable record of *when* delivery
 * happened, not just a derived boolean).
 *
 * Runs on the service-role client (src/lib/supabase/admin.ts) since
 * this processes reminders across every user, not one authenticated
 * session — same reasoning every other cross-user cron job this session
 * uses it for (Adzuna/Reed sync, jobs maintenance).
 *
 * Separate `.eq()`-filtered queries merged in memory, not one `.or()`
 * filter string — a reminder can be due for email, in-app, or both
 * (and, since migration 0084, a stale in-flight email claim is due
 * again too), and this needs to process whichever combination is true
 * for each row without a hand-built PostgREST filter, same avoidance
 * this codebase applies everywhere a `.or()` might otherwise be reached
 * for.
 */
export async function dispatchDueReminders(): Promise<DispatchRemindersResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const staleCutoffIso = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
  const selectFields = "id, user_id, application_id, message, email_status, in_app_status, applications(company_name, job_title)";

  const [pendingEmailDue, staleSendingEmailDue, inAppDue] = await Promise.all([
    supabase.from("application_reminders").select(selectFields).lte("remind_at", nowIso).is("completed_at", null).eq("email_status", "pending"),
    supabase
      .from("application_reminders")
      .select(selectFields)
      .lte("remind_at", nowIso)
      .is("completed_at", null)
      .eq("email_status", "sending")
      .lt("email_claimed_at", staleCutoffIso),
    supabase.from("application_reminders").select(selectFields).lte("remind_at", nowIso).is("completed_at", null).eq("in_app_status", "pending"),
  ]);

  const merged = new Map<string, DueReminderRow>();
  for (const row of [...(pendingEmailDue.data ?? []), ...(staleSendingEmailDue.data ?? []), ...(inAppDue.data ?? [])] as unknown as DueReminderRow[]) {
    merged.set(row.id, row);
  }

  let emailsSent = 0;
  let emailsFailed = 0;
  let inAppMarked = 0;

  for (const reminder of merged.values()) {
    if (reminder.email_status === "pending" || reminder.email_status === "sending") {
      const claimed = await claimEmailReminder(supabase, reminder.id);
      if (claimed) {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(reminder.user_id);
          const to = authUser?.user?.email;
          if (!to) throw new Error("No email address on file for this user.");

          await sendEmail({
            to,
            subject: `Reminder: ${reminder.applications?.job_title ?? "your application"} at ${reminder.applications?.company_name ?? ""}`,
            html: buildReminderEmailHtml(
              reminder.applications?.company_name ?? "this employer",
              reminder.applications?.job_title ?? "this role",
              reminder.message,
              reminder.application_id,
            ),
            template: "application_reminder",
          });
          await supabase
            .from("application_reminders")
            .update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null })
            .eq("id", reminder.id);
          emailsSent++;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Couldn't send this reminder email.";
          await supabase
            .from("application_reminders")
            .update({ email_status: "failed", email_error: message.slice(0, 500) })
            .eq("id", reminder.id);
          emailsFailed++;
        }
      }
    }

    if (reminder.in_app_status === "pending") {
      const { data: claimedInApp } = await supabase
        .from("application_reminders")
        .update({ in_app_status: "sent", in_app_sent_at: new Date().toISOString() })
        .eq("id", reminder.id)
        .eq("in_app_status", "pending")
        .select("id")
        .maybeSingle();
      if (claimedInApp) inAppMarked++;
    }
  }

  return { processed: merged.size, emailsSent, emailsFailed, inAppMarked };
}
