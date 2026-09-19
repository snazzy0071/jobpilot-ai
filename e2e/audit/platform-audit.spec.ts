import { test as base, expect, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { makeSuperAdmin, markOnboarded } from "../support/roles";

// Functional audit of the cross-cutting platform requirements: role-aware
// login, the admin shell, "View as user" and its audit trail, dashboards,
// motion / reduced motion, and mobile layout. Every test drives the real
// app against the real Supabase project with throwaway accounts (created
// and deleted through the service role, like the rest of e2e/).

type Who = "admin" | "member";
type Accounts = { admin: IsolatedUser; member: IsolatedUser; state: Record<Who, string> };
type OpenAs = (who: Who, options?: BrowserContextOptions) => Promise<Page>;

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function signIn(page: Page, user: IsolatedUser) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function saveSession(browser: Browser, user: IsolatedUser, file: string, landing: RegExp) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await signIn(page, user);
  await page.waitForURL(landing);
  await context.storageState({ path: file });
  await context.close();
}

// One admin and one member for the whole file, each signed in ONCE through
// the real login form and then reused as storage state. /login is rate
// limited per IP (which this audit incidentally confirmed works), so
// signing in for every test would trip it. The tests that are *about*
// logging in still perform a real sign-in of their own.
const test = base.extend<{ openAs: OpenAs }, { accounts: Accounts }>({
  accounts: [
    async ({ browser }, use) => {
      const admin = await createIsolatedUser({ fullName: "Audit Admin" });
      await makeSuperAdmin(admin.id);
      const member = await createIsolatedUser({ fullName: "Audit Member" });
      await markOnboarded(member.id);
      const state = { admin: `test-results/.audit-admin-${admin.id}.json`, member: `test-results/.audit-member-${member.id}.json` };
      try {
        await saveSession(browser, admin, state.admin, /\/admin$/);
        await saveSession(browser, member, state.member, /\/dashboard$/);
        await use({ admin, member, state });
      } finally {
        await getAdminClient().from("admin_audit_logs").delete().eq("actor_id", admin.id);
        await deleteIsolatedUser(admin.id);
        await deleteIsolatedUser(member.id);
      }
    },
    { scope: "worker", timeout: 120_000 },
  ],

  openAs: async ({ browser, accounts }, use) => {
    const contexts: { close: () => Promise<void> }[] = [];
    await use(async (who, options = {}) => {
      const context = await browser.newContext({ baseURL: BASE_URL, storageState: accounts.state[who], ...options });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

/** The fixed cookie banner covers the bottom of the page (where "View as user" is); dismiss it as a user would. */
async function dismissCookieBanner(page: Page) {
  // The banner mounts after hydration, so wait for it (a no-op if consent was already recorded).
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 5_000 }).catch(() => undefined);
}

async function horizontalOverflow(page: Page): Promise<{ px: number; offenders: string[] }> {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const offenders: string[] = [];
    const exempt = (el: Element): boolean => {
      for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (node.getAttribute("aria-hidden") === "true" || style.pointerEvents === "none") return true; // decorative
        if (style.transform !== "none") return true; // a reveal/slide in progress
        if (node !== el && /(hidden|clip|auto|scroll)/.test(style.overflowX) && node.getBoundingClientRect().right <= width + 1) return true; // clipped by a bounded ancestor
      }
      return false;
    };
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > width + 1 && !exempt(el)) {
        offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")} right=${Math.round(rect.right)}`);
      }
    }
    return { px: offenders.length, offenders: offenders.slice(0, 6) };
  });
}

