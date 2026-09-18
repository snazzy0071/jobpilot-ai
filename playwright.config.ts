import { defineConfig, devices } from "@playwright/test";

// Points at an already-running instance (a deployed preview, or a local
// server started some other way) when E2E_BASE_URL is set; otherwise
// spins up `next dev` itself and tears it down after the run. Either
// way, this suite always needs a REAL Supabase project behind
// NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY/
// SUPABASE_SERVICE_ROLE_KEY (the service-role key specifically for
// e2e/support/test-user.ts's isolated create/delete) — there is no
// mocked mode for the database.
//
// Stripe/Anthropic/Resend are a different story: setting
// E2E_MOCK_PROVIDERS=1 (npm run test:e2e:mocked) makes the spawned dev
// server load e2e/support/mock-providers/preload.mjs as a Node process
// preload *before* Next.js boots — every real outbound call this app
// makes to those three providers is intercepted at the network layer
// (see that file), so the AI/Stripe/email-touching specs can run
// without real API keys or real cost/side effects, while everything
// else (Supabase, the app's own logic) still runs for real. See
// e2e/README.md.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const mockProviders = process.env.E2E_MOCK_PROVIDERS === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // each spec creates/deletes its own real Supabase user; parallel workers racing the same dev server is fine, but keeping this off is one less variable while the suite is still unverified against a real run (see e2e/README.md).
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Skipped when E2E_BASE_URL is set — that means the caller already has
  // a server running (or is pointing at a real deployment) and owns its
  // lifecycle.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // Playwright's own docs: `env` defaults to `process.env`, but
        // providing it explicitly *replaces* that default rather than
        // extending it — spreading process.env here is what keeps PATH
        // and everything else intact while only adding NODE_OPTIONS.
        env: mockProviders
          ? { ...process.env, NODE_OPTIONS: "--import ./e2e/support/mock-providers/preload.mjs" }
          : undefined,
      },
});
