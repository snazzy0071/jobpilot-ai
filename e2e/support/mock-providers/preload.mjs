// Loaded via `node --import` before the Next.js dev/start server boots
// (see playwright.config.ts's mocked-providers webServer command) — by
// the time any app code runs, api.anthropic.com/api.stripe.com/
// api.resend.com are already intercepted. Setting E2E_MOCK_PROVIDERS
// here (not just relying on the caller to have set it already) is what
// src/lib/stripe/client.ts checks to decide whether to put Stripe on a
// fetch-based HTTP client — the one line of production code this whole
// mocking setup touches, and only ever active with this flag.
process.env.E2E_MOCK_PROVIDERS = "1";

await import("./mock-agent.mjs");
