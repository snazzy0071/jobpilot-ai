import { createClient } from "@supabase/supabase-js";
import { expect as baseExpect, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest, providersMocked } from "../support/cv-fixture";

// The Graduate Scheme preparation journey (scheme -> CV -> ATS -> tests -> interview -> tracker) against the REAL database.
// Only the AI provider is mocked (needed by the ATS check); every scheme here is created by the test (employer "E2EJP…",
// slug "e2ejp-…") and removed afterwards. Run with E2E_MOCK_PROVIDERS=1 for the ATS test; the rest needs no provider.

const test = makeCvTest({ name: "Journey Tester", plan: "premium" });
test.describe.configure({ mode: "serial" });
const expect = baseExpect.configure({ timeout: 30_000 }); // the dev server compiles on first use, which can be slow
test.beforeEach(() => { test.setTimeout(180_000); }); // the dev server is slow on first use

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const PUBLIC = "/graduate-schemes/e2ejp-main";
const PREPARE = "/dashboard/graduate-schemes/e2ejp-main/prepare";

function ukToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const scheme = (over: Record<string, unknown>) => ({
  sector: "technology", is_rolling: false, is_published: true, study_stages: [], locations: [], sponsorship_status: "not_published",
  source_url: "https://example.com/e2ejp-scheme", source_date: ukToday(-40), verified_at: ukToday(-10), ...over,
});

let mainId = "";
let otherId = "";
let goodCv = { cvId: "", versionId: "" };
let thinCv = { cvId: "", versionId: "" };

async function cleanup() {
  await db().from("graduate_schemes").delete().like("slug", "e2ejp-%");
}

async function loginContext(browser: Browser, user: IsolatedUser) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  return { context, page };
}

const step = (page: Page, key: string) => page.getByTestId(`step-${key}`);
const prepRow = async (userId: string, schemeId = mainId) => (await db().from("graduate_scheme_preparations").select("*").eq("user_id", userId).eq("scheme_id", schemeId).maybeSingle()).data;

async function go(page: Page, url: string) {
  await page.goto(url);
  await dismissCookieBanner(page);
}

test.afterAll(cleanup);

