// Creates (or reuses) a JobPilot AI auth user through the Supabase
// Admin API, and ensures their `public.profiles` row exists with the
// requested role — an operational/ops action, not a feature of the app
// itself. Does not touch any migration or the auth architecture: role
// enforcement is exactly what supabase/migrations/0001_profiles.sql
// through 0051_profiles_role_immutable.sql already define
// ('user'/'institution_admin'/'admin'; profiles.role only ever writable
// by a privileged Postgres role, never by the anon/authenticated roles a
// signed-in user's own session runs as). This script writes through the
// Supabase service-role key, the same privileged, server-only credential
// every other trusted write in this app already uses (Stripe webhooks,
// the sponsor-register importer, scripts/promote-admin.mjs) — never
// through a Server Action, never bundled into anything client-side.
//
// Safety properties:
//   - Never hardcodes a credential. NEXT_PUBLIC_SUPABASE_URL and
//     SUPABASE_SERVICE_ROLE_KEY come from the environment (.env.local
//     via --env-file, same as every other script here); the service-role
//     key only ever exists in this standalone Node process's env, never
//     in a bundle a browser could load.
//   - The password comes from the TEMP_USER_PASSWORD environment
//     variable, never a CLI argument — a value passed on the command
//     line ends up in shell history and `ps`/process-list output on most
//     systems; an env var set for one command doesn't.
//   - Never prints the password, in any code path, including errors.
//   - Safe by default: without --confirm, this only looks the user up
//     and prints what WOULD happen — no auth user is created, no profile
//     is written. Add --confirm to apply it for real.
//   - If an auth user with the given email already exists, it is never
//     recreated — this script only ensures their profile exists and
//     sets its role, exactly as the task requires.
//   - Fails fast, before any network call, if a required env var/arg is
//     missing or the role isn't one of the three real values.
//
// Usage:
//   node --env-file=.env.local scripts/create-user.mjs --email <email> --role <role> --confirm
//   (or: npm run user:create -- --email <email> --role <role> --confirm)
//
//   --email <email>   The account's email address.
//   --role <role>     One of: user, admin, institution_admin.
//   --confirm         Actually create/update. Omit to dry-run.
//
// Required environment (.env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   TEMP_USER_PASSWORD   — the password to set if a new auth user needs
//                          creating. Not required to already be known if
//                          the user turns out to already exist, but this
//                          script validates it up front regardless — the
//                          alternative is discovering it's missing only
//                          after already doing the lookup work.

import { createClient } from "@supabase/supabase-js";

const ROLES = ["user", "admin", "institution_admin"];
const MIN_PASSWORD_LENGTH = 8;
const LIST_USERS_PAGE_SIZE = 1000;
const MAX_LIST_USERS_PAGES = 20; // 20,000 users — well beyond anything this pre-launch app has.

function parseArgs(argv) {
  const args = { email: null, role: null, confirm: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") args.email = argv[++i];
    else if (arg === "--role") args.role = argv[++i];
    else if (arg === "--confirm") args.confirm = true;
    else {
      console.error(`Unrecognised argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

/** Paginates auth.admin.listUsers() looking for a case-insensitive email match — the supabase-js admin client has no typed "filter by email" param, so this is the version-independent way to find one reliably. Mirrors scripts/promote-admin.mjs's own helper. */
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

  if (!args.email) {
    console.error("Pass --email <email>.");
    process.exit(1);
  }
  if (!args.role) {
    console.error(`Pass --role <role>. Allowed: ${ROLES.join(", ")}.`);
    process.exit(1);
  }
  if (!ROLES.includes(args.role)) {
    console.error(`Invalid role "${args.role}". Allowed: ${ROLES.join(", ")}.`);
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.TEMP_USER_PASSWORD;

  const missingEnv = [
    ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["TEMP_USER_PASSWORD", password],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missingEnv.length > 0) {
    console.error(`Missing env var(s): ${missingEnv.join(", ")}.`);
    console.error("Set these in .env.local (or export them for this command) — never pass a password as a CLI argument.");
    process.exit(1);
  }
  // Never logged, and never included in any error message below —
  // checked for shape only, not printed.
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`TEMP_USER_PASSWORD is too short — use at least ${MIN_PASSWORD_LENGTH} characters.`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log(`Looking up ${args.email} ...`);
  const existingUser = await findUserByEmail(supabase, args.email);

  if (!args.confirm) {
    console.log(existingUser ? `Auth user already exists (id ${existingUser.id}) — would not be recreated.` : "No existing auth user — would be created.");
    console.log(`Would ensure role = '${args.role}'.`);
    console.log("\nDry run — no changes made. Re-run with --confirm to apply this.");
    return;
  }

  let userId;
  if (existingUser) {
    console.log(`Auth user already exists (id ${existingUser.id}) — not recreating.`);
    userId = existingUser.id;
  } else {
    console.log("Creating auth user...");
    const { data, error } = await supabase.auth.admin.createUser({
      email: args.email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`Creating the auth user failed: ${error.message}`);
    userId = data.user.id;
    console.log(`Created auth user ${userId}.`);
  }

  // Ensure a matching profiles row exists. The real signup path
  // (handle_new_user(), 0001_profiles.sql) already auto-creates one with
  // role='user' the instant the auth.users row above was inserted — this
  // select-then-insert-if-missing is a defensive fallback for the
  // unexpected case where it somehow didn't, not the normal path.
  const { data: profile, error: profileSelectError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (profileSelectError) throw new Error(`Reading the profile failed: ${profileSelectError.message}`);

  if (!profile) {
    console.log("No profiles row found — creating one.");
    const { error: insertError } = await supabase.from("profiles").insert({ id: userId, role: args.role });
    if (insertError) throw new Error(`Creating the profile failed: ${insertError.message}`);
  } else if (profile.role !== args.role) {
    console.log(`Updating role: ${profile.role} -> ${args.role}`);
    // Service-role write — the one Postgres role
    // 0051_profiles_role_immutable.sql's trigger always lets change
    // `role`, regardless of what it was before.
    const { error: updateError } = await supabase.from("profiles").update({ role: args.role }).eq("id", userId);
    if (updateError) throw new Error(`Updating the role failed: ${updateError.message}`);
  } else {
    console.log("Profile already has the requested role — no change needed.");
  }

  const { data: finalProfile, error: finalSelectError } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (finalSelectError) throw new Error(`Reading the final profile failed: ${finalSelectError.message}`);

  console.log(`\nDone. ${args.email} -> role '${finalProfile.role}'.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
