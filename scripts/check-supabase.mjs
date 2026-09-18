// Connectivity check for the configured Supabase project. Run with:
//   npm run supabase:check
//
// Verifies (without touching any feature table):
//   1. the anon key/URL reach PostgREST and RLS is enforced
//   2. the service role key authenticates and bypasses RLS
// Exits non-zero on any failure so it's usable in CI.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
  ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(", ")}`);
  console.error("Copy .env.example to .env.local and fill in your project's values.");
  process.exit(1);
}

console.log(`Target: ${url}\n`);

let failed = false;

// The "relation does not exist" error (42P01) is treated as success below:
// it means the request reached Postgres through PostgREST with a valid
// key, which is what we're testing. No feature tables exist yet, so we
// probe against `profiles`, the one table the auth migration creates.

console.log("1) Anon client -> profiles (expect RLS to allow the query, return 0 rows)");
{
  const anonClient = createClient(url, anonKey);
  const { error, count } = await anonClient
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if (!error) {
    console.log(`   OK — reachable, RLS enforced (visible rows: ${count ?? 0})`);
  } else if (error.code === "42P01") {
    console.log("   OK — reachable, but `profiles` doesn't exist yet.");
    console.log("        Run supabase/migrations/0001_profiles.sql against this project.");
  } else {
    failed = true;
    console.error(
      `   FAILED — [${error.code ?? "n/a"}] ${error.message || JSON.stringify(error)}`,
    );
  }
}

console.log("\n2) Service-role client -> profiles (expect RLS bypass)");
{
  const adminClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error, count } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true });

  if (!error) {
    console.log(`   OK — service role authenticated (total rows: ${count ?? 0})`);
  } else if (error.code === "42P01") {
    console.log("   OK — authenticated, but `profiles` doesn't exist yet.");
  } else {
    failed = true;
    console.error(
      `   FAILED — [${error.code ?? "n/a"}] ${error.message || JSON.stringify(error)}`,
    );
  }
}

console.log();
if (failed) {
  console.error("Connection check failed — see errors above.");
  process.exitCode = 1;
} else {
  console.log("Connection check passed.");
}
