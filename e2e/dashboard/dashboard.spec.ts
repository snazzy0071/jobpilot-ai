import { expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser } from "../support/test-user";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest } from "../support/cv-fixture";

// The user dashboard against the REAL database: every figure shown is compared with rows this test put there, and a brand-new account
// must see honest empty states (no sample data). Serial; one seeded Premium account plus one empty Free account.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const RUN = Date.now().toString(36);
const test = makeCvTest({ name: "Dashboard Tester", plan: "premium" });
test.describe.configure({ mode: "serial" });

function ukDate(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 86_400_000));
}
const localDate = (offsetDays: number) => new Intl.DateTimeFormat("en-CA").format(new Date(Date.now() + offsetDays * 86_400_000));

const metric = (page: Page, label: string) => page.locator(`[data-metric="${label}"]`);
const jobIds: string[] = [];
const schemeSlug = `e2edb-${RUN}`;

test.afterAll(async () => {
  if (jobIds.length) await db().from("jobs").delete().in("id", jobIds);
  await db().from("graduate_schemes").delete().eq("slug", schemeSlug);
});

test("a brand-new account sees honest empty states, not sample data", async ({ browser }) => {
  const user = await createIsolatedUser({ fullName: "Empty Dashboard" });
  await markOnboarded(user.id);
  try {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1360, height: 900 } });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard$/, { timeout: 45_000 });
    await dismissCookieBanner(page);

    await expect(metric(page, "CVs")).toContainText("Build your first CV");
    await expect(metric(page, "Latest ATS score")).toContainText("Not scanned yet");
    await expect(page.getByTestId("dashboard-job-matches")).toContainText("score it against your CV");
    await expect(page.getByTestId("dashboard-deadlines")).toContainText("None in 30 days");
    await expect(page.getByTestId("dashboard-activity")).toContainText("Nothing yet");
    await expect(page.getByTestId("dashboard-sponsor")).toContainText("Track applications to see");
    await expect(page.getByTestId("dashboard-testprep")).toContainText("Finish a practice session");
    await expect(page.getByTestId("dashboard-next-actions")).toContainText("Build your first CV");
    await expect(page.getByTestId("dashboard-plan")).toContainText(/free/i);
    // The plan shown is the real one, not the legacy free/paid flag.
    await expect(page.getByRole("navigation", { name: "Main" })).toContainText(/free/i);
    await context.close();
  } finally {
    await deleteIsolatedUser(user.id);
  }
});

