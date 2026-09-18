import { getAdminClient } from "./admin-client";

// Every E2E-created account uses this prefix + domain, nowhere else in
// the app — a cheap, visible way to confirm (e.g. from the Supabase
// dashboard) that nothing this suite creates could ever be mistaken for
// a real signup, and a fallback grep target if a test's own cleanup
// ever fails to run (a crashed run, a killed process).
const TEST_EMAIL_DOMAIN = "e2e.jobpilotai.test";

export type IsolatedUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Creates a real, pre-confirmed Supabase Auth user directly via the
 * admin API (`email_confirm: true`) — bypassing the app's own email-
 * confirmation step, which is exactly what every flow *except* the
 * signup spec itself needs: login/onboarding/CV/tracker/settings tests
 * are testing what happens *after* a real account exists, not signup's
 * own confirmation email (which this sandbox has no inbox to check
 * anyway — no RESEND_API_KEY is configured). Firing the real
 * `handle_new_user()` trigger this way (not a hand-built `profiles`
 * row) means every test exercises the actual signup-time provisioning
 * path, same reasoning supabase/tests/00_helpers.sql's own
 * `tests.create_user()` gives for pgTAP fixtures.
 */
export async function createIsolatedUser(overrides: { fullName?: string } = {}): Promise<IsolatedUser> {
  const admin = getAdminClient();
  const suffix = uniqueSuffix();
  const email = `e2e+${suffix}@${TEST_EMAIL_DOMAIN}`;
  const password = `E2e-Test-${suffix}!`;
  const fullName = overrides.fullName ?? `E2E Test User ${suffix}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    throw new Error(`e2e/support/test-user.ts: failed to create an isolated test user: ${error?.message}`);
  }

  return { id: data.user.id, email, password, fullName };
}

/**
 * Deletes the auth.users row — every table this suite's flows can
 * possibly write to (cvs, cv_versions and every section table,
 * applications, cover_letters, subscriptions, ...) references it with
 * `on delete cascade` (confirmed across the schema this project's own
 * pgTAP suite already relies on the same way), so this one call is the
 * full teardown: no per-table cleanup list to keep in sync here.
 */
export async function deleteIsolatedUser(userId: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    // Never fail a test's teardown over this — a leaked e2e.jobpilotai.test
    // account is a cheap, clearly-labeled cleanup item, not a reason to
    // mask whatever the test itself already found.
    console.error(`e2e/support/test-user.ts: failed to delete isolated test user ${userId}: ${error.message}`);
  }
}

/** Only used by the signup spec — that flow doesn't get a user id back from `createIsolatedUser` (it creates the account through the real signup form, not the admin API), so cleanup has to look it up by the same unique email afterward. */
export async function deleteIsolatedUserByEmail(email: string): Promise<void> {
  const admin = getAdminClient();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return;
    const match = data.users.find((user) => user.email === email);
    if (match) {
      await deleteIsolatedUser(match.id);
      return;
    }
    if (data.users.length < perPage) return; // no more pages
    page += 1;
  }
}

export function uniqueEmail(): string {
  return `e2e+${uniqueSuffix()}@${TEST_EMAIL_DOMAIN}`;
}
