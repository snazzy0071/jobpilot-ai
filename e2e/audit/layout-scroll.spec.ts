import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { makeSuperAdmin, markOnboarded } from "../support/roles";

// The dashboard and admin shells: on desktop the sidebar is fixed and full
// height, only the content area scrolls, and there is exactly one vertical
// scrollbar. Below md the page scrolls normally and the sidebar is a drawer.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
type Who = "admin" | "member";
type Accounts = { admin: IsolatedUser; member: IsolatedUser; state: Record<Who, string> };

async function signedInState(browser: Browser, user: IsolatedUser, file: string, landing: RegExp) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing);
  await context.storageState({ path: file });
  await context.close();
}

const test = base.extend<{ open: (who: Who, viewport: { width: number; height: number }) => Promise<Page> }, { accounts: Accounts }>({
  accounts: [
    async ({ browser }, use) => {
      const admin = await createIsolatedUser({ fullName: "Layout Admin" });
      await makeSuperAdmin(admin.id);
      const member = await createIsolatedUser({ fullName: "Layout Member" });
      await markOnboarded(member.id);
      const state = { admin: `test-results/.layout-admin-${admin.id}.json`, member: `test-results/.layout-member-${member.id}.json` };
      try {
        await signedInState(browser, admin, state.admin, /\/admin$/);
        await signedInState(browser, member, state.member, /\/dashboard$/);
        await use({ admin, member, state });
      } finally {
        await getAdminClient().from("admin_audit_logs").delete().eq("actor_id", admin.id);
        await deleteIsolatedUser(admin.id);
        await deleteIsolatedUser(member.id);
      }
    },
    { scope: "worker", timeout: 120_000 },
  ],
  open: async ({ browser, accounts }, use) => {
    const contexts: { close: () => Promise<void> }[] = [];
    await use(async (who, viewport) => {
      const context = await browser.newContext({ baseURL: BASE_URL, storageState: accounts.state[who], viewport });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

/** Wheel scrolling is smoothed by the browser; wait until the content stops moving before measuring. */
async function settled(page: Page): Promise<number> {
  let previous = -1;
  let current = await page.locator("#main-content").evaluate((el) => el.scrollTop);
  for (let i = 0; i < 40 && current !== previous; i++) {
    previous = current;
    await page.waitForTimeout(100);
    current = await page.locator("#main-content").evaluate((el) => el.scrollTop);
  }
  return current;
}

const DESKTOP_SHORT = { width: 1280, height: 560 }; // short on purpose: every page is taller than this
const PHONE = { width: 375, height: 700 };

const SHELLS: { who: Who; path: string; nextLink: string; nextPath: RegExp }[] = [
  { who: "member", path: "/dashboard", nextLink: "Settings", nextPath: /\/dashboard\/settings/ },
  { who: "admin", path: "/admin", nextLink: "Users", nextPath: /\/admin\/users/ },
];

for (const shell of SHELLS) {
  test.describe(`${shell.path}/* shell`, () => {
    test("desktop: the sidebar stays fixed and full height while only the content scrolls, with one scrollbar", async ({ open }) => {
      const page = await open(shell.who, DESKTOP_SHORT);
      await page.goto(shell.path);
      await page.waitForLoadState("networkidle");

      const measure = () =>
        page.evaluate(() => {
          const sidebar = document.querySelector("nav[aria-label='Main']")!.getBoundingClientRect();
          const main = document.querySelector<HTMLElement>("#main-content")!;
          const root = document.scrollingElement!;
          return {
            sidebarTop: Math.round(sidebar.top),
            sidebarBottom: Math.round(sidebar.bottom),
            viewport: window.innerHeight,
            pageScrollable: root.scrollHeight > root.clientHeight + 1,
            windowScrollY: window.scrollY,
            mainScrollable: main.scrollHeight > main.clientHeight + 1,
            mainScrollTop: main.scrollTop,
            bodyOverflowY: getComputedStyle(document.body).overflowY,
          };
        });

      const before = await measure();
      // Sidebar spans the viewport top to bottom, and the *page* itself has nothing to scroll.
      expect(before.sidebarTop).toBe(0);
      expect(before.sidebarBottom).toBe(before.viewport);
      expect(before.pageScrollable, "the document must not scroll on desktop (that would be a second scrollbar)").toBe(false);
      expect(before.mainScrollable, "the content area is what scrolls").toBe(true);

      // Scroll the content: the sidebar does not move at all.
      await page.locator("#main-content").evaluate((el) => (el.scrollTop = 600));
      await page.mouse.move(700, 300);
      await page.mouse.wheel(0, 400);
      await settled(page);
      const after = await measure();
      expect(after.mainScrollTop).toBeGreaterThan(0);
      expect(after.windowScrollY).toBe(0);
      expect(after.sidebarTop).toBe(0);
      expect(after.sidebarBottom).toBe(after.viewport);

      // The header is pinned above the scroll area too.
      const headerTop = await page.locator("header").first().evaluate((el) => Math.round(el.getBoundingClientRect().top));
      expect(headerTop).toBe(0);

      // Wheel over the sidebar never scrolls the page or the content.
      const contentScrollBefore = after.mainScrollTop;
      await page.mouse.move(60, 300);
      await page.mouse.wheel(0, 500);
      await settled(page);
      const overSidebar = await measure();
      expect(overSidebar.windowScrollY).toBe(0);
      expect(overSidebar.mainScrollTop).toBe(contentScrollBefore);
    });

    test("desktop: navigating keeps the same shell and lands at the top of the new page", async ({ open }) => {
      const page = await open(shell.who, DESKTOP_SHORT);
      await page.goto(shell.path);
      await page.locator("#main-content").evaluate((el) => (el.scrollTop = 500));
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: shell.nextLink, exact: true }).click();
      await page.waitForURL(shell.nextPath);
      await page.waitForLoadState("networkidle");
      await expect.poll(() => page.locator("#main-content").evaluate((el) => el.scrollTop)).toBe(0);
      const sidebarTop = await page.evaluate(() => Math.round(document.querySelector("nav[aria-label='Main']")!.getBoundingClientRect().top));
      expect(sidebarTop).toBe(0);
    });

    test("desktop: no horizontal or double scrollbars at a common laptop size", async ({ open }) => {
      const page = await open(shell.who, { width: 1440, height: 800 });
      await page.goto(shell.path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => {
        const root = document.scrollingElement!;
        return { x: root.scrollWidth - root.clientWidth, y: root.scrollHeight - root.clientHeight };
      });
      expect(overflow.x).toBeLessThanOrEqual(0);
      expect(overflow.y).toBeLessThanOrEqual(0);
    });

    test("mobile: the page scrolls normally and the sidebar is still a drawer", async ({ open }) => {
      const page = await open(shell.who, PHONE);
      await page.goto(shell.path);
      await page.waitForLoadState("networkidle");

      // No desktop sidebar on screen, and the page (not an inner box) is what scrolls.
      await expect(page.locator("nav[aria-label='Main']:visible")).toHaveCount(0);
      const scroll = await page.evaluate(() => {
        const root = document.scrollingElement!;
        const main = document.querySelector<HTMLElement>("#main-content")!;
        return {
          pageScrolls: root.scrollHeight > root.clientHeight + 1,
          mainIsScrollContainer: getComputedStyle(main).overflowY !== "visible",
        };
      });
      expect(scroll.pageScrolls).toBe(true);
      expect(scroll.mainIsScrollContainer).toBe(false);

      // The drawer opens, holds the navigation, and navigates.
      await page.getByRole("button", { name: "Open navigation" }).click();
      const drawer = page.getByRole("dialog");
      await expect(drawer.getByRole("navigation", { name: "Main" })).toBeVisible();
      await drawer.getByRole("link", { name: shell.nextLink, exact: true }).click();
      await page.waitForURL(shell.nextPath);
    });
  });
}

test("dashboard while viewing as a user: the impersonation banner doesn't push the shell past the viewport", async ({ open, accounts }) => {
  const db = getAdminClient();
  const page = await open("admin", { width: 1280, height: 800 });
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto(`/admin/users/${accounts.member.id}`);
  // The fixed cookie banner sits over the bottom of the page (the button is at the end of this one); dismiss it like a user would.
  await page.getByRole("button", { name: "Reject non-essential" }).click();
  await page.getByRole("button", { name: "View as user" }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");

  const layout = await page.evaluate(() => {
    const root = document.scrollingElement!;
    const banner = document.body.querySelector("div.sticky")!.getBoundingClientRect();
    const sidebar = document.querySelector("nav[aria-label='Main']")!.getBoundingClientRect();
    return { pageScrolls: root.scrollHeight > root.clientHeight + 1, bannerTop: Math.round(banner.top), sidebarBottom: Math.round(sidebar.bottom), viewport: window.innerHeight };
  });
  expect(layout.pageScrolls).toBe(false);
  expect(layout.bannerTop).toBe(0);
  expect(layout.sidebarBottom).toBe(layout.viewport);

  await page.getByRole("button", { name: "Exit impersonation" }).click();
  await page.waitForURL(/\/admin$/);
  await db.from("admin_impersonation_sessions").update({ ended_at: new Date().toISOString(), end_reason: "test_cleanup" }).eq("admin_user_id", accounts.admin.id).is("ended_at", null);
});
