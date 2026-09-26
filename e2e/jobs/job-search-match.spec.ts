import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "../support/admin-client";
import { makeSuperAdmin } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest, providersMocked } from "../support/cv-fixture";

// Job Search / Match, end to end against the REAL database with the two job feeds mocked at the network layer (the app
// has no Adzuna/Reed credentials here — see e2e/support/mock-providers/mock-agent.mjs for the scenarios). The adapters,
// normalizers, sync runner, dedupe, expiry sweep, search SQL, sponsor cross-check, saved jobs, tracker link and match
// flow all run for real. Every listing the feeds return has an external id starting "e2e-" and is deleted afterwards;
// nothing here is (or ever should be) seeded into the product.
//
// Needs the mocked-provider server, started with:
//   CRON_SECRET=e2e-cron-secret ADZUNA_APP_ID=e2e-adzuna-id ADZUNA_APP_KEY=e2e-adzuna-key REED_API_KEY=e2e-reed-key
//   ANTHROPIC_API_KEY=e2e-anthropic-key   (any value: the Anthropic call itself is mocked)
// and is serial: each step builds on the rows the previous one wrote.

const test = makeCvTest({ name: "Jobs Tester", plan: "pro" }); // pro includes job_match
const db = () => getAdminClient();
const CRON = { authorization: "Bearer e2e-cron-secret" };

test.skip(!providersMocked || process.env.CRON_SECRET !== "e2e-cron-secret", "needs the mocked-provider server with the e2e feed credentials");
test.describe.configure({ mode: "serial" });

const suiteStartedAt = new Date().toISOString();

async function cleanup() {
  const { data: jobs } = await db().from("jobs").select("id").like("external_id", "e2e-%");
  const ids = (jobs ?? []).map((job) => job.id as string);
  if (ids.length > 0) {
    await db().from("applications").delete().in("job_id", ids);
    await db().from("saved_jobs").delete().in("job_id", ids);
    await db().from("jobs").delete().in("id", ids); // job_matches cascade
  }
  await db().from("job_imports").delete().gte("started_at", suiteStartedAt);
  for (const slug of ["adzuna", "reed"]) {
    const { data: source } = await db().from("job_sources").select("id").eq("slug", slug).maybeSingle();
    if (!source) continue;
    const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).eq("source_id", source.id);
    if (!count) await db().from("job_sources").delete().eq("id", source.id);
  }
}

async function sync(request: APIRequestContext, provider: "adzuna" | "reed", keywords: string, headers: Record<string, string> = CRON) {
  // The routes rate-limit even a valid caller (3 runs / 10 min); a suite that runs many scenarios resets the window.
  await db().from("anonymous_rate_limits").delete().like("scope", "cron_jobs_sync%");
  return request.get(`/api/cron/jobs-sync-${provider}?keywords=${keywords}&maxPages=1`, { headers });
}

async function jobByExternalId(externalId: string) {
  const { data } = await db().from("jobs").select("id, is_active, duplicate_of_job_id, expires_at, last_seen_at, title, company_name").eq("external_id", externalId).maybeSingle();
  return data;
}

/** What a signed-out visitor is allowed to see: the jobs table's own policy, applied by the database. */
async function visibleExternalIds(): Promise<string[]> {
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await anon.from("jobs").select("external_id").like("external_id", "e2e-%");
  return (data ?? []).map((row) => row.external_id as string).sort();
}

const cards = (page: Page) => page.getByTestId("job-card");
const card = (page: Page, text: string) => cards(page).filter({ hasText: text });
const total = (page: Page) => page.getByTestId("job-total");

test.beforeAll(cleanup);
test.afterAll(cleanup);

