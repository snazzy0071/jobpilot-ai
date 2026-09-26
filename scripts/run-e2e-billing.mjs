// Runs e2e/billing/billing.spec.ts against a production build with Stripe's HTTP API mocked (see the header of that spec).
// Needs `next build` done first and .env.local loaded:   node --env-file=.env.local scripts/run-e2e-billing.mjs
//
// The server runs on port 3100 with fake Stripe keys/prices and the network-level mock preloaded. NODE_OPTIONS is only given to the
// server process (setting it for npx/npm would preload the mock into them too).

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PORT = 3100;
const log = path.resolve("test-results/stripe-calls.jsonl");
mkdirSync(path.dirname(log), { recursive: true });
writeFileSync(log, "");

const stripeEnv = {
  STRIPE_SECRET_KEY: "sk_test_e2e",
  STRIPE_WEBHOOK_SECRET: "whsec_e2e",
  STRIPE_PRICE_VOICE_TOPUP: "price_e2e_topup",
  ...Object.fromEntries(["pro", "premium", "elite"].flatMap((plan) => ["monthly", "annual"].map((cycle) => [`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`, `price_e2e_${plan}_${cycle}`]))),
};

const shared = { ...process.env, ...stripeEnv, E2E_MOCK_PROVIDERS: "1", E2E_STRIPE_LOG: log, NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}` };

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
  stdio: "inherit",
  env: { ...shared, NODE_OPTIONS: "--import ./e2e/support/mock-providers/preload.mjs" },
});

async function ready() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/pricing`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("server did not start");
}

let status = 1;
try {
  await ready();
  const result = spawnSync("npx", ["playwright", "test", "e2e/billing/billing.spec.ts", "--project=chromium", "--workers=1", "--retries=0"], {
    stdio: "inherit",
    shell: true,
    env: { ...shared, E2E_BASE_URL: `http://localhost:${PORT}` },
  });
  status = result.status ?? 1;
} finally {
  server.kill();
}
process.exit(status);