test.describe("1-2. role-aware login", () => {
  test("an admin signing in lands on /admin", async ({ page, accounts }) => {
    await signIn(page, accounts.admin);
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Admin overview" })).toBeVisible();
  });

  test("a user signing in lands on /dashboard", async ({ page, accounts }) => {
    await signIn(page, accounts.member);
    await page.waitForURL(/\/dashboard$/);
  });

  test("a plain user cannot open /admin", async ({ openAs }) => {
    const page = await openAs("member");
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("an already-signed-in visitor on /login is sent to their own home", async ({ openAs }) => {
    const admin = await openAs("admin");
    await admin.goto("/login");
    await admin.waitForURL(/\/admin$/);
    const member = await openAs("member");
    await member.goto("/login");
    await member.waitForURL(/\/dashboard$/);
  });

  test("a signed-out visitor is bounced from /admin and /dashboard to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fadmin/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });
});

test.describe("3-4. admin sidebar and public-site link", () => {
  test("the admin sidebar holds only admin navigation, plus View Public Website", async ({ openAs }) => {
    const page = await openAs("admin", { viewport: { width: 1360, height: 900 } });
    await page.goto("/admin");

    const sidebar = page.locator("aside, nav").filter({ hasText: "Administration" }).first();
    await expect(sidebar.getByText("Administration")).toBeVisible();
    await expect(sidebar.getByText("User Workspace")).toHaveCount(0);
    for (const label of ["CV Builder", "ATS Scanner", "Interview Coach", "Job Tracker", "Cover Letters", "LinkedIn Optimiser"]) {
      await expect(sidebar.getByRole("link", { name: label })).toHaveCount(0);
    }
    await expect(sidebar.locator('a[href^="/dashboard"]')).toHaveCount(0);
    for (const label of ["Admin Dashboard", "Users", "Institutions", "AI Usage", "Sponsor Sync", "Job Feed", "Test Prep", "Blog", "Leads", "Settings", "Admin Roles", "Audit Log", "System Health"]) {
      await expect(sidebar.getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(sidebar.getByRole("button", { name: /sign out|log out/i })).toBeVisible();

    const publicLinks = page.getByRole("link", { name: /View Public Website/ });
    expect(await publicLinks.count(), "sidebar + header links").toBeGreaterThanOrEqual(2);
    for (let i = 0; i < (await publicLinks.count()); i++) {
      await expect(publicLinks.nth(i)).toHaveAttribute("href", "/");
      await expect(publicLinks.nth(i)).toHaveAttribute("target", "_blank");
    }
  });

  test("View Public Website is also on the user dashboard", async ({ openAs }) => {
    const page = await openAs("member", { viewport: { width: 1360, height: 900 } });
    await page.goto("/dashboard");
    const link = page.getByRole("link", { name: /View Public Website/ }).first();
    await expect(link).toHaveAttribute("href", "/");
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("links that look like buttons are still announced as links", async ({ openAs }) => {
    const page = await openAs("admin", { viewport: { width: 1360, height: 900 } });
    await page.goto("/admin");
    const wrongRole = await page.evaluate(() => Array.from(document.querySelectorAll("a[href][role='button']")).length);
    expect(wrongRole).toBe(0);
  });
});

test.describe("5. secure View as user + audit trail", () => {
  test("starts read-only, blocks writes and /admin, exits cleanly, and every step is audited", async ({ openAs, accounts }) => {
    const { admin, member } = accounts;
    const db = getAdminClient();
    const page = await openAs("admin");
    page.on("dialog", (dialog) => void dialog.accept());

    // Start.
    await page.goto(`/admin/users/${member.id}`);
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: "View as user" }).click();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByText("read-only")).toBeVisible();
    await expect(page.getByText(/Viewing as/)).toBeVisible();

    // The session is real, tied to this admin and this target.
    const { data: session } = await db
      .from("admin_impersonation_sessions")
      .select("admin_user_id, target_user_id, ended_at")
      .eq("admin_user_id", admin.id)
      .is("ended_at", null)
      .single();
    expect(session?.target_user_id).toBe(member.id);

    // Writes are rejected at the proxy.
    const write = await page.request.post("/dashboard", { maxRedirects: 0, data: {} });
    expect([302, 303, 307, 308]).toContain(write.status());
    expect(write.headers()["location"] ?? "").toContain("impersonation_blocked=1");

    // The admin area is unreachable while impersonating.
    await page.goto("/admin");
    await page.waitForURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/admin/);

    // Exit returns to /admin and closes the session.
    await page.getByRole("button", { name: "Exit impersonation" }).click();
    await page.waitForURL(/\/admin$/);
    await expect(page.getByText(/Viewing as/)).toHaveCount(0);
    const { data: ended } = await db
      .from("admin_impersonation_sessions")
      .select("ended_at, end_reason")
      .eq("admin_user_id", admin.id)
      .not("ended_at", "is", null);
    expect(ended?.[0]?.end_reason).toBe("manual_exit");

    // Audit trail: both ends recorded against the right actor and target.
    const { data: audit } = await db
      .from("admin_audit_logs")
      .select("action, actor_id, entity_type, entity_id, metadata")
      .eq("actor_id", admin.id)
      .in("action", ["user.impersonate_start", "user.impersonate_end"]);
    expect((audit ?? []).map((row) => row.action).sort()).toEqual(["user.impersonate_end", "user.impersonate_start"]);
    for (const row of audit ?? []) {
      expect(row.entity_type).toBe("user");
      expect(row.entity_id).toBe(member.id);
      expect((row.metadata as { impersonationSessionId?: string }).impersonationSessionId).toBeTruthy();
    }
  });

  test("a session that expires on its own is closed and audited", async ({ openAs, accounts }) => {
    const { admin, member } = accounts;
    const db = getAdminClient();
    const page = await openAs("admin");
    page.on("dialog", (dialog) => void dialog.accept());

    await page.goto(`/admin/users/${member.id}`);
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: "View as user" }).click();
    await page.waitForURL(/\/dashboard$/);

    // Age the session past the one-hour limit.
    const { error } = await db
      .from("admin_impersonation_sessions")
      .update({ started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() })
      .eq("admin_user_id", admin.id)
      .is("ended_at", null);
    expect(error).toBeNull();

    // The next request fails closed: no banner, and the admin is back to being an admin, not the user.
    await page.goto("/dashboard");
    await expect(page.getByText("read-only")).toHaveCount(0);

    const { data: row } = await db
      .from("admin_impersonation_sessions")
      .select("end_reason")
      .eq("admin_user_id", admin.id)
      .eq("end_reason", "expired")
      .maybeSingle();
    expect(row?.end_reason).toBe("expired");

    const { data: audit } = await db
      .from("admin_audit_logs")
      .select("metadata")
      .eq("actor_id", admin.id)
      .eq("action", "user.impersonate_end")
      .eq("entity_id", member.id);
    expect((audit ?? []).some((entry) => (entry.metadata as { reason?: string }).reason === "expired")).toBe(true);
  });

  test("starting a second session closes and audits the first as superseded", async ({ openAs, accounts }) => {
    const { admin, member } = accounts;
    const second = await createIsolatedUser({ fullName: "Second Member" });
    await markOnboarded(second.id);
    const db = getAdminClient();
    try {
      const page = await openAs("admin");
      page.on("dialog", (dialog) => void dialog.accept());

      await page.goto(`/admin/users/${member.id}`);
      await dismissCookieBanner(page);
      await page.getByRole("button", { name: "View as user" }).click();
      await page.waitForURL(/\/dashboard$/);
      await page.getByRole("button", { name: "Exit impersonation" }).click();
      await page.waitForURL(/\/admin$/);

      // Two overlapping sessions: the second start must close the first.
      const { data: first } = await db
        .from("admin_impersonation_sessions")
        .insert({ admin_user_id: admin.id, target_user_id: member.id })
        .select("id")
        .single();
      await page.goto(`/admin/users/${second.id}`);
      await dismissCookieBanner(page);
      await page.getByRole("button", { name: "View as user" }).click();
      await page.waitForURL(/\/dashboard$/);

      const { data: closed } = await db.from("admin_impersonation_sessions").select("end_reason").eq("id", first!.id).single();
      expect(closed?.end_reason).toBe("superseded");
      const { data: audit } = await db
        .from("admin_audit_logs")
        .select("metadata")
        .eq("actor_id", admin.id)
        .eq("action", "user.impersonate_end")
        .eq("entity_id", member.id);
      expect((audit ?? []).some((entry) => (entry.metadata as { reason?: string }).reason === "superseded")).toBe(true);
    } finally {
      await db.from("admin_impersonation_sessions").update({ ended_at: new Date().toISOString(), end_reason: "test_cleanup" }).eq("admin_user_id", admin.id).is("ended_at", null);
      await deleteIsolatedUser(second.id);
    }
  });

  test("a forged impersonation cookie does nothing for a non-admin", async ({ openAs }) => {
    const page = await openAs("member");
    await page.context().addCookies([{ name: "jp_impersonation_id", value: "00000000-0000-4000-8000-000000000000", url: BASE_URL }]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("read-only")).toHaveCount(0);
  });

  test("an admin account cannot be impersonated (no button in the UI, and the database refuses the row)", async ({ openAs, accounts }) => {
    const other = await createIsolatedUser({ fullName: "Other Admin" });
    await makeSuperAdmin(other.id);
    try {
      const page = await openAs("admin");
      await page.goto(`/admin/users/${other.id}`);
      await expect(page.getByRole("heading", { name: "Other Admin" })).toBeVisible();
      await expect(page.getByRole("button", { name: "View as user" })).toHaveCount(0);

      // Even bypassing the UI and the server action's pre-check, the trigger from migration 0087 rejects it.
      const { error } = await getAdminClient()
        .from("admin_impersonation_sessions")
        .insert({ admin_user_id: accounts.admin.id, target_user_id: other.id });
      expect(error, "inserting an impersonation row that targets an admin must fail").not.toBeNull();
    } finally {
      await getAdminClient().from("admin_audit_logs").delete().eq("actor_id", other.id);
      await deleteIsolatedUser(other.id);
    }
  });

  test("a non-admin cannot reach another user's admin page", async ({ openAs, accounts }) => {
    const page = await openAs("member");
    await page.goto(`/admin/users/${accounts.admin.id}`);
    await expect(page).not.toHaveURL(/\/admin/);
  });
});

test.describe("10-11. dashboards show real information", () => {
  test("the admin overview renders every requested section", async ({ openAs }) => {
    const page = await openAs("admin", { viewport: { width: 1360, height: 900 } });
    await page.goto("/admin");

    for (const label of [
      "Total users",
      "New users (30d)",
      "Active users (30d)",
      "Paying subscriptions",
      "MRR",
      "AI cost (30d, est.)",
      "ATS scans (30d)",
      "CVs created (30d)",
      "Interviews (30d)",
      "Applications (30d)",
    ]) {
      await expect(page.getByRole("heading", { name: label })).toBeVisible();
    }
    for (const title of [
      "Subscriptions & billing",
      "AI usage & cost (30 days)",
      "Applications by stage",
      "Institutions",
      "Sync pipelines",
      "Failed jobs & webhooks (7 days)",
      "System health",
      "Recent admin activity",
    ]) {
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });

  test("the admin overview never shows a fake zero when its data can't be loaded", async ({ openAs }) => {
    const page = await openAs("admin", { viewport: { width: 1360, height: 900 } });
    await page.goto("/admin");
    const banner = page.getByRole("alert").filter({ hasText: "couldn't be loaded" });
    if ((await banner.count()) === 0) return; // the aggregate functions loaded: nothing to assert here
    test.info().annotations.push({ type: "note", description: "migrations 0090/0091 are not applied to this database; checking the fallback is honest" });
    const totalCard = page.locator("h3", { hasText: "Total users" }).locator("xpath=..").locator("xpath=..");
    await expect(totalCard).toContainText("Unavailable");
    await expect(totalCard).not.toContainText(/^0$/m);
  });

  test("the admin overview's headline user count matches the database", async ({ openAs }) => {
    const page = await openAs("admin", { viewport: { width: 1360, height: 900 } });
    await page.goto("/admin");
    if ((await page.getByRole("alert").filter({ hasText: "couldn't be loaded" }).count()) > 0) test.skip(true, "aggregate functions (migration 0091) not applied");
    const { count } = await getAdminClient().from("profiles").select("id", { count: "exact", head: true });
    const card = page.locator("h3", { hasText: "Total users" }).locator("xpath=..").locator("xpath=..");
    await expect(card).toContainText(String(count));
  });

  test("the user dashboard shows real account data, not placeholders", async ({ openAs }) => {
    const page = await openAs("member", { viewport: { width: 1360, height: 900 } });
    await page.goto("/dashboard");
    const text = (await page.locator("main").innerText()).toLowerCase();
    expect(text).not.toMatch(/lorem ipsum|coming soon|placeholder|todo/);
    expect(text.length).toBeGreaterThan(300);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });
});

test.describe("7-9, 15. motion", () => {
  test("global CSS animations and animated backgrounds run normally", async ({ page }) => {
    await page.goto("/");
    const animated = await page.evaluate(() => {
      const found: string[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const style = getComputedStyle(el);
        if (style.animationName !== "none" && parseFloat(style.animationDuration) > 0.05) found.push(style.animationName);
      }
      return found;
    });
    expect(animated.length).toBeGreaterThan(0);
  });

  test("the public animated background is decorative, non-interactive, and actually moving", async ({ page }) => {
    await page.goto("/");
    const backgrounds = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[aria-hidden='true'].pointer-events-none.absolute")).map((el) => {
        const moving = Array.from(el.querySelectorAll<HTMLElement>("*")).concat(el).some((child) => {
          const style = getComputedStyle(child);
          return style.animationName !== "none" && parseFloat(style.animationDuration) > 0.05;
        });
        return { moving, clipped: getComputedStyle(el).overflow !== "visible" };
      }),
    );
    expect(backgrounds.length, "no decorative background layers found on the homepage").toBeGreaterThan(0);
    expect(backgrounds.some((layer) => layer.moving), "no background layer is animating").toBe(true);
  });

  test("the dashboard and admin shells carry the subtle ambient glow, and it breathes", async ({ openAs }) => {
    for (const [who, path] of [["member", "/dashboard"], ["admin", "/admin"]] as const) {
      const page = await openAs(who, { viewport: { width: 1360, height: 900 } });
      await page.goto(path);
      const glow = await page.evaluate(() => {
        const main = document.querySelector("main.dashboard-glow");
        if (!main) return null;
        const style = getComputedStyle(main, "::before");
        return { animation: style.animationName, duration: parseFloat(style.animationDuration), image: style.backgroundImage };
      });
      expect(glow, `${path} has no .dashboard-glow shell`).not.toBeNull();
      expect(glow!.animation).not.toBe("none");
      expect(glow!.duration).toBeGreaterThan(1);
      expect(glow!.image).not.toBe("none");
    }
  });

  test("prefers-reduced-motion collapses every animation and transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const path of ["/", "/pricing", "/login"]) {
      await page.goto(path);
      const offenders = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of Array.from(document.querySelectorAll("*"))) {
          const style = getComputedStyle(el);
          if (style.animationName !== "none" && parseFloat(style.animationDuration) > 0.05) bad.push(`${el.tagName} animation ${style.animationDuration}`);
          if (parseFloat(style.transitionDuration) > 0.05) bad.push(`${el.tagName} transition ${style.transitionDuration}`);
        }
        return bad.slice(0, 8);
      });
      expect(offenders, `${path} still animates under reduced motion`).toEqual([]);
    }
  });

  test("JS-driven motion also respects reduced motion on the admin overview", async ({ openAs }) => {
    const page = await openAs("admin", { viewport: { width: 1360, height: 900 } });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Total users" })).toBeVisible();
    // Bars and lines must not be parked at scale 0 / pathLength 0 waiting for an animation that will never play.
    await page.waitForTimeout(500);
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[style*='scaleY(0)'], [style*='scaleX(0)']")).map((el) => el.outerHTML.slice(0, 140)),
    );
    expect(hidden, "elements still parked at scale 0 under reduced motion").toEqual([]);
  });

  test("with motion allowed, the admin charts draw in (when their data is available)", async ({ openAs }) => {
    const page = await openAs("admin", { viewport: { width: 1360, height: 900 } });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Total users" })).toBeVisible();
    if ((await page.getByRole("alert").filter({ hasText: "couldn't be loaded" }).count()) > 0) test.skip(true, "aggregate functions (migration 0091) not applied, so there are no charts to animate");
    await expect.poll(() => page.locator("svg path[pathLength]").count()).toBeGreaterThan(0);
  });
});

