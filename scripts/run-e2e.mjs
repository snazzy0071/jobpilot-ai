// Thin wrapper so `npm run test:e2e` loads .env.local the same way
// npm run supabase:check does (`node --env-file`), then hands off to
// the real Playwright binary with that env already in this process —
// `execSync` inherits it into the child. See e2e/README.md for what
// this suite actually needs configured to run at all.

import { execSync } from "node:child_process";

execSync("playwright test", { stdio: "inherit" });
