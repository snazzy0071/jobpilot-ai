import "server-only";
import type { User } from "@supabase/supabase-js";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";

export type DataExportPayload = {
  exportedAt: string;
  account: { id: string; email: string | null | undefined; createdAt: string };
  profile: unknown;
  preferences: unknown;
  applications: unknown[];
  applicationStatusHistory: unknown[];
  applicationReminders: unknown[];
};

/**
 * Every table here is scoped to `user_id`/`id` = the caller's own id
 * even though RLS (`auth.uid() = user_id` on every one of these tables)
 * already guarantees the same result — defence in depth, same reasoning
 * src/lib/applications/queries.ts's own listApplications already gives.
 * Raw `select("*")` rather than this app's own mapped camelCase types: a
 * GDPR export should show the real stored record, not a client-shaped
 * view of it.
 *
 * "User-owned application data" here means the Tracker (`applications`,
 * `application_status_history`, `application_reminders` — migrations
 * 0063/0066), not every table this account has ever touched across the
 * whole product.
 */
export async function buildDataExportPayload(user: User): Promise<DataExportPayload> {
  const supabase = await createClient();

  const [{ data: profile }, { data: preferences }, { data: applications }, { data: applicationStatusHistory }, { data: applicationReminders }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("user_preferences").select("*").eq("id", user.id).single(),
      supabase.from("applications").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
      supabase.from("application_status_history").select("*").eq("user_id", user.id).order("changed_at", { ascending: true }),
      supabase.from("application_reminders").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    profile,
    preferences,
    applications: applications ?? [],
    applicationStatusHistory: applicationStatusHistory ?? [],
    applicationReminders: applicationReminders ?? [],
  };
}

/**
 * One JSON file per category rather than one undifferentiated blob —
 * the conventional shape a portable subject-access export takes, and
 * easier for someone to actually open and read than a single large file.
 */
export async function buildDataExportZip(payload: DataExportPayload): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "account-and-profile.json",
    JSON.stringify(
      { exportedAt: payload.exportedAt, account: payload.account, profile: payload.profile, preferences: payload.preferences },
      null,
      2,
    ),
  );
  zip.file("applications.json", JSON.stringify(payload.applications, null, 2));
  zip.file("application_status_history.json", JSON.stringify(payload.applicationStatusHistory, null, 2));
  zip.file("application_reminders.json", JSON.stringify(payload.applicationReminders, null, 2));
  return zip.generateAsync({ type: "nodebuffer" });
}