test.describe("job feeds: sync, dedupe, expiry, errors", () => {
  test("nothing is shown until a real sync has run: an honest empty state, no placeholder jobs", async ({ open }) => {
    const { count } = await db().from("jobs").select("id", { count: "exact", head: true });
    expect(count ?? 0, "the linked database should hold no jobs before the feeds have synced").toBe(0);

    const page = await open();
    await page.goto("/dashboard/jobs");
    await dismissCookieBanner(page);
    await expect(page.locator("#main-content").getByRole("heading", { name: "Job Feed" })).toBeVisible();
    await expect(page.getByText("No jobs have been synced yet")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
  });

  test("the sync routes are closed to anyone without the cron secret and reject bad input", async ({ request }) => {
    expect((await sync(request, "adzuna", "e2e-good", {})).status()).toBe(401);
    expect((await sync(request, "reed", "e2e-good", { authorization: "Bearer wrong" })).status()).toBe(401);
    const badPages = await request.get("/api/cron/jobs-sync-adzuna?maxPages=99", { headers: CRON });
    expect(badPages.status()).toBe(400);
    const badKeywords = await request.get(`/api/cron/jobs-sync-reed?keywords=${"x".repeat(150)}`, { headers: CRON });
    expect(badKeywords.status()).toBe(400);
    expect(await jobByExternalId("e2e-adz-1")).toBeNull(); // nothing ran
  });

  test("Adzuna sync: normalizes, skips malformed listings, dedupes, and logs the run", async ({ request }) => {
    const response = await sync(request, "adzuna", "e2e-good");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ fetchedCount: 7, createdCount: 4, updatedCount: 0, duplicateCount: 1, skippedCount: 2 });
    expect(body.warnings[0]).toMatch(/2 listings skipped as malformed/);

    const original = await jobByExternalId("e2e-adz-2");
    const duplicate = await jobByExternalId("e2e-adz-5"); // same employer + title + location, in the same batch
    expect(original?.duplicate_of_job_id).toBeNull();
    expect(duplicate?.duplicate_of_job_id).toBe(original?.id);
    expect(await jobByExternalId("e2e-adz-bad-1")).toBeNull();
    expect(await jobByExternalId("e2e-adz-bad-2")).toBeNull(); // javascript: link never reached the database

    const { data: run } = await db().from("job_imports").select("status, fetched_count, created_count, duplicate_count, skipped_count, error_message").eq("id", body.importId).single();
    expect(run).toMatchObject({ status: "completed", fetched_count: 7, created_count: 4, duplicate_count: 1, skipped_count: 2 });
    expect(run?.error_message).toMatch(/skipped as malformed/);

    expect(await visibleExternalIds()).toEqual(["e2e-adz-1", "e2e-adz-2", "e2e-adz-3"]); // the duplicate is stored but hidden
  });

  test("Reed sync: cross-source duplicates are hidden, expired listings never show, re-runs are idempotent", async ({ request }) => {
    const first = await (await sync(request, "reed", "e2e-good")).json();
    expect(first).toMatchObject({ fetchedCount: 4, createdCount: 3, updatedCount: 0, duplicateCount: 1, skippedCount: 1 });

    const adzunaOriginal = await jobByExternalId("e2e-adz-1");
    expect((await jobByExternalId("e2e-reed-1"))?.duplicate_of_job_id).toBe(adzunaOriginal?.id); // Adzuna already listed it
    expect((await jobByExternalId("e2e-reed-3"))?.is_active).toBe(true); // stored active, but expired: invisible until swept
    expect(await visibleExternalIds()).toEqual(["e2e-adz-1", "e2e-adz-2", "e2e-adz-3", "e2e-reed-2"]);

    const second = await (await sync(request, "reed", "e2e-good")).json();
    expect(second).toMatchObject({ createdCount: 0, updatedCount: 3, duplicateCount: 0 });
    const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).like("external_id", "e2e-reed-%");
    expect(count).toBe(3);
  });

  test("feed errors are classified, recorded and never damage the existing feed", async ({ request }) => {
    const before = await visibleExternalIds();
    const cases: [provider: "adzuna" | "reed", keywords: string, message: RegExp][] = [
      ["adzuna", "e2e-401", /rejected the API credentials/],
      ["reed", "e2e-401", /rejected the API credentials/],
      ["adzuna", "e2e-500", /search failed \(500\)/],
      ["adzuna", "e2e-html", /isn't JSON/],
      ["reed", "e2e-shape", /no results list/],
      ["reed", "e2e-429-always", /rate limit exceeded/],
    ];
    for (const [provider, keywords, message] of cases) {
      const response = await sync(request, provider, keywords);
      expect(response.status(), `${provider} ${keywords}`).toBe(502);
      expect((await response.json()).error).toMatch(message);
      const { data: latest } = await db()
        .from("job_imports")
        .select("status, error_message, created_count")
        .eq("run_type", "sync")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();
      expect(latest?.status, `${provider} ${keywords}`).toBe("failed");
      expect(latest?.error_message).toMatch(message);
    }
    expect(await visibleExternalIds()).toEqual(before); // a provider outage empties nothing

    // A throttled request is retried after Retry-After and the run then succeeds (Reed already has these jobs: updates).
    const recovered = await sync(request, "reed", "e2e-429-ok");
    expect(recovered.status()).toBe(200);
  });

  test("the feed page says which source is behind while still showing its last good listings", async ({ open }) => {
    // The latest Reed run above succeeded (429-ok, empty page); make the newest Adzuna run the failed one.
    const adzuna = await db().from("job_sources").select("id").eq("slug", "adzuna").single();
    await db().from("job_imports").insert({ run_type: "sync", source_id: adzuna.data!.id, status: "failed", completed_at: new Date().toISOString(), error_message: "Adzuna rejected the API credentials (401)" });

    const page = await open();
    await page.goto("/dashboard/jobs");
    await expect(page.getByText("Adzuna's latest update failed")).toBeVisible();
    await expect(page.getByText(/Its listings below are from its last successful update/)).toBeVisible();
    await expect(page.getByTestId("job-feed-updated")).toBeVisible();
    await expect(cards(page).first()).toBeVisible(); // still listing what it has
  });
});