test.describe("scheme page and starting", () => {
  test.beforeAll(async () => {
    await cleanup();
    const { data, error } = await db().from("graduate_schemes").insert([
      scheme({ slug: "e2ejp-main", employer: "E2EJP Main", scheme_name: "Journey Programme", sponsorship_status: "sponsors", locations: ["London"], salary: "£40,000", deadline_on: ukToday(10), opens_on: ukToday(-5), application_url: "https://example.com/e2ejp-apply", description: "A test programme." }),
      scheme({ slug: "e2ejp-other", employer: "E2EJP Other", scheme_name: "Other Programme" }),
      scheme({ slug: "e2ejp-draft", employer: "E2EJP Draft", scheme_name: "Draft Programme", is_published: false }),
    ]).select("id, slug");
    if (error) throw new Error(error.message);
    mainId = data!.find((r) => r.slug === "e2ejp-main")!.id;
    otherId = data!.find((r) => r.slug === "e2ejp-other")!.id;
    const ev = { source_url: "https://example.com/e2ejp-selection", source_date: ukToday(-40), verified_at: ukToday(-10), is_required: true, display_order: 0, label: null, provider: null, notes: null };
    const { error: mapError } = await db().from("graduate_scheme_assessments").insert([
      { scheme_id: mainId, assessment_type: "numerical", ...ev, display_order: 1 },
      { scheme_id: mainId, assessment_type: "hackerrank", ...ev, display_order: 2 },
    ]);
    if (mapError) throw new Error(mapError.message);
    // Compile the routes under test before the first assertion (the dev server compiles on first use, and a request that lands
    // mid-compile can be answered with a transient 404 that has nothing to do with the app).
    for (const path of [PUBLIC, PREPARE, "/graduate-schemes/e2ejp-other"]) await fetch(`${BASE_URL}${path}`, { redirect: "manual" }).catch(() => undefined);
  });

  test("a visitor is invited to sign in, and the journey itself needs an account", async ({ page }) => {
    await page.goto(PUBLIC);
    const invite = page.getByTestId("preparation-signin");
    await expect(invite).toBeVisible();
    await expect(invite.getByRole("link", { name: "Sign in to prepare" })).toHaveAttribute("href", `/login?redirect=${encodeURIComponent(PREPARE)}`);
    await expect(page.getByTestId("preparation-summary")).toHaveCount(0);
    await page.goto(PREPARE);
    await expect(page).toHaveURL(/\/login/);
  });

  test("a signed-in user sees the eight things at a glance, honestly empty before they start", async ({ open, account }) => {
    const page = await open();
    await go(page, PUBLIC);
    const summary = page.getByTestId("preparation-summary");
    await expect(summary.getByTestId("prep-percent")).toHaveText("Not started yet");
    await expect(summary.getByTestId("sum-deadline")).toContainText("Closes in 10 days");
    await expect(summary.getByTestId("sum-sponsorship")).toContainText("Sponsors");
    await expect(summary.getByTestId("sum-assessments")).toContainText("Numerical reasoning test, HackerRank-style coding assessment");
    await expect(summary.getByTestId("sum-cv")).toContainText("No CV chosen");
    await expect(summary.getByTestId("sum-ats")).toContainText("Not checked yet");
    await expect(summary.getByTestId("sum-tests")).toContainText("0 of 1 test type ready");
    await expect(summary.getByTestId("sum-interview")).toContainText("No mock interview yet");
    await expect(summary.getByTestId("sum-tracker")).toContainText("Not in your tracker");
    expect(await prepRow(account.user.id)).toBeNull();

    await summary.getByRole("button", { name: "Prepare application" }).click();
    await expect(summary.getByRole("link", { name: "Continue preparing" })).toBeVisible();
    expect(await prepRow(account.user.id)).toMatchObject({ user_id: account.user.id, scheme_id: mainId, cv_id: null });
    await expect(summary.getByRole("link", { name: "Continue preparing" })).toHaveAttribute("href", PREPARE);
    await page.goto(PREPARE);
    await expect(page.getByRole("heading", { name: /Prepare your application/ })).toBeVisible();
  });

  test("drafts and unknown schemes have no journey", async ({ open }) => {
    const page = await open();
    for (const slug of ["e2ejp-draft", "no-such-scheme"]) {
      expect((await page.goto(`/dashboard/graduate-schemes/${slug}/prepare`))?.status()).toBe(404);
    }
  });
});

