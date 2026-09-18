// Same as run-e2e.mjs, plus E2E_MOCK_PROVIDERS=1 — set here (in plain
// JS) rather than inline in the npm script string so this works
// identically across shells (bash, PowerShell, cmd.exe don't share a
// `VAR=1 command` syntax). playwright.config.ts reads this to decide
// whether the spawned dev server loads
// e2e/support/mock-providers/preload.mjs.

import { execSync } from "node:child_process";

execSync("playwright test", { stdio: "inherit", env: { ...process.env, E2E_MOCK_PROVIDERS: "1" } });
