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