test.describe("search, filters and sponsor cross-check", () => {
  test("keywords search title, company AND description, with partial words", async ({ open }) => {
    const page = await open();
    await page.goto("/dashboard/jobs?q=E2E");
    await dismissCookieBanner(page);
    await expect(total(page)).toHaveText("4 jobs found");

    await page.goto("/dashboard/jobs?q=Kubernetes"); // only in adz-3's description
    await expect(total(page)).toHaveText("1 job found");
    await expect(card(page, "E2E Software Engineer")).toBeVisible();

    await page.goto("/dashboard/jobs?q=analy"); // partial word
    await expect(card(page, "E2E Data Analyst")).toBeVisible();

    await page.goto("/dashboard/jobs?q=zzznotarealjob");
    await expect(page.getByText("No jobs found")).toBeVisible();
    await expect(page.getByText("No jobs have been synced yet")).toHaveCount(0); // it is the filters, not an empty feed
  });

  test("location, source, date and sort filters", async ({ open }) => {
    const page = await open();
    await page.goto("/dashboard/jobs?q=E2E&location=leeds");
    await expect(total(page)).toHaveText("1 job found");
    await expect(card(page, "E2E Nurse Practitioner")).toBeVisible();

    const { data: reed } = await db().from("job_sources").select("id").eq("slug", "reed").single();
    await page.goto(`/dashboard/jobs?q=E2E&source=${reed!.id}`);
    await expect(total(page)).toHaveText("1 job found");
    await expect(card(page, "E2E Marketing Lead")).toBeVisible();

    await page.goto("/dashboard/jobs?q=E2E&posted=3"); // adz-3 was posted 3 days ago: just outside
    await expect(total(page)).toHaveText("3 jobs found");
    await expect(card(page, "E2E Software Engineer")).toHaveCount(0);

    await page.goto("/dashboard/jobs?q=E2E&sort=company_az");
    await expect(cards(page).first()).toContainText("Barclays Bank PLC");
    await expect(cards(page).last()).toContainText("Rolls-Royce plc");
  });

  test("the filter form drives the same search", async ({ open }) => {
    const page = await open();
    await page.goto("/dashboard/jobs");
    await page.getByLabel("Keywords").fill("nurse");
    await page.getByLabel("Location").fill("Leeds");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/q=nurse/);
    await expect(page).toHaveURL(/location=Leeds/);
    await expect(card(page, "E2E Nurse Practitioner")).toBeVisible();
  });

  test("licensed-sponsors-only filters the whole result set against the real register", async ({ open }) => {
    const { data: keys } = await db().from("sponsor_confirmed_keys").select("key").in("key", ["rolls-royce plc", "barclays bank plc", "e2e fictional employer ltd"]);
    const confirmed = new Set((keys ?? []).map((row) => row.key as string));
    expect(confirmed.has("rolls-royce plc"), "Rolls-Royce plc should be on the imported register").toBe(true);
    expect(confirmed.has("e2e fictional employer ltd")).toBe(false);
    const expected = ["e2e-adz-1", "e2e-adz-3"].filter((_id, index) => confirmed.has(index === 0 ? "rolls-royce plc" : "barclays bank plc")).length;

    const page = await open();
    await page.goto("/dashboard/jobs?q=E2E&sponsorOnly=1");
    await expect(total(page)).toHaveText(`${expected} job${expected === 1 ? "" : "s"} found`);
    await expect(card(page, "E2E Data Analyst")).toBeVisible();
    await expect(card(page, "E2E Nurse Practitioner")).toHaveCount(0);
    await expect(card(page, "E2E Marketing Lead")).toHaveCount(0);

    // Combined with another filter.
    await page.goto("/dashboard/jobs?q=E2E&sponsorOnly=1&location=derby");
    await expect(total(page)).toHaveText("1 job found");
  });

  test("each card carries the sponsor cross-check: confirmed links to the register, others say nothing", async ({ open }) => {
    const page = await open();
    await page.goto("/dashboard/jobs?q=E2E");
    const rolls = card(page, "Rolls-Royce plc");
    const badge = rolls.getByRole("link", { name: /Licensed sponsor/ });
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("href", /\/visa-sponsors\/companies\/[0-9a-f-]{36}$/);
    await expect(card(page, "E2E Fictional Employer Ltd").first()).not.toContainText("Licensed sponsor");
    await expect(card(page, "E2E Fictional Employer Ltd").first()).not.toContainText("Not a sponsor"); // never a negative claim
  });
});