test("seed real data for the dashboard account", async ({ account }) => {
  const uid = account.user.id;
  const cv = await seedCv(uid, { title: `Dash CV ${RUN}`, fullName: "Dash Person" });
  const archived = await seedCv(uid, { title: `Archived CV ${RUN}`, fullName: "Old" });
  await db().from("cvs").update({ is_archived: true, archived_at: new Date().toISOString() }).eq("id", archived.cvId);


  const apps = await db().from("applications").insert([
    { user_id: uid, company_name: "Wish One", job_title: `Wish role ${RUN}`, status: "wishlist", deadline: ukDate(3) },
    { user_id: uid, company_name: "Wish Two", job_title: "Wish role 2", status: "wishlist" },
    { user_id: uid, company_name: "Applied Co", job_title: "Applied role", status: "applied", applied_at: ukDate(-2), sponsor_status: "confirmed_sponsor" },
    { user_id: uid, company_name: "Interview Co", job_title: "Interview role", status: "interview", applied_at: ukDate(-9) },
    { user_id: uid, company_name: "Offer Co", job_title: "Offer role", status: "offer", applied_at: ukDate(-20) },
  ]);
  expect(apps.error).toBeNull();

  await db().from("interview_sessions").insert([
    { user_id: uid, role: "Done interview", status: "completed", completed_at: new Date().toISOString() },
    { user_id: uid, role: "Open interview", status: "in_progress" },
  ]);

  const { data: source } = await db().from("job_sources").select("id").eq("slug", "manual").single();
  const specs = [
    { title: `E2EDB Job A ${RUN}`, score: 91, active: true },
    { title: `E2EDB Job B ${RUN}`, score: 62, active: true },
    { title: `E2EDB Job C ${RUN}`, score: 97, active: false },
  ];
  for (const spec of specs) {
    const { data: job, error } = await db()
      .from("jobs")
      .insert({ source_id: source!.id, title: spec.title, title_normalized: spec.title.toLowerCase(), company_name: "Match Co", company_name_normalized: "match co", description: "e2e", url: `https://example.test/${spec.title.replace(/ /g, "-")}`, is_active: spec.active })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    jobIds.push(job!.id);
    const { error: matchError } = await db().from("job_matches").insert({
      user_id: uid, job_id: job!.id, cv_version_id: cv.versionId, match_score: spec.score, verdict: "worth_applying", reasons: ["r"], gaps: [], prompt_version: "e2e",
      core_skills_score: 70, core_skills_summary: "s", tech_functional_skills_score: 70, tech_functional_skills_summary: "s", domain_fit_score: 70, domain_fit_summary: "s", seniority_score: 70, seniority_summary: "s",
    });
    if (matchError) throw new Error(matchError.message);
  }

  const schemeInsert = await db().from("graduate_schemes").insert({
    slug: schemeSlug, employer: `E2EDB Employer ${RUN}`, scheme_name: "Graduate Programme", sector: "technology", is_rolling: false, is_published: true, study_stages: [], locations: [], sponsorship_status: "not_published",
    source_url: "https://example.com/e2edb", source_date: ukDate(-40), verified_at: ukDate(-10), deadline_on: ukDate(5),
  });
  expect(schemeInsert.error).toBeNull();

  // 10 answers, 7 right, in one finished session; a two-day streak (today and yesterday, in the browser's own zone).
  const { data: type } = await db().from("test_types").select("id").eq("slug", "numerical-reasoning").single();
  const { data: questions } = await db().from("questions").select("id, subtype, difficulty, question_packs!inner(test_type_id)").eq("question_packs.test_type_id", type!.id).eq("is_active", true).limit(10);
  expect(questions).toHaveLength(10);
  const { data: session } = await db().from("test_sessions").insert({ user_id: uid, question_pack_id: null, total_questions: 10, correct_count: 7, score: 70, completed_at: new Date().toISOString(), focus_test_type_id: type!.id, focus_subtype: "x" }).select("id").single();
  await db().from("test_answers").insert(questions!.map((q, i) => ({ test_session_id: session!.id, question_id: q.id, user_id: uid, selected_answer: "a", is_correct: i < 7, test_type_id: type!.id, subtype: q.subtype, difficulty: q.difficulty })));
  await db().from("daily_practice_completions").insert([
    { user_id: uid, local_date: localDate(0), correct_count: 5, total_questions: 5 },
    { user_id: uid, local_date: localDate(-1), correct_count: 4, total_questions: 5 },
  ]);

  // Last, so the newest events are the ones the activity list is about to show (it keeps the latest seven).
  const scan = await db().from("ats_scans").insert({
    user_id: uid, source: "cv_version", cv_version_id: cv.versionId, cv_text_snapshot: "cv", job_description: "x".repeat(40),
    match_score: 88, keyword_score: 81, structure_score: 90, format_score: 95, sections_score: 90, summary: "Strong.", prompt_version: "test",
  });
  expect(scan.error).toBeNull();
  await db().from("cvs").update({ updated_at: new Date().toISOString() }).eq("id", cv.cvId);
});