test.describe("the journey", () => {
  test("shows the six steps in order, saved per user and scheme, with the next step marked", async ({ open, account }) => {
    const page = await open();
    await go(page, PREPARE);
    await expect(page.getByRole("heading", { name: /Prepare your application/ })).toContainText("Journey Programme");
    const links = page.getByTestId("stepper").getByRole("link");
    await expect(links).toHaveCount(6);
    await expect(links).toContainText(["1. Scheme", "2. CV", "3. ATS check", "4. Tests", "5. Interview", "6. Tracker"]);
    await expect(page.getByTestId("journey-percent")).toHaveText("17%"); // 1 of 6 steps (scheme) done
    await expect(step(page, "scheme")).toHaveAttribute("data-status", "done");
    await expect(step(page, "cv")).toHaveAttribute("data-next", "true");
    await expect(page.locator('[data-next="true"]')).toHaveCount(1);

    // Scheme step repeats the essentials.
    await expect(step(page, "scheme").getByTestId("deadline")).toContainText("Closes in 10 days");
    await expect(step(page, "scheme").getByTestId("required-assessments")).toContainText("Numerical reasoning test");

    // Steps that need a CV say so.
    await expect(step(page, "ats").getByTestId("step-blocked")).toHaveText("Choose a CV first.");
    await expect(step(page, "interview").getByTestId("step-blocked")).toHaveText("Choose a CV first.");
    await expect(step(page, "cv")).toContainText("You don't have a CV yet");

    // Another scheme is independent: nothing started there.
    await go(page, "/graduate-schemes/e2ejp-other");
    await expect(page.getByTestId("prep-percent")).toHaveText("Not started yet");
    expect(await prepRow(account.user.id, otherId)).toBeNull();
  });

  test("CV step: readiness is worked out from what the CV really contains and the choice is saved", async ({ open, account }) => {
    goodCv = await seedCv(account.user.id, { title: "Journey CV" });
    thinCv = await seedCv(account.user.id, { title: "Thin CV" });
    await db().from("cv_summary").delete().eq("cv_version_id", thinCv.versionId);
    await db().from("cv_skills").delete().eq("cv_version_id", thinCv.versionId);

    const page = await open();
    await go(page, PREPARE);
    const cv = step(page, "cv");
    await page.getByLabel("CV to prepare for this scheme").selectOption({ label: "Thin CV" });
    await cv.getByRole("button", { name: "Choose this CV" }).click();
    await expect(cv.getByTestId("cv-percent")).toHaveText("60%");
    await expect(cv).toHaveAttribute("data-status", "in_progress");
    await expect(cv.locator('li[data-ok="false"]')).toHaveText([/Professional summary/, /Skills/]);
    await expect(cv.getByTestId("cv-issues")).toContainText("Add a professional summary");
    expect((await prepRow(account.user.id))!.cv_id).toBe(thinCv.cvId);
    await expect(cv.getByRole("link", { name: "Edit this CV" })).toHaveAttribute("href", `/dashboard/cvs/${thinCv.cvId}`);
    await expect(page.getByTestId("journey-percent")).toHaveText("17%");

    // Switch to a complete CV: done, and the next step moves on.
    await page.getByLabel("CV to prepare for this scheme").selectOption({ label: "Journey CV" });
    await cv.getByRole("button", { name: "Use this CV" }).click();
    await expect(cv.getByTestId("cv-percent")).toHaveText("100%");
    await expect(cv).toHaveAttribute("data-status", "done");
    await expect(step(page, "ats")).toHaveAttribute("data-next", "true");
    await expect(page.getByTestId("journey-percent")).toHaveText("33%");
    expect((await prepRow(account.user.id))!.cv_id).toBe(goodCv.cvId);

    // Persisted: a reload (and the scheme page) show the same.
    await page.reload();
    await expect(page.getByTestId("cv-percent")).toHaveText("100%");
    await expect(page.getByLabel("CV to prepare for this scheme")).toHaveValue(goodCv.cvId);
    await go(page, PUBLIC);
    await expect(page.getByTestId("sum-cv")).toContainText("100% — ready (Journey CV)");
  });

  test("the database refuses someone else's CV and a draft scheme, whatever the client sends", async ({ account }) => {
    const other = await createIsolatedUser({ fullName: "Other Journey User" });
    try {
      const foreign = await seedCv(other.id, { title: "Not yours" });
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      expect((await client.auth.signInWithPassword({ email: account.user.email, password: account.user.password })).error).toBeNull();

      expect((await client.from("graduate_scheme_preparations").update({ cv_id: foreign.cvId }).eq("scheme_id", mainId)).error).not.toBeNull();
      expect((await prepRow(account.user.id))!.cv_id).toBe(goodCv.cvId);
      const { data: draft } = await db().from("graduate_schemes").select("id").eq("slug", "e2ejp-draft").single();
      expect((await client.from("graduate_scheme_preparations").insert({ user_id: account.user.id, scheme_id: draft!.id })).error).not.toBeNull();
      // and nobody can start on behalf of another user
      expect((await client.from("graduate_scheme_preparations").insert({ user_id: other.id, scheme_id: otherId })).error).not.toBeNull();
    } finally {
      await deleteIsolatedUser(other.id);
    }
  });

  test("ATS step: a real scan of the chosen CV, linked to the scheme, its score shown everywhere", async ({ open, account }) => {
    test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");
    test.setTimeout(240_000);
    const page = await open();
    await go(page, PREPARE);
    const ats = step(page, "ats");
    await expect(ats.getByLabel("Text to check your CV against")).toHaveValue(/Journey Programme at E2EJP Main\.\nSector: Technology\./);
    await ats.getByLabel("Text to check your CV against").fill("Journey Programme at E2EJP Main. We want a platform engineer with TypeScript, GraphQL and Kubernetes experience who can mentor others.");
    await ats.getByRole("button", { name: "Run the ATS check" }).click();
    await expect(ats.getByTestId("ats-score")).toBeVisible({ timeout: 60_000 });

    const { data: scans } = await db().from("ats_scans").select("id, match_score, graduate_scheme_id, job_description, cv_version_id").eq("user_id", account.user.id);
    expect(scans).toHaveLength(1);
    expect(scans![0]).toMatchObject({ graduate_scheme_id: mainId, cv_version_id: goodCv.versionId });
    expect(scans![0].job_description).toContain("platform engineer with TypeScript");
    const score = scans![0].match_score as number;
    await expect(ats.getByTestId("ats-score")).toHaveText(String(score));
    await expect(ats).toHaveAttribute("data-status", score >= 70 ? "done" : "in_progress");
    await expect(ats.getByTestId("ats-result")).toContainText(score >= 70 ? "ready" : "below the 70");

    await go(page, PUBLIC);
    await expect(page.getByTestId("sum-ats")).toContainText(`${score}/100`);

    // It's the same scan in the ATS tool's own history (not a copy), linked to the scheme.
    const { data: keywords } = await db().from("ats_keywords").select("id").eq("scan_id", scans![0].id);
    expect(keywords!.length).toBeGreaterThan(0);
  });

  test("ATS step: the latest scan for this scheme is the one that counts", async ({ open, account }) => {
    // Deterministic from here on: a strong scan for this scheme, added directly (the AI mock's score varies).
    const { data: existing } = await db().from("ats_scans").select("id").eq("user_id", account.user.id).eq("graduate_scheme_id", mainId);
    const { error } = await db().from("ats_scans").insert({
      user_id: account.user.id, source: "cv_version", cv_version_id: goodCv.versionId, cv_text_snapshot: "cv", job_description: "x".repeat(40),
      match_score: 88, keyword_score: 81, structure_score: 90, format_score: 95, sections_score: 90, summary: "Strong.", prompt_version: "test", graduate_scheme_id: mainId,
      created_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(error).toBeNull();
    const page = await open();
    await go(page, PREPARE);
    await expect(step(page, "ats").getByTestId("ats-score")).toHaveText("88");
    await expect(step(page, "ats")).toHaveAttribute("data-status", "done");
    await expect(step(page, "ats").getByTestId("ats-result")).toContainText("Keyword match 81/100");
    expect(existing!.length).toBeLessThanOrEqual(1);
  });

  test("Tests step: progress comes from real practice on the scheme's test types; uncovered assessments are named", async ({ open, account }) => {
    const page = await open();
    await go(page, PREPARE);
    const tests = step(page, "tests");
    await expect(tests.getByTestId("test-row")).toHaveCount(1);
    await expect(tests.getByTestId("test-row")).toContainText("Numerical Reasoning");
    await expect(tests.getByTestId("test-stats")).toContainText("Not practised yet");
    await expect(tests).toHaveAttribute("data-status", "todo");
    await expect(tests.getByTestId("tests-uncovered")).toContainText("HackerRank-style coding assessment");
    await expect(tests.getByRole("link", { name: "Practise" })).toHaveAttribute("href", "/dashboard/test-prep");

    // Practise: a finished session of 12 numerical questions, 9 right (75%).
    const { data: type } = await db().from("test_types").select("id").eq("slug", "numerical-reasoning").single();
    const { data: questions } = await db().from("questions").select("id, subtype, difficulty, question_packs!inner(test_type_id)").eq("question_packs.test_type_id", type!.id).eq("is_active", true).limit(12);
    expect(questions).toHaveLength(12);
    const { data: session } = await db().from("test_sessions").insert({ user_id: account.user.id, question_pack_id: null, total_questions: 12, correct_count: 9, score: 75, completed_at: new Date().toISOString(), focus_test_type_id: type!.id, focus_subtype: "x" }).select("id").single();
    await db().from("test_answers").insert(questions!.map((q, i) => ({ test_session_id: session!.id, question_id: q.id, user_id: account.user.id, selected_answer: "a", is_correct: i < 9, test_type_id: type!.id, subtype: q.subtype, difficulty: q.difficulty })));

    await page.reload();
    await expect(tests.getByTestId("test-stats")).toContainText("12 questions answered · 75% correct");
    await expect(tests.getByTestId("test-row")).toHaveAttribute("data-ready", "true");
    await expect(tests).toHaveAttribute("data-status", "done");
    await go(page, PUBLIC);
    await expect(page.getByTestId("sum-tests")).toContainText("1 of 1 test type ready");
    await expect(page.getByTestId("sum-step-tests")).toHaveAttribute("data-status", "done");
  });

  test("Interview step: one mock interview set up for this scheme, resumed rather than duplicated, progress shown", async ({ open, account }) => {
    const page = await open();
    await go(page, PREPARE);
    const interview = step(page, "interview");
    await expect(interview).toHaveAttribute("data-next", "true");
    await interview.getByLabel("Difficulty").selectOption("easy");
    await interview.getByRole("button", { name: "Start a mock interview" }).click();
    await page.waitForURL(/\/dashboard\/interview\/[0-9a-f-]{36}/);
    const sessionId = page.url().split("/").pop()!;

    const { data: sessions } = await db().from("interview_sessions").select("*").eq("user_id", account.user.id);
    expect(sessions).toHaveLength(1);
    expect(sessions![0]).toMatchObject({ id: sessionId, company: "E2EJP Main", role: "Journey Programme", graduate_scheme_id: mainId, difficulty: "easy", mode: "chat", status: "in_progress", cv_version_id: goodCv.versionId });
    expect(sessions![0].job_description).toContain("Sector: Technology.");

    await go(page, PREPARE);
    await expect(step(page, "interview")).toHaveAttribute("data-status", "in_progress");
    await step(page, "interview").getByRole("button", { name: "Resume your mock interview" }).click();
    await page.waitForURL(new RegExp(`/dashboard/interview/${sessionId}`));
    expect((await db().from("interview_sessions").select("id", { count: "exact", head: true }).eq("user_id", account.user.id)).count).toBe(1);

    // Finished with a score -> the step is done and the score is shown.
    await db().from("interview_sessions").update({ status: "completed", completed_at: new Date().toISOString(), overall_score: 74 }).eq("id", sessionId);
    await go(page, PREPARE);
    await expect(step(page, "interview")).toHaveAttribute("data-status", "done");
    await expect(step(page, "interview").getByTestId("interview-item")).toContainText("74/100");
    await expect(step(page, "interview").getByTestId("interview-item")).toContainText("Completed");
    await go(page, PUBLIC);
    await expect(page.getByTestId("sum-interview")).toContainText("1 completed of 1 · best 74/100");
  });

  test("Tracker step: adds the scheme with its real details, once, and follows its status", async ({ open, account }) => {
    const page = await open();
    await go(page, PREPARE);
    const tracker = step(page, "tracker");
    await expect(tracker).toHaveAttribute("data-next", "true");
    await tracker.getByRole("button", { name: "Add to my tracker" }).click();
    await expect(tracker.getByTestId("tracker-status")).toHaveText("Wishlist");
    await expect(tracker.getByTestId("tracker-result")).toContainText(`deadline`);

    const { data: apps } = await db().from("applications").select("*").eq("user_id", account.user.id);
    expect(apps).toHaveLength(1);
    expect(apps![0]).toMatchObject({
      company_name: "E2EJP Main", job_title: "Journey Programme", location: "London", salary: "£40,000", url: "https://example.com/e2ejp-apply",
      deadline: ukToday(10), status: "wishlist", cv_id: goodCv.cvId, graduate_scheme_id: mainId,
    });
    await expect(tracker.getByRole("link", { name: "Apply on the employer's site" })).toHaveAttribute("href", "https://example.com/e2ejp-apply");
    await expect(tracker.getByRole("button", { name: "Add to my tracker" })).toHaveCount(0);

    // One per scheme, enforced by the database too.
    const dup = await db().from("applications").insert({ user_id: account.user.id, company_name: "x", job_title: "y", status: "wishlist", graduate_scheme_id: mainId });
    expect(dup.error).not.toBeNull();

    // It's really on the tracker board, and the journey follows the tracker's status.
    await go(page, "/dashboard/applications");
    await expect(page.getByTestId("application-card").filter({ hasText: "Journey Programme" })).toBeVisible();
    await db().from("applications").update({ status: "applied", applied_at: ukToday() }).eq("id", apps![0].id);
    await go(page, PREPARE);
    await expect(step(page, "tracker").getByTestId("tracker-status")).toHaveText("Applied");
    await go(page, PUBLIC);
    await expect(page.getByTestId("sum-tracker")).toContainText("Applied");
  });

  test("with every step done the journey is 100% and offers no next step", async ({ open }) => {
    const page = await open();
    await go(page, PREPARE);
    await expect(page.getByTestId("journey-percent")).toHaveText("100%");
    for (const key of ["scheme", "cv", "ats", "tests", "interview", "tracker"]) await expect(step(page, key)).toHaveAttribute("data-status", "done");
    await expect(page.locator('[data-next="true"]')).toHaveCount(0);
    await expect(page.getByTestId("stepper")).toBeVisible();
    await go(page, PUBLIC);
    await expect(page.getByTestId("prep-percent")).toHaveText("100% of the steps that apply to you are done");
  });

  test("progress belongs to one user: someone else sees nothing of it", async ({ browser }) => {
    const second = await createIsolatedUser({ fullName: "Second Journey User" });
    await markOnboarded(second.id);
    const { context, page } = await loginContext(browser, second);
    try {
      await page.waitForURL(/\/dashboard$/);
      await go(page, PUBLIC);
      await expect(page.getByTestId("prep-percent")).toHaveText("Not started yet");
      for (const id of ["sum-cv", "sum-ats", "sum-interview", "sum-tracker"]) await expect(page.getByTestId(id)).not.toContainText(/Journey CV|88|completed|Applied/);
      expect(await prepRow(second.id)).toBeNull();
    } finally {
      await context.close();
      await deleteIsolatedUser(second.id);
    }
  });

  test("deleting the chosen CV clears the choice without losing the journey", async ({ open, account }) => {
    await db().from("cvs").delete().eq("id", goodCv.cvId);
    expect((await prepRow(account.user.id))!.cv_id).toBeNull();
    const page = await open();
    await go(page, PREPARE);
    await expect(step(page, "cv")).toHaveAttribute("data-status", "todo");
    await expect(step(page, "cv").getByLabel("CV to prepare for this scheme")).toBeVisible();
    // The tracker entry stays (it only loses its CV link). The ATS scan and mock interview were done ON that CV, and — as
    // everywhere else in the app — go with it, so those steps honestly go back to "to do".
    await expect(step(page, "tracker")).toHaveAttribute("data-status", "done");
    await expect(step(page, "ats")).toHaveAttribute("data-status", "todo");
    await expect(step(page, "interview")).toHaveAttribute("data-status", "todo");
    expect((await prepRow(account.user.id))!.started_at).toBeTruthy();
  });

  test("works at phone width with no horizontal scroll", async ({ open }) => {
    const page = await open({ width: 375, height: 760 });
    for (const url of [PREPARE, PUBLIC]) {
      await go(page, url);
      await expect(page.getByRole("heading", { level: 1 }).last()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("a plan without Test Prep", () => {
  test("the tests step is locked with an honest upgrade prompt, and doesn't count against progress", async ({ browser }) => {
    const free = await createIsolatedUser({ fullName: "Free Journey User" });
    await markOnboarded(free.id);
    const { context, page } = await loginContext(browser, free);
    try {
      await page.waitForURL(/\/dashboard$/);
      await go(page, PUBLIC);
      await expect(page.getByTestId("sum-tests")).toContainText("Test Prep needs Premium or Elite");
      await page.getByRole("button", { name: "Prepare application" }).click();
      await page.getByRole("link", { name: "Continue preparing" }).click();
      const tests = step(page, "tests");
      await expect(tests).toHaveAttribute("data-status", "locked");
      await expect(tests.getByTestId("tests-locked")).toContainText("Premium and Elite plans");
      await expect(tests.getByRole("link", { name: "See plans" })).toBeVisible();
      await expect(tests.getByTestId("test-row")).toHaveCount(0);
      await expect(page.locator('[data-next="true"]')).toHaveAttribute("data-testid", "step-cv");
    } finally {
      await context.close();
      await deleteIsolatedUser(free.id);
    }
  });
});
