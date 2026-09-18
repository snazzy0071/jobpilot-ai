import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// A separate, minimal admin-client factory from src/lib/supabase/admin.ts
// on purpose: that one is `import "server-only"`-guarded and reads
// through src/lib/env.server.ts's zod-validated, Next-specific env
// loading — neither applies to this plain Node/Playwright process. Same
// service-role key, same bypass-RLS behavior, just constructed directly
// for a test harness instead of a Next.js server context.
let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "e2e/support/admin-client.ts: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set " +
        "(e.g. via .env.local, same as the app itself) — this suite creates and deletes real, isolated Supabase " +
        "Auth users for every test and has no mocked-backend mode.",
    );
  }

  cached = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  return cached;
}
