import "server-only";
import type { User } from "@supabase/supabase-js";
import JSZip from "jszip";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXPORT_TABLES, EXPORT_EXCLUDED_TABLES } from "@/lib/settings/export-tables";

export { EXPORT_TABLES, EXPORT_EXCLUDED_TABLES };

export type DataExportPayload = {
  exportedAt: string;
  account: { id: string; email: string | null | undefined; createdAt: string; lastSignInAt: string | null | undefined; signInMethods: string[] };
  profile: unknown;
  preferences: unknown;
  /** Every table that holds this person's data, keyed by table name (see export-tables.ts). */
  data: Record<string, unknown[]>;
  /** Records kept against the email address rather than the account: newsletter subscription, messages sent through the contact form, emails we sent. */
  emailKeyed: { newsletterSubscription: unknown[]; contactMessages: unknown[]; demoRequests: unknown[]; partnerInquiries: unknown[]; campusCrewApplications: unknown[]; emailsSent: unknown[] };
  /** Each time an administrator viewed this account (read-only "view as user"): when, and how it ended. The administrator is not named here. */
  accountAccessBySupport: unknown[];
  /** What is deliberately not in this file, and why. */
  notIncluded: { table: string; reason: string }[];
};

const PAGE = 1000;
const MAX_PAGES = 200;

/** Reads every row for one filter, page by page (the API returns at most 1000 rows per request, so a single select would silently truncate a large history). */
async function fetchAll(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, label: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await query(page * PAGE, page * PAGE + PAGE - 1);
    // A failed read must never produce a smaller "complete" export.
    if (error) throw new Error(`Data export failed while reading ${label}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/**
 * The person's complete data (GDPR Articles 15 and 20): every table that stores something against their account, not just the
 * application tracker. Each read is scoped to this user's id explicitly. It uses the service-role client because a few of these
 * tables (billing history, AI usage records, memberships) are deliberately not readable by the user through the API, yet are
 * still their personal data. The route is behind requireUser(), and `user` comes from that session, never from the request.
 * Raw `select("*")`: an export shows the real stored record, not a client-shaped view of it.
 */
export async function buildDataExportPayload(user: User): Promise<DataExportPayload> {
  const admin = createAdminClient();
  const email = user.email?.toLowerCase() ?? null;
  // Forms store the address as typed, so match the stored form and the lower-case one (exact matches only, never a pattern).
  const addressVariants = [...new Set([user.email ?? "", email ?? ""].filter(Boolean))];

  const [{ data: profile }, { data: preferences }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    admin.from("user_preferences").select("*").eq("id", user.id).maybeSingle(),
  ]);

  const entries = await Promise.all(
    EXPORT_TABLES.map(async ({ table, orderBy }) => [table, await fetchAll((from, to) => admin.from(table).select("*").eq("user_id", user.id).order(orderBy ?? "id", { ascending: true }).range(from, to), table)] as const),
  );

  const byEmail = async (table: string, column: string, order: string) =>
    email ? fetchAll((from, to) => admin.from(table).select("*").in(column, addressVariants).order(order, { ascending: true }).range(from, to), table) : [];

  const accountAccessBySupport = (
    await fetchAll((from, to) => admin.from("admin_impersonation_sessions").select("started_at, ended_at, end_reason").eq("target_user_id", user.id).order("id", { ascending: true }).range(from, to), "admin_impersonation_sessions")
  );

  const [newsletterSubscription, contactMessages, demoRequests, partnerInquiries, campusCrewApplications, emailsSent] = await Promise.all([
    byEmail("newsletter_subscribers", "email", "id"),
    byEmail("contact_messages", "email", "id"),
    byEmail("demo_requests", "email", "id"),
    byEmail("partner_inquiries", "email", "id"),
    byEmail("campus_crew_applications", "email", "id"),
    byEmail("email_send_logs", "recipient", "id"),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      signInMethods: (user.identities ?? []).map((identity) => identity.provider),
    },
    profile,
    preferences,
    data: Object.fromEntries(entries),
    emailKeyed: { newsletterSubscription, contactMessages, demoRequests, partnerInquiries, campusCrewApplications, emailsSent },
    accountAccessBySupport,
    notIncluded: EXPORT_EXCLUDED_TABLES.map(({ table, reason }) => ({ table, reason })),
  };
}

/**
 * One JSON file per category rather than one undifferentiated blob: the conventional shape a portable subject-access export takes,
 * and easier to open and read than a single large file.
 */
export async function buildDataExportZip(payload: DataExportPayload): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "account-and-profile.json",
    JSON.stringify({ exportedAt: payload.exportedAt, account: payload.account, profile: payload.profile, preferences: payload.preferences, notIncluded: payload.notIncluded }, null, 2),
  );
  for (const [table, rows] of Object.entries(payload.data)) zip.file(`${table}.json`, JSON.stringify(rows, null, 2));
  zip.file("account-access-by-support.json", JSON.stringify(payload.accountAccessBySupport, null, 2));
  zip.file("email-keyed-records.json", JSON.stringify(payload.emailKeyed, null, 2));
  return zip.generateAsync({ type: "nodebuffer" });
}
