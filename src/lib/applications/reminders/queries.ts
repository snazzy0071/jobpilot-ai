import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationReminder } from "@/lib/applications/types";

const REMINDER_SELECT_FIELDS =
  "id, application_id, remind_at, message, completed_at, send_email, send_in_app, email_status, email_sent_at, email_error, in_app_status, in_app_sent_at, created_at";

type ReminderRow = {
  id: string;
  application_id: string;
  remind_at: string;
  message: string;
  completed_at: string | null;
  send_email: boolean;
  send_in_app: boolean;
  email_status: ApplicationReminder["emailStatus"];
  email_sent_at: string | null;
  email_error: string | null;
  in_app_status: ApplicationReminder["inAppStatus"];
  in_app_sent_at: string | null;
  created_at: string;
};

function toReminder(row: ReminderRow): ApplicationReminder {
  return {
    id: row.id,
    applicationId: row.application_id,
    remindAt: row.remind_at,
    message: row.message,
    completedAt: row.completed_at,
    sendEmail: row.send_email,
    sendInApp: row.send_in_app,
    emailStatus: row.email_status,
    emailSentAt: row.email_sent_at,
    emailError: row.email_error,
    inAppStatus: row.in_app_status,
    inAppSentAt: row.in_app_sent_at,
    createdAt: row.created_at,
  };
}

/** Every reminder for one application, soonest-due first — the edit page's own reminders panel. RLS (`auth.uid() = user_id`) already scopes this to the requesting session. */
export async function listRemindersForApplication(applicationId: string): Promise<ApplicationReminder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("application_reminders")
    .select(REMINDER_SELECT_FIELDS)
    .eq("application_id", applicationId)
    .order("remind_at", { ascending: true });
  if (error || !data) return [];
  return data.map(toReminder);
}

export type ReminderSummary = { open: number; overdue: number };

/** Open (not done) reminders per application, with how many are already past due: the badge on each tracker card. One query for the whole board. */
export async function getReminderSummaryByApplication(userId: string): Promise<Record<string, ReminderSummary>> {
  const supabase = await createClient();
  const { data } = await supabase.from("application_reminders").select("application_id, remind_at").eq("user_id", userId).is("completed_at", null);
  const now = Date.now();
  const summary: Record<string, ReminderSummary> = {};
  for (const row of data ?? []) {
    const entry = (summary[row.application_id] ??= { open: 0, overdue: 0 });
    entry.open++;
    if (new Date(row.remind_at).getTime() <= now) entry.overdue++;
  }
  return summary;
}

export type DueReminder = {
  id: string;
  applicationId: string;
  message: string;
  remindAt: string;
  companyName: string;
  jobTitle: string;
};

/**
 * Reminders that have come due and are not done, for the in-app channel. "Due" is read from remind_at itself, so it
 * shows the moment the time passes whether or not the delivery job has run yet (the job records that it delivered; it
 * is not what makes a reminder appear).
 */
export async function listDueInAppReminders(userId: string): Promise<DueReminder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("application_reminders")
    .select("id, application_id, message, remind_at, applications(company_name, job_title)")
    .eq("user_id", userId)
    .eq("send_in_app", true)
    .is("completed_at", null)
    .lte("remind_at", new Date().toISOString())
    .order("remind_at", { ascending: true });
  if (error || !data) return [];
  return data.map((row) => {
    const application = (Array.isArray(row.applications) ? row.applications[0] : row.applications) as { company_name: string; job_title: string } | null;
    return {
      id: row.id,
      applicationId: row.application_id,
      message: row.message,
      remindAt: row.remind_at,
      companyName: application?.company_name ?? "",
      jobTitle: application?.job_title ?? "",
    };
  });
}