test.describe("saved jobs, add to tracker, match score", () => {
  test("save a job, see it on the saved page with its snapshot, add a note, remove it", async ({ open, account }) => {
    const page = await open();
    await page.goto("/dashboard/jobs?q=E2E");
    await dismissCookieBanner(page);
    const rolls = card(page, "Rolls-Royce plc");
    await rolls.getByRole("button", { name: "Save to wishlist" }).click();
    await expect(rolls.getByRole("button", { name: "Remove from wishlist" })).toBeVisible();

    const { data: saved } = await db().from("saved_jobs").select("*").eq("user_id", account.user.id);
    expect(saved).toHaveLength(1);
    expect(saved![0]).toMatchObject({ company_name: "Rolls-Royce plc", job_title: "E2E Data Analyst", source_name: "Adzuna", sponsor_status: "confirmed_sponsor" });
    expect(saved![0].url).toBe("https://www.adzuna.co.uk/jobs/land/ad/e2e-adz-1");

    // The saved state survives a reload, and the saved page lists it.
    await page.reload();
    await expect(card(page, "Rolls-Royce plc").getByRole("button", { name: "Remove from wishlist" })).toBeVisible();
    await page.getByRole("link", { name: "Saved jobs" }).click();
    await expect(page).toHaveURL(/\/dashboard\/jobs\/saved$/);
    const savedCard = page.getByTestId("saved-job-card");
    await expect(savedCard).toHaveCount(1);
    await expect(savedCard).toContainText("Licensed sponsor when saved");

    await savedCard.getByLabel("Your notes").fill("Ask about the graduate scheme.");
    await savedCard.getByRole("button", { name: "Save note" }).click();
    await expect(savedCard.getByText("Note saved")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("saved-job-card").getByLabel("Your notes")).toHaveValue("Ask about the graduate scheme.");

    await page.getByRole("button", { name: /Remove E2E Data Analyst from saved jobs/ }).click();
    await expect(page.getByText("No saved jobs yet")).toBeVisible();
    const { count } = await db().from("saved_jobs").select("id", { count: "exact", head: true }).eq("user_id", account.user.id);
    expect(count).toBe(0);
  });

  test("a saved job outlives its listing: the snapshot stays and it is marked no longer listed", async ({ open }) => {
    const page = await open();
    await page.goto("/dashboard/jobs?q=Marketing");
    await card(page, "E2E Marketing Lead").getByRole("button", { name: "Save to wishlist" }).click();
    await expect(card(page, "E2E Marketing Lead").getByRole("button", { name: "Remove from wishlist" })).toBeVisible();

    const reed2 = await jobByExternalId("e2e-reed-2");
    await db().from("jobs").update({ is_active: false }).eq("id", reed2!.id);
    await page.goto("/dashboard/jobs/saved");
    const savedCard = page.getByTestId("saved-job-card");
    await expect(savedCard).toContainText("E2E Marketing Lead");
    await expect(savedCard).toContainText("No longer listed");
    await db().from("jobs").update({ is_active: true }).eq("id", reed2!.id);
    await savedCard.getByRole("button", { name: /Remove .* from saved jobs/ }).click();
    await expect(page.getByText("No saved jobs yet")).toBeVisible();
  });

  test("Add to tracker creates a Wishlist application linked to the listing, once", async ({ open, account }) => {
    const page = await open();
    await page.goto("/dashboard/jobs?q=Marketing");
    const lead = card(page, "E2E Marketing Lead");
    await lead.getByRole("button", { name: "Add to tracker" }).click();
    await expect(lead.getByRole("link", { name: "In tracker" })).toBeVisible();

    const reed2 = await jobByExternalId("e2e-reed-2");
    const { data: applications } = await db().from("applications").select("*").eq("user_id", account.user.id);
    expect(applications).toHaveLength(1);
    expect(applications![0]).toMatchObject({
      job_id: reed2!.id,
      company_name: "E2E Fictional Employer Ltd",
      job_title: "E2E Marketing Lead",
      location: "Bristol",
      status: "wishlist",
      url: "https://www.reed.co.uk/jobs/e2e-reed-2",
      sponsor_status: "not_found",
    });
    // Reed's real closing date (10 days out) becomes the deadline.
    const expectedDeadline = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    expect(applications![0].deadline).toBe(expectedDeadline);

    // Reload: still tracked, no second button. The database also refuses a second row for the same (user, job).
    await page.reload();
    await expect(card(page, "E2E Marketing Lead").getByRole("link", { name: "In tracker" })).toBeVisible();
    const duplicate = await db().from("applications").insert({ user_id: account.user.id, job_id: reed2!.id, company_name: "x", job_title: "y", status: "wishlist" });
    expect(duplicate.error?.code).toBe("23505");

    await card(page, "E2E Marketing Lead").getByRole("link", { name: "In tracker" }).click();
    await expect(page).toHaveURL(/\/dashboard\/applications/);
    await expect(page.getByText("E2E Marketing Lead").first()).toBeVisible();
  });

  test("a saved job can be added to the tracker from the saved page, with its sponsor status", async ({ open, account }) => {
    const page = await open();
    await page.goto("/dashboard/jobs?q=Kubernetes");
    await card(page, "Barclays Bank PLC").getByRole("button", { name: "Save to wishlist" }).click();
    await expect(card(page, "Barclays Bank PLC").getByRole("button", { name: "Remove from wishlist" })).toBeVisible();

    await page.goto("/dashboard/jobs/saved");
    const savedCard = page.getByTestId("saved-job-card");
    await savedCard.getByRole("button", { name: "Add to tracker" }).click();
    await expect(savedCard.getByRole("link", { name: "In tracker" })).toBeVisible();

    const { data: applications } = await db().from("applications").select("job_id, company_name, sponsor_status, status").eq("user_id", account.user.id).eq("company_name", "Barclays Bank PLC");
    expect(applications).toEqual([expect.objectContaining({ status: "wishlist", sponsor_status: "confirmed_sponsor" })]);
    expect(applications![0].job_id).not.toBeNull();
  });

  test("scoring a job against a CV gives 0-100 plus the skills / domain / seniority breakdown, persisted", async ({ open, account }) => {
    const cv = await seedCv(account.user.id, { title: "Jobs CV" });
    const page = await open();
    await page.goto(`/dashboard/jobs?q=E2E&cv=${cv.cvId}`);
    await dismissCookieBanner(page);

    const engineer = card(page, "E2E Software Engineer");
    await engineer.getByRole("button", { name: "Score this job" }).click();
    await expect(engineer.getByText("86/100")).toBeVisible({ timeout: 30_000 });
    await expect(engineer.getByText("Strong match")).toBeVisible();
    await engineer.getByRole("button", { name: "Match breakdown" }).click();
    for (const label of ["Core skills", "Tech / functional skills", "Domain fit", "Seniority"]) await expect(engineer.getByText(label, { exact: true })).toBeVisible();
    await expect(engineer.getByText("Eight years and a team lead role match the seniority asked for.")).toBeVisible();

    const analyst = card(page, "E2E Data Analyst");
    await analyst.getByRole("button", { name: "Score this job" }).click();
    await expect(analyst.getByText("64/100")).toBeVisible({ timeout: 30_000 });

    const jobId = (await jobByExternalId("e2e-adz-3"))!.id;
    const { data: match } = await db().from("job_matches").select("match_score, verdict, core_skills_score, tech_functional_skills_score, domain_fit_score, seniority_score").eq("user_id", account.user.id).eq("job_id", jobId).single();
    expect(match).toEqual({ match_score: 86, verdict: "strong_match", core_skills_score: 90, tech_functional_skills_score: 84, domain_fit_score: 72, seniority_score: 88 });

    // The stored score is shown on reload without another AI call, and drives threshold filtering and ordering.
    await page.reload();
    await expect(card(page, "E2E Software Engineer").getByText("86/100")).toBeVisible();
    await page.goto(`/dashboard/jobs?q=E2E&cv=${cv.cvId}&minScore=70`);
    await expect(total(page)).toHaveText("1 job found");
    await expect(card(page, "E2E Software Engineer")).toBeVisible();
    await page.goto(`/dashboard/jobs?q=E2E&cv=${cv.cvId}&minScore=50&sort=match_desc`);
    await expect(total(page)).toHaveText("2 jobs found");
    await expect(cards(page).first()).toContainText("E2E Software Engineer");
    await page.goto(`/dashboard/jobs?q=E2E&cv=${cv.cvId}&minScore=90`);
    await expect(page.getByText("No jobs found")).toBeVisible();
  });

  test("a plan without job matching gets a clear refusal, and nothing is scored or stored", async ({ open, account }) => {
    const cv = await seedCv(account.user.id, { title: "Gate CV" });
    const { data: subscription } = await db().from("subscriptions").select("*").eq("user_id", account.user.id).single();
    await db().from("subscriptions").delete().eq("user_id", account.user.id);
    try {
      const page = await open();
      await page.goto(`/dashboard/jobs?q=Nurse&cv=${cv.cvId}`);
      await card(page, "E2E Nurse Practitioner").getByRole("button", { name: "Score this job" }).click();
      await expect(card(page, "E2E Nurse Practitioner").getByRole("alert")).toBeVisible();
      const jobId = (await jobByExternalId("e2e-adz-2"))!.id;
      const { count } = await db().from("job_matches").select("id", { count: "exact", head: true }).eq("user_id", account.user.id).eq("job_id", jobId);
      expect(count).toBe(0);
    } finally {
      await db().from("subscriptions").insert(subscription!);
    }
  });
});

