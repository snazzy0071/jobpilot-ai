// Promotes an EXISTING Supabase-auth user to this app's 'admin' role —
// an operational/ops action, not a feature of the app itself.
// `profiles.role` is still a fixed Postgres enum with exactly three
// values — 'user', 'institution_admin', 'admin' (migrations
// 0001_profiles.sql / 0007_institution_admin_role.sql) — and this
// script promotes to 'admin', the highest one that exists; it does not
// invent a new profiles.role value. What sits *on top of* that now
// (migration 0075_admin_roles.sql) is configurable: which specific
// admin sections a staff account can use, via admin_roles/
// admin_user_roles (src/lib/admin/permissions.ts) — 'admin' alone no
// longer implies access to every admin page, so this script also grants
// the 'super_admin' admin role (full access) after promoting, or when
// re-run against an account that was already 'admin' but is missing
// it. See docs/ADMIN_PROMOTION.md for the full picture (how admin auth
// works, a known RLS caveat worth knowing about, and the equivalent
// raw-SQL process for the Supabase SQL editor) — that doc predates the
// admin_roles layer and should be read alongside this comment, not in
// place of it.
//
// Deliberately does NOT:
//   - create a user, set a password, or touch auth.users at all — the
//     target must already have a real account (sign-up or OAuth). This
//     only changes which role their EXISTING session is checked
//     against; requireAdmin() (src/lib/auth/session.ts) reads
//     profiles.role fresh on every request, so the change takes effect
//     on their very next page load — no re-login, no new token needed.
//   - bypass login/auth in any way — it writes through the Supabase
//     service-role key (the same privileged, server-only credential
//     every other trusted write in this app already uses — Stripe
//     webhooks, the sponsor register importer, etc.), never through a
//     Server Action or route reachable by a signed-in user's own
//     session. Nothing about how requireUser()/requireAdmin() work
//     changes.
//
// Usage:
//   node --env-file=.env.local scripts/promote-admin.mjs --email <email>
//   node --env-file=.env.local scripts/promote-admin.mjs --user-id <uuid>
//
// Safe by default: without --confirm, this only looks the user up and
// prints what WOULD change — no write happens. Add --confirm to apply
// it for real.
//
//   --email <email>     Look up the user by email (case-insensitive).
//   --user-id <uuid>     Look up the user by id directly (skips lookup —
//                         use this if you already know it, or if the
//                         account count makes email lookup slow).
//   --confirm             Actually perform the update. Omit to dry-run.

import { createClient } from "@supabase/supabase-js";

const LIST_USERS_PAGE_SIZE = 1000;
const MAX_LIST_USERS_PAGES = 20; // 20,000 users — well beyond anything this pre-launch app has; --user-id is the documented escape hatch beyond that.
const TARGET_ROLE = "admin";

function parseArgs(argv) {
  const args = { email: null, userId: null, confirm: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") args.email = argv[++i];
    else if (arg === "--user-id") args.userId = argv[++i];
    else if (arg === "--confirm") args.confirm = true;
    else {
      console.error(`Unrecognised argument: ${arg}`);
      process.exit(1);
    }
  }
  if (!args.email && !args.userId) {
    console.error("Pass --email <email> or --user-id <uuid>.");
    process.exit(1);
  }
  if (args.email && args.userId) {
    console.error("Pass only one of --email or --user-id, not both.");
    process.exit(1);
  }
  return args;
}

/** Paginates auth.admin.listUsers() looking for a case-insensitive email match — the supabase-js admin client has no typed "filter by email" param, so this is the version-independent way to find one reliably. */
async function findUserByEmail(supabase, email) {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= MAX_LIST_USERS_PAGES; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: LIST_USERS_PAGE_SIZE });
    if (error) throw new Error(`Looking up users failed: ${error.message}`);
    const match = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match;
    if (data.users.length < LIST_USERS_PAGE_SIZE) break; // Last page.
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    console.error("Copy .env.example to .env.local and fill in your project's values.");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // ---- Resolve the target user ----
  let userId = args.userId;
  let email = null;
  if (args.email) {
    console.log(`Looking up ${args.email} ...`);
    const user = await findUserByEmail(supabase, args.email);
    if (!user) {
      console.error(`No auth user found with email ${args.email}. This script never creates a user — sign up first.`);
      process.exit(1);
    }
    userId = user.id;
    email = user.email;
  } else {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user) {
      console.error(`No auth user found with id ${userId}. This script never creates a user — sign up first.`);
      process.exit(1);
    }
    email = data.user.email;
  }

  // ---- Read the current profile ----
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(`Reading the profile failed: ${profileError.message}`);
  if (!profile) {
    console.error(`Auth user ${userId} (${email}) has no profiles row — this shouldn't happen for a real signed-up user.`);
    process.exit(1);
  }

  console.log(`\nUser: ${email} (${userId})`);
  console.log(`Name: ${profile.full_name ?? "(none)"}`);
  console.log(`Current role: ${profile.role}`);
  console.log(`Target role:  ${TARGET_ROLE}`);

  const alreadyAtTargetRole = profile.role === TARGET_ROLE;
  if (alreadyAtTargetRole) {
    console.log("\nAlready at the target role.");
  }

  if (!args.confirm) {
    console.log("\nDry run — no change made. Re-run with --confirm to apply this.");
    return;
  }

  // ---- Apply, via the service role — bypasses RLS by design, the same
  // privileged path every other trusted write in this app already uses.
  if (!alreadyAtTargetRole) {
    const { error: updateError } = await supabase.from("profiles").update({ role: TARGET_ROLE }).eq("id", userId);
    if (updateError) throw new Error(`Updating the role failed: ${updateError.message}`);
    console.log(`\nDone — ${email} is now '${TARGET_ROLE}'. Effective on their next request (no re-login needed).`);
  }

  await grantSuperAdminIfMissing(supabase, userId, email);
}

/**
 * Configurable admin RBAC (migration 0075_admin_roles.sql) layers *on
 * top of* profiles.role — being 'admin' is the coarse "is this
 * account staff at all" gate this script has always set, but every
 * specific admin section is now also gated by a permission
 * (src/lib/admin/permissions.ts). Without this, promoting someone here
 * would leave them stuck on the bare admin overview with no admin_role
 * granting them access to anything under it. Runs whether this
 * invocation just promoted the account or found it already promoted,
 * so re-running this script is also the fix for "I'm admin but I can't
 * see any admin pages". Never throws on its own — a missing
 * super_admin role (e.g. renamed or deleted via /admin/roles) means
 * grant the account a role manually instead, not that this script
 * should fail the promotion it already successfully made.
 */
async function grantSuperAdminIfMissing(supabase, userId, email) {
  const { data: role, error: roleError } = await supabase.from("admin_roles").select("id").eq("slug", "super_admin").maybeSingle();
  if (roleError || !role) {
    console.warn(
      "\nCouldn't find the 'super_admin' admin role (has it been renamed or removed?) — grant a role manually at /admin/roles.",
    );
    return;
  }

  const { error: grantError } = await supabase
    .from("admin_user_roles")
    .upsert({ user_id: userId, admin_role_id: role.id }, { onConflict: "user_id,admin_role_id", ignoreDuplicates: true });
  if (grantError) {
    console.warn(`\nCouldn't grant the 'super_admin' role automatically (${grantError.message}) — grant it manually at /admin/roles.`);
    return;
  }

  console.log(`${email} holds the 'super_admin' admin role (full access to every admin section).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