test.describe("14. mobile", () => {
  const phone = { viewport: { width: 375, height: 812 } };
  const publicPaths = ["/", "/pricing", "/login", "/signup", "/free-ats-checker", "/visa-sponsors", "/blog", "/about", "/for-universities", "/contact", "/compare", "/status"];

  for (const path of publicPaths) {
    test(`no horizontal overflow at 375px on ${path}`, async ({ browser }) => {
      const context = await browser.newContext({ baseURL: BASE_URL, ...phone });
      const page = await context.newPage();
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { px, offenders } = await horizontalOverflow(page);
      expect(px, offenders.join(" | ")).toBeLessThanOrEqual(1);
      await context.close();
    });
  }

  test("the admin area is usable at 375px, with a menu that holds only admin navigation", async ({ openAs }) => {
    const page = await openAs("admin", phone);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    const { px, offenders } = await horizontalOverflow(page);
    expect(px, offenders.join(" | ")).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: /open .*menu|menu|navigation/i }).first().click();
    const menu = page.getByRole("dialog");
    await expect(menu.getByText("Administration")).toBeVisible();
    await expect(menu.getByText("User Workspace")).toHaveCount(0);
    await expect(menu.getByRole("link", { name: /View Public Website/ })).toBeVisible();
  });

  test("the user dashboard has no horizontal overflow at 375px", async ({ openAs }) => {
    const page = await openAs("member", phone);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const { px, offenders } = await horizontalOverflow(page);
    expect(px, offenders.join(" | ")).toBeLessThanOrEqual(1);
  });

  test("the CV editor has no horizontal overflow at 375px", async ({ openAs }) => {
    const page = await openAs("member", phone);
    await page.goto("/dashboard/cvs");
    await page.waitForLoadState("networkidle");
    const { px, offenders } = await horizontalOverflow(page);
    expect(px, offenders.join(" | ")).toBeLessThanOrEqual(1);
  });
});
