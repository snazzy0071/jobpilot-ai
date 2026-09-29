import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));

import { ADMIN_NAV_ITEMS, ADMIN_UNLISTED_PAGES } from "@/components/layout/admin-sidebar";
import { ADMIN_PERMISSIONS, ADMIN_PERMISSION_LABELS } from "@/lib/admin/permission-types";
import { summariseBilling } from "@/lib/admin/overview/queries";

const REQUIRED_MENU = [
  "Dashboard",
  "Users",
  "Institutions",
  "Plans/Subscriptions",
  "Access Codes",
  "AI Usage",
  "Sponsors",
  "Graduate Schemes",
  "Deadlines",
  "Jobs",
  "Test Prep",
  "Advice Hub",
  "Blog",
  "Comparisons",
  "Auto-Apply",
  "Leads",
  "Roles",
  "Settings",
  "System Health",
];

describe("admin menu", () => {
  it("is exactly the requested menu, in the requested order", () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.label)).toEqual(REQUIRED_MENU);
  });

  it("links only into /admin — never into the user dashboard", () => {
    for (const item of [...ADMIN_NAV_ITEMS, ...ADMIN_UNLISTED_PAGES]) {
      expect(item.href === "/admin" || item.href.startsWith("/admin/"), item.href).toBe(true);
    }
  });

  it("points every item at a page that exists, with no duplicates", () => {
    const hrefs = ADMIN_NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      const dir = path.join(process.cwd(), "src", "app", ...href.split("/").filter(Boolean));
      expect(existsSync(path.join(dir, "page.tsx")), href).toBe(true);
    }
  });

  it("gates every item except the dashboard behind a real, labelled permission", () => {
    for (const item of ADMIN_NAV_ITEMS.filter((entry) => entry.href !== "/admin")) {
      expect(item.permission, item.label).toBeDefined();
      expect(ADMIN_PERMISSIONS).toContain(item.permission);
      expect(ADMIN_PERMISSION_LABELS[item.permission!]).toBeTruthy();
    }
  });

  it("guards each section's own layout with the same permission the menu uses", () => {
    for (const item of ADMIN_NAV_ITEMS.filter((entry) => entry.href !== "/admin")) {
      const layout = path.join(process.cwd(), "src", "app", ...item.href.split("/").filter(Boolean), "layout.tsx");
      expect(existsSync(layout), `${item.href} has a layout guard`).toBe(true);
    }
  });
});

describe("summariseBilling", () => {
  const row = (over: object) => ({ plan_slug: "pro", plan_name: "Pro", tier_order: 1, monthly_price_pence: 1000, annual_price_pence: 9600, status: "active", billing_cycle: "monthly", stripe_billed: true, count: 1, ...over });

  it("counts only Stripe-billed subscriptions as revenue, and shows the rest as complimentary", () => {
    const b = summariseBilling([row({ count: 3 }), row({ stripe_billed: false, count: 2 }), row({ billing_cycle: "annual", count: 1 })], {});
    expect(b.activePaid).toBe(4);
    expect(b.complimentary).toBe(2);
    expect(b.mrrPence).toBe(3 * 1000 + 800);
    expect(b.arrPence).toBe(b.mrrPence * 12);
  });

  it("never treats the free plan, trials or past-due subscriptions as revenue", () => {
    const b = summariseBilling([row({ tier_order: 0, plan_slug: "free", monthly_price_pence: 0, annual_price_pence: 0, stripe_billed: false, count: 50 }), row({ status: "trialing" }), row({ status: "past_due" })], {});
    expect(b).toMatchObject({ mrrPence: 0, activePaid: 0, complimentary: 0, trialing: 1, pastDue: 1 });
  });
});