test("every dashboard figure matches the data behind it", async ({ open, account }) => {
  const uid = account.user.id;
  const page = await open();
  await page.goto("/dashboard");
  await dismissCookieBanner(page);
  const T = { timeout: 20_000 };

  // Profile completion: worked out from the real profile and preferences, the same seven fields.
  const [{ data: profile }, { data: prefs }] = await Promise.all([db().from("profiles").select("full_name, date_of_birth").eq("id", uid).single(), db().from("user_preferences").select("target_roles, career_stage, location, graduation_year, visa_sponsorship_preference").eq("id", uid).single()]);
  const done = [profile?.full_name, profile?.date_of_birth, prefs?.target_roles?.length, prefs?.career_stage, prefs?.location, prefs?.graduation_year, prefs?.visa_sponsorship_preference].filter(Boolean).length;
  await expect(page.getByTestId("dashboard-welcome")).toContainText(`${Math.round((done / 7) * 100)}%`, T);

  // Plan and usage: the plan in force (Premium), never the legacy flag.
  await expect(page.getByTestId("dashboard-plan")).toContainText(/premium/i, T);
  await expect(page.getByRole("navigation", { name: "Main" })).toContainText(/premium/i);

  // CVs (the archived one is not counted), latest ATS score, applications, interviews.
  await expect(metric(page, "CVs")).toContainText("1", T);
  await expect(metric(page, "CVs")).toContainText(`Dash CV ${RUN}`);
  await expect(metric(page, "Latest ATS score")).toContainText("88", T);
  await expect(metric(page, "Applications")).toContainText("5", T);
  await expect(metric(page, "Applications")).toContainText("1 applied · 1 at interview");
  await expect(metric(page, "Interviews practised")).toContainText("1", T);
  await expect(metric(page, "Interviews practised")).toContainText("1 in progress");

  // Applications by stage: real counts per stage.
  const stages = page.getByTestId("dashboard-stages");
  for (const stage of ["Wishlist", "Applied", "Interview", "Offer"]) await expect(stages).toContainText(stage);
  await expect(stages).toContainText("5");

  // Job matches: only active listings the user has scored, best first; the inactive 97% is not shown.
  const matches = page.getByTestId("dashboard-job-matches");
  await matches.scrollIntoViewIfNeeded();
  await expect(matches).toContainText("2 scored", T);
  await expect(matches).toContainText(`E2EDB Job A ${RUN}`);
  await expect(matches).toContainText("91%");
  await expect(matches).toContainText("1 of your 2 scored jobs is a strong match");
  await expect(matches).not.toContainText("Job C");
  await expect(matches).not.toContainText("97%");

  // Deadlines: the user's own not-applied entry and the published scheme, soonest first; nothing for applied ones.
  const deadlines = page.getByTestId("dashboard-deadlines");
  await expect(deadlines).toContainText(`Wish role ${RUN}`, T);
  await expect(deadlines).toContainText("In 3 days");
  await expect(deadlines).toContainText(`E2EDB Employer ${RUN}`);
  await expect(deadlines).toContainText("In 5 days");
  expect(await deadlines.locator("li").count()).toBe(2);

  // Sponsor activity, test accuracy and streak. (Counters animate up once scrolled into view.)
  await page.getByTestId("dashboard-sponsor").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("dashboard-sponsor")).toContainText("1 at sponsors", T);
  const prep = page.getByTestId("dashboard-testprep");
  await prep.scrollIntoViewIfNeeded();
  await expect(prep).toContainText("70%", T);
  await expect(prep).toContainText("10 answers");
  await expect(page.getByTestId("daily-streak")).toContainText("2-day streak", T);

  // Recent activity: real events, newest first, including the scan and the test session.
  const activity = page.getByTestId("dashboard-activity");
  await expect(activity).toContainText("ATS scan");
  await expect(activity).toContainText("Score 88/100");
  await expect(activity).toContainText("Test prep session");
  await expect(activity).toContainText(`Dash CV ${RUN}`);

  // Recommended next actions come from that state: the open interview, the near deadline, the strong match.
  const actions = page.getByTestId("dashboard-next-actions");
  await expect(actions).toContainText("Finish your Open interview interview");
  await expect(actions).toContainText("In 3 days");
  await expect(actions).toContainText("Review your 91% match");
});

test("the sidebar stays put while only the content scrolls", async ({ open }) => {
  const page = await open({ width: 1360, height: 700 });
  await page.goto("/dashboard");
  await dismissCookieBanner(page);
  const nav = page.getByRole("navigation", { name: "Main" });
  const before = await nav.boundingBox();
  const main = page.locator("#main-content");
  expect(await main.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(300);
  await main.evaluate((el) => el.scrollTo(0, 500));
  await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
  const after = await nav.boundingBox();
  expect(after?.y).toBe(before?.y);
  expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
});

test("phone width: no horizontal overflow", async ({ open }) => {
  const page = await open({ width: 390, height: 800 });
  await page.goto("/dashboard");
  await expect(page.locator("#main-content")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

