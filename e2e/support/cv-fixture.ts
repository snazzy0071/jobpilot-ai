import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "./test-user";
import { markOnboarded, setPlan } from "./roles";
import { seedCv } from "./cv";

// The scaffolding the CV builder specs share: one signed-in account per worker (sign-in is rate limited per IP),
// optionally on a paid plan, plus helpers to open the editor with the cookie banner out of the way.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const DESKTOP = { width: 1360, height: 900 };
export const PHONE = { width: 375, height: 760 };

export type Viewport = { width: number; height: number };
export type Account = { user: IsolatedUser; state: string };

/** True when the server under test has the AI/Stripe/email providers mocked (see e2e/support/mock-providers). */
export const providersMocked = process.env.E2E_MOCK_PROVIDERS === "1";

export function makeCvTest(options: { name: string; plan?: "pro" | "premium" | "elite" }) {
  return base.extend<{ open: (viewport?: Viewport) => Promise<Page> }, { account: Account }>({
    account: [
      async ({ browser }, use) => {
        const user = await createIsolatedUser({ fullName: options.name });
        await markOnboarded(user.id);
        if (options.plan) await setPlan(user.id, options.plan);
        const state = `test-results/.cv-fixture-${user.id}.json`;
        try {
          const context = await browser.newContext({ baseURL: BASE_URL });
          const page = await context.newPage();
          await page.goto("/login");
          await page.getByLabel("Email").fill(user.email);
          await page.getByLabel("Password", { exact: true }).fill(user.password);
          await page.getByRole("button", { name: "Sign in" }).click();
          await page.waitForURL(/\/dashboard$/);
          await context.storageState({ path: state });
          await context.close();
          await use({ user, state });
        } finally {
          await deleteIsolatedUser(user.id); // cascades to every CV, version, section row and subscription it owns
        }
      },
      { scope: "worker", timeout: 120_000 },
    ],
    open: async ({ browser, account }, use) => {
      const contexts: { close: () => Promise<void> }[] = [];
      await use(async (viewport = DESKTOP) => {
        const context = await (browser as Browser).newContext({ baseURL: BASE_URL, storageState: account.state, viewport });
        contexts.push(context);
        return context.newPage();
      });
      await Promise.all(contexts.map((context) => context.close()));
    },
  });
}

export async function dismissCookieBanner(page: Page) {
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
}

/** Seeds a CV through the service role and opens it in the editor. */
export async function openSeededEditor(
  open: (viewport?: Viewport) => Promise<Page>,
  userId: string,
  options: Parameters<typeof seedCv>[1] = {},
  viewport: Viewport = DESKTOP,
) {
  const seeded = await seedCv(userId, options);
  const page = await open(viewport);
  await page.goto(`/dashboard/cvs/${seeded.cvId}`);
  await expect(page.getByLabel("Full name")).toBeVisible();
  await dismissCookieBanner(page);
  return { page, ...seeded };
}

export const saveState = (page: Page) => page.locator("[data-save-state]");
export const expectSaved = (page: Page) => expect(saveState(page)).toHaveAttribute("data-save-state", "saved", { timeout: 15_000 });
export const previewDoc = (page: Page) => page.locator(".cv-document").first();
export const rowForm = (page: Page, label: string) => page.locator("form").filter({ has: page.getByLabel(label, { exact: true }) });
export const norm = (text: string) => text.replace(/\s+/g, " ").trim();
