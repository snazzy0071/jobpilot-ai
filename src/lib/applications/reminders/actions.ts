"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { trackerBlocked } from "@/lib/applications/access";
import { createClient } from "@/lib/supabase/server";
import { getApplicationById } from "@/lib/applications/queries";
import { createReminderSchema, deleteReminderSchema, completeReminderSchema } from "@/lib/applications/reminders/schemas";
import type { ApplicationReminder } from "@/lib/applications/types";

export type ReminderActionResult = { error: string } | { reminder: ApplicationReminder };
export type ReminderMutationResult = { error: string } | { success: string } | void;

/**
 * `email_status`/`in_app_status` are set to `'pending'` here, right at
 * creation, for whichever channel is actually requested — never left
 * null-then-implied, so the dispatch job (`GET /api/cron/dispatch-
 * reminders`) has a real, queryable "still needs sending" state to
 * look for rather than inferring it from `send_email`/`send_in_app`
 * alone every time.
 */
export async function createReminder(formData: FormData): Promise<ReminderActionResult> {
  const user = await requireUser();
  const blocked = await trackerBlocked(user.id);
  if (blocked) return blocked;

  const parsed = createReminderSchema.safeParse({
    applicationId: formData.get("applicationId"),
    remindAt: formData.get("remindAt"),
    message: formData.get("message"),
    sendEmail: formData.get("sendEmail") === "on",
    sendInApp: formData.get("sendInApp") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const application = await getApplicationById(user.id, parsed.data.applicationId);
  if (!application) return { error: "That application couldn't be found." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("application_reminders")
    .insert({
      application_id: parsed.data.applicationId,
      user_id: user.id,
      remind_at: parsed.data.remindAt,
      message: parsed.data.message,
      send_email: parsed.data.sendEmail,
      send_in_app: parsed.data.sendInApp,
      email_status: parsed.data.sendEmail ? "pending" : null,
      in_app_status: parsed.data.sendInApp ? "pending" : null,
    })
    .select(
      "id, application_id, remind_at, message, completed_at, send_email, send_in_app, email_status, email_sent_at, email_error, in_app_status, in_app_sent_at, created_at",
    )
    .single();

  if (error || !data) return { error: "Couldn't save that reminder — try again." };

  revalidatePath("/dashboard/applications");
  revalidatePath(`/dashboard/applications/${parsed.data.applicationId}/edit`);
  return {
    reminder: {
      id: data.id,
      applicationId: data.application_id,
      remindAt: data.remind_at,
      message: data.message,
      completedAt: data.completed_at,
      sendEmail: data.send_email,
      sendInApp: data.send_in_app,
      emailStatus: data.email_status,
      emailSentAt: data.email_sent_at,
      emailError: data.email_error,
      inAppStatus: data.in_app_status,
      inAppSentAt: data.in_app_sent_at,
      createdAt: data.created_at,
    },
  };
}

export async function completeReminder(
  _prevState: ReminderMutationResult,
  formData: FormData,
): Promise<ReminderMutationResult> {
  const user = await requireUser();
  const blocked = await trackerBlocked(user.id);
  if (blocked) return blocked;

  const parsed = completeReminderSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("application_reminders")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("completed_at", null);

  if (error) return { error: "Couldn't update that reminder — try again." };

  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/applications/[id]/edit", "page");
  return { success: "Marked done." };
}

export async function deleteReminder(
  _prevState: ReminderMutationResult,
  formData: FormData,
): Promise<ReminderMutationResult> {
  const user = await requireUser();
  const blocked = await trackerBlocked(user.id);
  if (blocked) return blocked;

  const parsed = deleteReminderSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.from("application_reminders").delete().eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return { error: "Couldn't delete that reminder — try again." };

  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/applications/[id]/edit", "page");
  return { success: "Deleted." };
}
