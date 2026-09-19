import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { makeSuperAdmin, markOnboarded } from "../support/roles";

// The two Settings pages as a two-column layout (navigation left, active
// section right) on desktop and a stacked tab strip / nav row on mobile,
// with every existing form still working.

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
      const admin = await createIsolatedUser({ fullName: "Settings Admin" });
      await makeSuperAdmin(admin.id);
      const member = await createIsolatedUser({ fullName: "Settings Member" });
      await markOnboarded(member.id);
      const state = { admin: `test-results/.settings-admin-${admin.id}.json`, member: `test-results/.settings-member-${member.id}.json` };
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

const DESKTOP = { width: 1360, height: 640 };
const PHONE = { width: 375, height: 760 };

async function rect(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
}

test.describe("user settings", () => {
  test("desktop: navigation on the left, the active section on the right, and the list stays in view", async ({ open }) => {
    const page = await open("member", DESKTOP);
    await page.goto("/dashboard/settings");
    await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 5000 }).catch(() => undefined);

    const list = page.getByRole("tablist", { name: "Settings sections" });
    await expect(list).toBeVisible();
    await expect(list).toHaveAttribute("data-orientation", "vertical");
    const tabs = list.getByRole("tab");
    await expect(tabs).toHaveCount(7);

    // Two columns: every tab is stacked in the left column, the panel sits to its right.
    const first = await tabs.nth(0).boundingBox();
    const last = await tabs.nth(6).boundingBox();
    expect(last!.y).toBeGreaterThan(first!.y + 100);
    expect(Math.abs(last!.x - first!.x)).toBeLessThan(2);
    const panel = await rect(page, "[role='tabpanel']");
    expect(panel.left).toBeGreaterThan(Math.round(first!.x + first!.width));

    // Switching sections swaps the right column, not the page.
    await tabs.nth(2).click();
    await expect(page.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("New password").first()).toBeVisible();
    await tabs.nth(0).click();
    await expect(page.getByLabel("Full name")).toBeVisible();

    // Arrow keys follow the vertical list (Up/Down move focus, Enter activates).
    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowDown");
    await expect(tabs.nth(1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");

    // The list is sticky: after the content scrolls, it is still in view at the top.
    await tabs.nth(5).click(); // Billing is the tallest panel
    await page.locator("#main-content").evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.waitForTimeout(200);
    const scrolled = await page.locator("#main-content").evaluate((el) => el.scrollTop);
    if (scrolled > 0) {
      const listAfter = await rect(page, "[role='tablist']");
      expect(listAfter.top).toBeGreaterThanOrEqual(0);
      expect(listAfter.top).toBeLessThan(150);
    }
    // One scrollbar only.
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight)).toBeLessThanOrEqual(0);
  });

  test("the ?tab= deep links used across the app still open the right section", async ({ open }) => {
    const page = await open("member", DESKTOP);
    await page.goto("/dashboard/settings?tab=billing");
    await expect(page.getByRole("tab", { name: "Billing" })).toHaveAttribute("aria-selected", "true");
    await page.goto("/dashboard/settings?tab=account");
    await expect(page.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "true");
    await page.goto("/dashboard/settings?tab=nonsense");
    await expect(page.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
  });

  test("the existing profile form still saves", async ({ open, accounts }) => {
    const page = await open("member", DESKTOP);
    await page.goto("/dashboard/settings");
    await page.getByLabel("Full name").fill("Settings Member Renamed");
    await page.getByLabel("Date of birth").fill("1998-04-12"); // required by the form
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect
      .poll(async () => (await getAdminClient().from("profiles").select("full_name, date_of_birth").eq("id", accounts.member.id).single()).data)
      .toEqual({ full_name: "Settings Member Renamed", date_of_birth: "1998-04-12" });
    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("Settings Member Renamed");
  });

  test("mobile: a horizontal tab strip stacked above the content, no sideways overflow", async ({ open }) => {
    const page = await open("member", PHONE);
    await page.goto("/dashboard/settings");
    const list = page.getByRole("tablist", { name: "Settings sections" });
    await expect(list).toHaveAttribute("data-orientation", "horizontal");
    const strip = await rect(page, "[role='tablist']");
    const panel = await rect(page, "[role='tabpanel']");
    expect(panel.top).toBeGreaterThanOrEqual(strip.bottom); // stacked, not side by side
    const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    // Every tab is reachable (the strip scrolls sideways on its own).
    await page.getByRole("tab", { name: "Institution" }).click();
    await expect(page.getByRole("tab", { name: "Institution" })).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("admin settings", () => {
  test("desktop: section navigation on the left, the form on the right", async ({ open }) => {
    const page = await open("admin", DESKTOP);
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 5000 }).catch(() => undefined);

    const nav = page.getByRole("navigation", { name: "Settings sections" });
    await expect(nav.getByRole("link")).toHaveCount(2);
    const navBox = await rect(page, "nav[aria-label='Settings sections']");
    const formBox = await rect(page, "#main-content form");
    expect(formBox.left).toBeGreaterThan(navBox.right);
    expect(Math.abs(formBox.top - navBox.top)).toBeLessThan(40);

    await nav.getByRole("link", { name: /Announcement/ }).click();
    await expect(nav.getByRole("link", { name: /Announcement/ })).toHaveAttribute("aria-current", "location");
    await expect(page.getByRole("heading", { name: "Announcement" })).toBeInViewport();
  });

  test("the one form still saves everything (unchanged values written back)", async ({ open }) => {
    const page = await open("admin", DESKTOP);
    await page.goto("/admin/settings");
    const before = {
      maintenance: await page.getByRole("checkbox", { name: "Maintenance mode" }).isChecked(),
      announcementActive: await page.getByRole("checkbox", { name: "Show announcement banner" }).isChecked(),
      message: await page.getByLabel("Announcement message").inputValue(),
    };
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await page.reload();
    expect(await page.getByRole("checkbox", { name: "Maintenance mode" }).isChecked()).toBe(before.maintenance);
    expect(await page.getByRole("checkbox", { name: "Show announcement banner" }).isChecked()).toBe(before.announcementActive);
    expect(await page.getByLabel("Announcement message").inputValue()).toBe(before.message);
  });

  test("mobile: the nav is a row above the form", async ({ open }) => {
    const page = await open("admin", PHONE);
    await page.goto("/admin/settings");
    const nav = await rect(page, "nav[aria-label='Settings sections']");
    const form = await rect(page, "#main-content form");
    expect(form.top).toBeGreaterThanOrEqual(nav.bottom);
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  });
});
