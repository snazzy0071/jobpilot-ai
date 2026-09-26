import { expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { makeSuperAdmin } from "../support/roles";
import { dismissCookieBanner, makeCvTest, providersMocked } from "../support/cv-fixture";

// The public UK visa sponsor directory and its admin sync page, run against the REAL register imported into the
// linked Supabase project (scripts/import-sponsors.mjs) — there is no fixture data: every expectation is read back
// from the database the pages are built on, or is a well-known company that is on the real register. The one thing
// this file writes is a single, clearly-named inactive sponsor (to prove removed companies are handled), deleted again
// afterwards. The importer's own removal/reactivation/pruning behaviour is verified by running the importer against
// the database, not here.
//
// The public search page is IP rate limited (30/min), so the specs below keep to a handful of page loads.
//
// "Run sync now" needs the mocked GitHub API and these env vars on the server under test (npm run test:e2e:mocked):
//   SPONSOR_SYNC_GITHUB_REPO=e2e-org/e2e-repo SPONSOR_SYNC_GITHUB_TOKEN=e2e-github-token

const test = makeCvTest({ name: "Sponsor Tester" });
const db = () => getAdminClient();

const REMOVED_NAME = "E2E Removed Sponsor Holdings Ltd";

async function activeCount(filter: { city?: string; rating?: string; route?: string }): Promise<number> {
  let query = filter.route
    ? db().from("sponsors").select("id, sponsor_routes!inner(route)", { count: "exact", head: true }).eq("sponsor_routes.route", filter.route)
    : db().from("sponsors").select("id", { count: "exact", head: true });
  query = query.eq("is_active", true);
  if (filter.city) query = query.eq("town_city_normalized", filter.city);
  if (filter.rating) query = query.eq("rating", filter.rating);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

const resultCards = (page: Page) => page.locator("a[href^='/visa-sponsors/companies/']");

test.describe("visa sponsor directory (real register)", () => {
  test("official data: original names, source date, and normalized names kept in the database", async ({ open }) => {
    const { data: rows, error } = await db()
      .from("sponsors")
      .select("company_name, company_name_normalized, company_name_search, source_date, import_id")
      .ilike("company_name", "Rolls-Royce plc")
      .eq("is_active", true);
    expect(error).toBeNull();
    expect(rows?.length ?? 0).toBeGreaterThan(0);
    const row = rows![0];
    expect(row.company_name).toBe("Rolls-Royce plc"); // the register's own spelling, kept for display
    expect(row.company_name_normalized).toBe("rolls-royce plc"); // the importer's dedup key
    expect(row.company_name_search).toBe("rolls royce plc"); // punctuation-free form used for matching

    const { data: sync } = await db().from("sponsor_sync_status").select("import_id, source_date, sponsor_count").single();
    expect(sync?.import_id).toBe(row.import_id);
    expect(row.source_date).toBe(sync?.source_date);
    expect(sync?.sponsor_count).toBeGreaterThan(100_000); // the whole real register, not a sample

    const page = await open();
    await page.goto("/visa-sponsors?company=Rolls-Royce%20plc");
    await dismissCookieBanner(page);
    const formatted = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(sync!.source_date as string));
    await expect(page.getByText(`Data as of ${formatted}`)).toBeVisible();
    await expect(page.getByRole("link", { name: /Rolls-Royce plc/ }).first()).toBeVisible();
  });

  test("fuzzy search: punctuation, typos, word order and '&' still find the company", async ({ open }) => {
    const page = await open();
    for (const term of ["rolls royce", "Rols Royse plc", "Royce Rolls"]) {
      await page.goto(`/visa-sponsors?company=${encodeURIComponent(term)}`);
      await expect(page.getByText(/sponsors? found/)).toBeVisible();
      await expect(resultCards(page).filter({ hasText: "Rolls-Royce plc" }).first(), `"${term}" should find Rolls-Royce plc`).toBeVisible();
    }
  });

  test("a trading name on the register finds its company, saying which name matched", async ({ open }) => {
    // A real alias (the register's "t/a" names), chosen so the search is specific enough for it to be on page one.
    const { data: aliases } = await db().from("sponsor_aliases").select("alias_name, sponsor_id").limit(400);
    const anon = (await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    let picked: { alias: string; sponsorId: string } | null = null;
    for (const alias of aliases ?? []) {
      if (alias.alias_name.length < 8) continue;
      const { data } = await anon.rpc("search_sponsors", { p_query: alias.alias_name, p_limit: 5 });
      const hit = (data ?? []).find((row: { id: string; matched_alias: string | null }) => row.id === alias.sponsor_id && row.matched_alias);
      if (hit && (data?.[0]?.total_count ?? 99) <= 3) {
        picked = { alias: alias.alias_name, sponsorId: alias.sponsor_id };
        break;
      }
    }
    expect(picked, "the real register should contain at least one specific trading-name alias").not.toBeNull();

    const page = await open();
    await page.goto(`/visa-sponsors?company=${encodeURIComponent(picked!.alias)}`);
    await expect(page.locator(`a[href='/visa-sponsors/companies/${picked!.sponsorId}']`)).toBeVisible();
    await expect(page.getByText("Matched via trading/legal name:").first()).toBeVisible();
  });

  test("city, route and rating filters narrow the real register and the count is exact", async ({ open }) => {
    const expected = await activeCount({ city: "leeds", rating: "a_rating", route: "Skilled Worker" });
    expect(expected).toBeGreaterThan(0);
    const page = await open();
    await page.goto("/visa-sponsors?city=Leeds&route=Skilled%20Worker&rating=a_rating");
    await expect(page.getByText(`${expected} sponsor${expected === 1 ? "" : "s"} found`)).toBeVisible();
    for (const description of await page.locator("a[href^='/visa-sponsors/companies/'] [data-slot='card-description']").allTextContents()) {
      expect(description.toLowerCase()).toContain("leeds");
    }

    // The same filters through the form itself.
    await page.goto("/visa-sponsors");
    await page.getByLabel("Company name").fill("university");
    await page.getByLabel("Town / city").fill("Leeds");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/company=university/);
    await expect(page).toHaveURL(/city=Leeds/);
    await expect(resultCards(page).first()).toBeVisible();
  });

  test("company page shows the real record, routes, aliases and source date", async ({ open }) => {
    const { data: sponsor } = await db().from("sponsors").select("id, company_name, town_city, rating").ilike("company_name", "Rolls-Royce plc").eq("is_active", true).limit(1).single();
    const { data: routes } = await db().from("sponsor_routes").select("route").eq("sponsor_id", sponsor!.id);
    expect(routes?.length ?? 0).toBeGreaterThan(0);

    const page = await open();
    await page.goto(`/visa-sponsors/companies/${sponsor!.id}`);
    await expect(page.getByRole("heading", { level: 1, name: sponsor!.company_name })).toBeVisible();
    await expect(page.getByText(routes![0].route).first()).toBeVisible();
    await expect(page.getByText("Last verified", { exact: true })).toBeVisible();
    await expect(page.getByText("No longer on the register")).toHaveCount(0);
    await page.goto("/visa-sponsors/companies/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { level: 1, name: sponsor!.company_name })).toHaveCount(0);
  });

  test("a sponsor that dropped off the register: hidden from search, page says so with the date", async ({ open }) => {
    const { data: sync } = await db().from("sponsor_sync_status").select("import_id, source_date").single();
    const { data: inserted, error } = await db()
      .from("sponsors")
      .insert({
        import_id: sync!.import_id,
        company_name: REMOVED_NAME,
        company_name_normalized: REMOVED_NAME.toLowerCase(),
        town_city: "Leeds",
        town_city_normalized: "leeds",
        rating: "a_rating",
        rating_raw: "Worker (A rating)",
        source_date: sync!.source_date,
        is_active: false,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    try {
      await db().from("sponsor_sync_changes").insert({ import_id: sync!.import_id, sponsor_id: inserted!.id, change_type: "deactivated", company_name: REMOVED_NAME });

      const page = await open();
      // Search is fuzzy, so other real "... Holdings Ltd" companies can match; this one must not.
      await page.goto(`/visa-sponsors?company=${encodeURIComponent(REMOVED_NAME)}&city=Leeds`);
      await expect(page.getByText(/sponsors? found|No sponsors found/)).toBeVisible();
      await expect(page.getByText(REMOVED_NAME)).toHaveCount(0);
      await expect(page.locator(`a[href='/visa-sponsors/companies/${inserted!.id}']`)).toHaveCount(0);

      await page.goto(`/visa-sponsors/companies/${inserted!.id}`);
      await expect(page.getByRole("heading", { level: 1, name: REMOVED_NAME })).toBeVisible();
      await expect(page.getByRole("status").getByText("No longer on the register")).toBeVisible();
      await expect(page.getByText("Last listed", { exact: true })).toBeVisible();
      await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", /noindex/);
    } finally {
      await db().from("sponsor_sync_changes").delete().eq("sponsor_id", inserted!.id); // no cascade from the sponsor
      await db().from("sponsors").delete().eq("id", inserted!.id);
    }
  });

  test("city pages and the statistics page report real counts", async ({ open }) => {
    const london = await activeCount({ city: "london" });
    expect(london).toBeGreaterThan(1000);
    const total = await activeCount({});
    const skilled = await activeCount({ route: "Skilled Worker" });

    const page = await open();
    await page.goto("/visa-sponsors/cities");
    await expect(page.getByRole("link", { name: /London/ }).first()).toBeVisible();

    await page.goto("/visa-sponsors/cities/london");
    await expect(page.getByText(`${london.toLocaleString("en-US")} licensed UK sponsors based in London`)).toBeVisible();
    await expect(resultCards(page).first()).toBeVisible();

    await page.goto("/visa-sponsors/statistics");
    await expect(page.getByText(`${total.toLocaleString("en-US")} active UK sponsor licences`)).toBeVisible();
    await expect(page.getByText("Skilled Worker").first()).toBeVisible();
    await expect(page.getByText(skilled.toLocaleString("en-US")).first()).toBeVisible();
  });
});

test.describe("admin sponsor sync (real import log)", () => {
  test("a plain account cannot open it", async ({ open }) => {
    const page = await open();
    await page.goto("/admin/sponsors");
    await expect(page).not.toHaveURL(/\/admin\/sponsors/);
  });

  test("staff see the status, source date, counts, import log and can run a sync", async ({ open, account }) => {
    await makeSuperAdmin(account.user.id);
    const { data: sync } = await db().from("sponsor_sync_status").select("source_date, sponsor_count").single();
    const { data: latest } = await db().from("sponsor_imports").select("status, source_date, sponsor_count").order("started_at", { ascending: false }).limit(1).single();
    const active = await activeCount({});
    const { count: inactive } = await db().from("sponsors").select("id", { count: "exact", head: true }).eq("is_active", false);

    const page = await open();
    await page.goto("/admin/sponsors");
    await dismissCookieBanner(page);
    await expect(page.getByRole("heading", { name: "Sponsor register sync" })).toBeVisible();
    await expect(page.getByText(latest!.status === "completed" ? "Healthy" : /Last run failed|Sync running|Stale/)).toBeVisible();
    await expect(page.getByText("On the register now").locator("..").locator("..").getByText(active.toLocaleString("en-GB"), { exact: true })).toBeVisible();
    const removed = page.getByText("Removed from the register").locator("..").locator("..");
    await expect(removed.getByText((inactive ?? 0).toLocaleString("en-GB"), { exact: true })).toBeVisible();
    const sourceDate = new Date(`${sync!.source_date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    await expect(page.getByText(sourceDate).first()).toBeVisible();

    const history = page.getByRole("table").last();
    await expect(history.getByRole("row")).not.toHaveCount(1); // header + at least one real import
    await expect(history.getByText(String(latest!.sponsor_count?.toLocaleString("en-GB") ?? "")).first()).toBeVisible();

    if (providersMocked) {
      await page.getByRole("button", { name: "Run sync now" }).click();
      await expect(page.getByRole("status").getByText(/Sync started/)).toBeVisible();
      const { data: audit } = await db().from("admin_audit_logs").select("action").eq("action", "sponsor_sync.trigger").eq("actor_id", account.user.id);
      expect(audit?.length ?? 0).toBe(1); // the trigger is audit-logged
    }
  });
});