test.describe("expiry and admin visibility", () => {
  test("maintenance retires expired and stale jobs and promotes a duplicate whose original expired", async ({ request }) => {
    const adz1 = await jobByExternalId("e2e-adz-1");
    const adz3 = await jobByExternalId("e2e-adz-3");
    // Adzuna gives no expiry: an old last_seen_at is what retires its listings. Reed's adz-1 twin (e2e-reed-1) is hidden as its duplicate.
    await db().from("jobs").update({ last_seen_at: new Date(Date.now() - 40 * 86_400_000).toISOString() }).eq("id", adz3!.id);
    await db().from("jobs").update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", adz1!.id);
    expect(await visibleExternalIds()).not.toContain("e2e-reed-1");

    const response = await request.get("/api/cron/jobs-maintenance", { headers: CRON });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.deactivatedCount).toBeGreaterThanOrEqual(3); // reed-3 (expired), adz-1 (expired), adz-3 (stale)
    expect(body.promotedCount).toBeGreaterThanOrEqual(1);

    expect((await jobByExternalId("e2e-reed-3"))?.is_active).toBe(false);
    expect((await jobByExternalId("e2e-adz-1"))?.is_active).toBe(false);
    expect((await jobByExternalId("e2e-adz-3"))?.is_active).toBe(false);
    const visible = await visibleExternalIds();
    expect(visible).toContain("e2e-reed-1"); // promoted: the role is still open at Reed
    expect(visible).not.toContain("e2e-adz-1");
    expect(visible).not.toContain("e2e-adz-3");
    expect((await jobByExternalId("e2e-reed-1"))?.duplicate_of_job_id).toBeNull();
  });

  test("the admin job-feed page shows source health, runs, skipped counts and failures", async ({ open, account }) => {
    await makeSuperAdmin(account.user.id);
    const page = await open();
    await page.goto("/admin/jobs");
    await expect(page.getByRole("heading", { name: "Job feed health" })).toBeVisible();
    await expect(page.getByText("Adzuna", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Reed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Completed with warnings:").first()).toBeVisible();
    await expect(page.getByText(/skipped as malformed/).first()).toBeVisible();
    await expect(page.getByText("failed").first()).toBeVisible();
    await expect(page.getByText(/rejected the API credentials/).first()).toBeVisible();
  });
});
