import { createClient } from "@supabase/supabase-js";
import { test, expect as baseExpect, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { makeSuperAdmin, markOnboarded } from "../support/roles";

// Employer/scheme assessment mapping, end to end against the REAL database. The catalogue holds no real schemes, so every
// row is created here (employer "E2EAM…", slug "e2eam-…") and deleted afterwards. Mappings cascade with their scheme.

test.describe.configure({ mode: "serial" });
const expect = baseExpect.configure({ timeout: 30_000 }); // the dev server compiles on first use, which can be slow

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const LIST = "/graduate-schemes";

function ukToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const scheme = (over: Record<string, unknown>) => ({
  sector: "technology", is_rolling: false, is_published: true, study_stages: [], locations: [], sponsorship_status: "not_published",
  source_url: "https://example.com/e2eam-scheme", source_date: ukToday(-40), verified_at: ukToday(-10), ...over,
});

const mapping = (schemeId: string, type: string, over: Record<string, unknown> = {}) => ({
  scheme_id: schemeId, assessment_type: type, is_required: true, display_order: 0, label: null, provider: null, notes: null, source_url: "https://example.com/e2eam-selection", source_date: ukToday(-40), verified_at: ukToday(-10), ...over,
});

async function cleanup() {
  await db().from("graduate_schemes").delete().like("slug", "e2eam-%"); // mappings cascade
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

const ALL_TYPES = ["sjt", "numerical", "verbal", "watson_glaser", "hirevue", "hackerrank", "case_interview", "assessment_centre", "other"] as const;
const item = (page: Page, type: string) => page.locator(`[data-testid="assessment"][data-type="${type}"]`);

test.afterAll(cleanup);

test.describe("public: assessments and preparation", () => {
  let fullId = "";
  test.beforeAll(async () => {
    await cleanup();
    const { data, error } = await db().from("graduate_schemes").insert([
      scheme({ slug: "e2eam-full", employer: "E2EAM Full", scheme_name: "All Assessments Programme", deadline_on: ukToday(30) }),
      scheme({ slug: "e2eam-empty", employer: "E2EAM Empty", scheme_name: "Unmapped Programme" }),
      scheme({ slug: "e2eam-draft", employer: "E2EAM Draft", scheme_name: "Draft Programme", is_published: false }),
      scheme({ slug: "e2eam-stale", employer: "E2EAM Stale", scheme_name: "Stale Evidence Programme" }),
    ]).select("id, slug");
    if (error) throw new Error(error.message);
    const id = (slug: string) => data!.find((row) => row.slug === slug)!.id as string;
    fullId = id("e2eam-full");
    const { error: mapError } = await db().from("graduate_scheme_assessments").insert([
      mapping(fullId, "sjt", { display_order: 1 }),
      mapping(fullId, "numerical", { display_order: 2, provider: "Named Test Co", notes: "Timed, 25 minutes." }),
      mapping(fullId, "verbal", { display_order: 3 }),
      mapping(fullId, "watson_glaser", { display_order: 4, is_required: false, notes: "Only for some routes." }),
      mapping(fullId, "hirevue", { display_order: 5 }),
      mapping(fullId, "hackerrank", { display_order: 6 }),
      mapping(fullId, "case_interview", { display_order: 7 }),
      mapping(fullId, "assessment_centre", { display_order: 8 }),
      mapping(fullId, "other", { display_order: 9, label: "Group exercise" }),
      mapping(id("e2eam-draft"), "sjt"),
      mapping(id("e2eam-stale"), "verbal", { source_date: ukToday(-500), verified_at: ukToday(-400) }),
    ]);
    if (mapError) throw new Error(mapError.message);
  });

  test("a scheme shows every assessment it is mapped to, required ones first, with the kind's name", async ({ page }) => {
    await page.goto(`${LIST}/e2eam-full`);
    await expect(page.getByRole("heading", { name: "How you are assessed" })).toBeVisible();
    await expect(page.getByTestId("assessment")).toHaveCount(9);
    // Required assessments come first (Watson-Glaser is "may be used", so it moves after the required ones).
    await expect(page.getByTestId("assessment-name")).toHaveText([
      "Situational judgement test (SJT)",
      "Numerical reasoning test",
      "Verbal reasoning test",
      "HireVue-style video interview",
      "HackerRank-style coding assessment",
      "Case interview",
      "Assessment centre",
      "Other assessment — Group exercise",
      "Watson-Glaser-style critical thinking test",
    ]);
    await expect(item(page, "watson_glaser").getByTestId("assessment-required")).toHaveText("May be used");
    await expect(item(page, "watson_glaser")).toContainText("Only for some routes.");
    await expect(item(page, "sjt").getByTestId("assessment-required")).toHaveText("Required");
    // A provider is shown only where a source named one.
    await expect(item(page, "numerical").getByTestId("assessment-provider")).toContainText("Named Test Co");
    await expect(item(page, "sjt").getByTestId("assessment-provider")).toHaveCount(0);
    await expect(item(page, "numerical")).toContainText("Timed, 25 minutes.");
  });

  test("each assessment carries its own source evidence", async ({ page }) => {
    await page.goto(`${LIST}/e2eam-full`);
    for (const type of ALL_TYPES) {
      const evidence = item(page, type).getByTestId("assessment-evidence");
      const link = evidence.getByRole("link");
      await expect(link).toHaveAttribute("href", "https://example.com/e2eam-selection");
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(evidence).toContainText("Source dated");
      await expect(evidence).toContainText("Verified");
      await expect(evidence.getByTestId("stale-warning")).toHaveCount(0);
    }
    // An old verification is flagged on that assessment.
    await page.goto(`${LIST}/e2eam-stale`);
    await expect(item(page, "verbal").getByTestId("stale-warning")).toBeVisible();
  });

  test("links to the JobPilot preparation that really exists — and says plainly where there is none", async ({ page }) => {
    const { data: types } = await db().from("test_types").select("id, slug").in("slug", ["situational-judgement", "numerical-reasoning", "verbal-reasoning", "critical-thinking"]);
    const idOf = (slug: string) => types!.find((t) => t.slug === slug)!.id as string;
    await page.goto(`${LIST}/e2eam-full`);

    const link = (type: string) => item(page, type).getByTestId("prep-link");
    await expect(link("sjt")).toHaveAttribute("href", `/dashboard/test-prep#${idOf("situational-judgement")}`);
    await expect(link("numerical")).toHaveAttribute("href", `/dashboard/test-prep#${idOf("numerical-reasoning")}`);
    await expect(link("verbal")).toHaveAttribute("href", `/dashboard/test-prep#${idOf("verbal-reasoning")}`);
    await expect(link("watson_glaser")).toHaveAttribute("href", `/dashboard/test-prep#${idOf("critical-thinking")}`);
    for (const type of ["sjt", "numerical", "verbal", "watson_glaser"]) {
      await expect(item(page, type).getByTestId("assessment-prep")).toHaveAttribute("data-coverage", "full");
      await expect(item(page, type).getByTestId("assessment-prep")).toContainText("JobPilot practice available");
      await expect(item(page, type)).toContainText("Premium and Elite"); // Test Prep is plan-gated; say so
    }
    await expect(item(page, "watson_glaser").getByTestId("assessment-prep")).toContainText("not the official test");

    // Partial: honest about the limits.
    await expect(link("hirevue")).toHaveAttribute("href", "/dashboard/interview");
    await expect(item(page, "hirevue").getByTestId("assessment-prep")).toHaveAttribute("data-coverage", "partial");
    await expect(item(page, "hirevue").getByTestId("assessment-prep")).toContainText("does not reproduce HireVue");
    await expect(link("assessment_centre")).toHaveCount(2);
    await expect(item(page, "assessment_centre").getByTestId("assessment-prep")).toContainText("Group exercises and presentations aren't covered");

    // None: no link at all, and it says so.
    for (const type of ["hackerrank", "case_interview", "other"]) {
      await expect(item(page, type).getByTestId("assessment-prep")).toHaveAttribute("data-coverage", "none");
      await expect(item(page, type).getByTestId("assessment-prep")).toContainText("No JobPilot practice yet");
      await expect(link(type)).toHaveCount(0);
    }
    await expect(item(page, "hackerrank")).toContainText("doesn't have coding-assessment practice yet");
    await expect(item(page, "case_interview")).toContainText("doesn't have case-interview practice yet");

    // The links go somewhere real (logged out they land on sign-in, never a 404).
    await link("sjt").click();
    await expect(page).toHaveURL(/\/login|\/dashboard\/test-prep/);
  });

  test("a scheme with no mappings says so instead of listing anything", async ({ page }) => {
    await page.goto(`${LIST}/e2eam-empty`);
    await expect(page.getByTestId("no-assessments")).toContainText("No assessments have been recorded");
    await expect(page.getByTestId("assessment")).toHaveCount(0);
    await expect(page.getByTestId("prep-link")).toHaveCount(0);
  });

  test("the listing shows assessment chips and filters by kind", async ({ page }) => {
    await page.goto(`${LIST}?q=e2eam`);
    const card = page.getByTestId("scheme-card").filter({ hasText: "All Assessments Programme" });
    await expect(card.getByTestId("card-assessments")).toContainText("SJT");
    await expect(card.getByTestId("card-assessments")).toContainText("Numerical");
    await expect(card.getByTestId("card-assessments")).toContainText("Watson-Glaser-style");
    await expect(card.getByTestId("card-assessments")).toContainText("HireVue-style");
    await expect(card.getByTestId("card-assessments")).toContainText("HackerRank-style");
    await expect(card.getByTestId("card-assessments")).toContainText("Case interview");
    await expect(card.getByTestId("card-assessments")).toContainText("Assessment centre");
    await expect(card.getByTestId("card-assessments")).toContainText("Group exercise"); // an "other" shows its own name
    await expect(page.getByTestId("scheme-card").filter({ hasText: "Unmapped Programme" }).getByTestId("card-assessments")).toHaveCount(0);

    const titles = async (type: string) => {
      await page.goto(`${LIST}?q=e2eam&assessment=${type}`);
      return page.getByTestId("scheme-card").locator("h2").allTextContents();
    };
    expect(await titles("hackerrank")).toEqual(["All Assessments Programme"]);
    expect(await titles("verbal")).toEqual(["All Assessments Programme", "Stale Evidence Programme"]);
    expect(await titles("sjt")).toEqual(["All Assessments Programme"]); // the draft's SJT is not visible
    await page.goto(`${LIST}?q=e2eam`);
    await page.getByLabel("Assessment", { exact: true }).selectOption("hirevue");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/assessment=hirevue/);
    await expect(page.getByTestId("scheme-card")).toHaveCount(1);
  });

  test("access control: mappings follow the scheme's visibility and can't be written by users", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: visible } = await anon.from("graduate_scheme_assessments").select("assessment_type, graduate_schemes(slug)");
    const slugs = (visible ?? []).map((row) => (Array.isArray(row.graduate_schemes) ? row.graduate_schemes[0] : row.graduate_schemes)?.slug);
    expect(slugs).toContain("e2eam-full");
    expect(slugs).not.toContain("e2eam-draft");

    expect((await anon.from("graduate_scheme_assessments").insert(mapping(fullId, "sjt", { label: "forged" }))).error).not.toBeNull();
    await anon.from("graduate_scheme_assessments").update({ notes: "hacked" }).eq("scheme_id", fullId);
    await anon.from("graduate_scheme_assessments").delete().eq("scheme_id", fullId);
    const { data: after } = await db().from("graduate_scheme_assessments").select("notes").eq("scheme_id", fullId);
    expect(after).toHaveLength(9);
    expect(after!.some((row) => row.notes === "hacked")).toBe(false);

    const user = await createIsolatedUser({ fullName: "Plain AM User" });
    try {
      const signedIn = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      await signedIn.auth.signInWithPassword({ email: user.email, password: user.password });
      expect((await signedIn.from("graduate_scheme_assessments").insert(mapping(fullId, "sjt", { label: "forged2" }))).error).not.toBeNull();
    } finally {
      await deleteIsolatedUser(user.id);
    }
  });

  test("the database refuses impossible mappings", async () => {
    const bad = [
      mapping(fullId, "psychometric"),
      mapping(fullId, "other"), // "other" needs a name
      mapping(fullId, "sjt", { label: "second sjt with same name?" }), // allowed: distinct label
      mapping(fullId, "numerical"), // duplicate of an existing (scheme, type, no label)
      mapping(fullId, "verbal", { label: "x", source_url: "javascript:alert(1)" }),
      mapping(fullId, "verbal", { label: "y", source_date: ukToday(-1), verified_at: ukToday(-5) }),
    ];
    const results = await Promise.all(bad.map((row) => db().from("graduate_scheme_assessments").insert(row)));
    expect(results.map((r) => r.error !== null)).toEqual([true, true, false, true, true, true]);
    await db().from("graduate_scheme_assessments").delete().eq("scheme_id", fullId).eq("label", "second sjt with same name?");
  });
});

// ---- admin ----------------------------------------------------------------------------------------------------------

test.describe("admin: manage mappings and evidence", () => {
  test.beforeAll(async () => {
    await cleanup();
    const { error } = await db().from("graduate_schemes").insert([
      scheme({ slug: "e2eam-admin", employer: "E2EAM Admin Co", scheme_name: "Admin Programme" }),
      scheme({ slug: "e2eam-csv", employer: "E2EAM Csv Co", scheme_name: "Csv Programme" }),
    ]);
    if (error) throw new Error(error.message);
  });

  test("a staff account without the permission is turned away", async ({ browser }) => {
    const user = await createIsolatedUser({ fullName: "Limited AM Admin" });
    await markOnboarded(user.id);
    await db().from("profiles").update({ role: "admin" }).eq("id", user.id);
    const { data: role } = await db().from("admin_roles").insert({ slug: `e2e-am-limited-${Date.now()}`, name: "E2E limited", permissions: ["manage_users"] }).select("id").single();
    await db().from("admin_user_roles").insert({ user_id: user.id, admin_role_id: role!.id });
    const { context, page } = await loginContext(browser, user);
    try {
      await page.waitForURL(/\/admin/);
      await page.goto("/admin/graduate-schemes/assessments/import");
      await expect(page).toHaveURL(/\/admin$/);
    } finally {
      await context.close();
      await deleteIsolatedUser(user.id);
      await db().from("admin_roles").delete().eq("id", role!.id);
    }
  });

  test("add, edit and remove assessments with evidence; import in bulk; every change audited", async ({ browser, page: publicPage }) => {
    test.setTimeout(300_000);
    const admin = await createIsolatedUser({ fullName: "AM Super Admin" });
    await makeSuperAdmin(admin.id);
    const { context, page } = await loginContext(browser, admin);
    const { data: target } = await db().from("graduate_schemes").select("id").eq("slug", "e2eam-admin").single();
    const rows = async () => (await db().from("graduate_scheme_assessments").select("*").eq("scheme_id", target!.id).order("display_order")).data!;
    try {
      await page.waitForURL(/\/admin/);
      await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);

      await page.goto("/admin/graduate-schemes");
      await expect(page.getByTestId("admin-scheme-row").filter({ hasText: "Admin Programme" }).getByTestId("assessment-count")).toHaveText("None mapped");
      await page.getByRole("link", { name: "Edit Admin Programme" }).click();
      const manager = page.getByTestId("assessment-manager");
      await expect(manager.getByTestId("no-assessments")).toBeVisible();

      // ---- add: validation first (server-side), nothing saved on failure ----
      await manager.getByRole("button", { name: "Add assessment" }).click();
      let form = page.getByRole("form", { name: "Add assessment" });
      await expect(form.getByLabel("Source for this assessment")).toHaveValue("https://example.com/e2eam-scheme"); // prefilled from the scheme, editable
      await form.getByLabel("Assessment type").selectOption("numerical");
      await form.getByLabel("Source date").fill(ukToday(-20));
      await form.getByLabel("Verified date").fill(ukToday(4));
      await form.getByRole("button", { name: "Add assessment" }).click();
      await expect(form.getByRole("alert")).toContainText("can't be in the future");
      await form.getByLabel("Verified date").fill(ukToday(-30));
      await form.getByRole("button", { name: "Add assessment" }).click();
      await expect(form.getByRole("alert")).toContainText("can't be before the source date");
      await form.getByLabel("Verified date").fill(ukToday());
      await form.getByLabel("Source for this assessment").fill("javascript:alert(1)");
      await form.getByRole("button", { name: "Add assessment" }).click();
      await expect(form.getByRole("alert")).toContainText(/source URL/);
      expect(await rows()).toHaveLength(0);

      // "other" must be named
      await form.getByLabel("Source for this assessment").fill("https://example.com/e2eam-selection");
      await form.getByLabel("Assessment type").selectOption("other");
      await expect(form.getByLabel("What is it called?")).toBeVisible();
      await form.getByLabel("What is it called?").fill("Group exercise");
      await form.getByLabel("Assessment type").selectOption("numerical");
      await form.getByLabel("Name (optional)").fill("");

      // ---- a valid one ----
      await form.getByLabel("Provider or platform named by the source (optional)").fill("Named Test Co");
      await form.getByLabel("Notes (optional)").fill("25 minutes, online.");
      await form.getByLabel("Display order").fill("1");
      await form.getByRole("button", { name: "Add assessment" }).click();
      await expect(manager.getByTestId("assessment-item")).toHaveCount(1);
      expect((await rows())[0]).toMatchObject({ assessment_type: "numerical", provider: "Named Test Co", notes: "25 minutes, online.", is_required: true, source_url: "https://example.com/e2eam-selection", source_date: ukToday(-20), verified_at: ukToday() });

      // adding the same kind again is refused; a differently named "other" is fine
      await manager.getByRole("button", { name: "Add assessment" }).click();
      form = page.getByRole("form", { name: "Add assessment" });
      await form.getByLabel("Assessment type").selectOption("numerical");
      await form.getByLabel("Source date").fill(ukToday(-20));
      await form.getByRole("button", { name: "Add assessment" }).click();
      await expect(form.getByRole("alert")).toContainText("already has this assessment");
      await form.getByLabel("Assessment type").selectOption("other");
      await form.getByLabel("What is it called?").fill("Group exercise");
      await form.getByLabel("Display order").fill("2");
      await form.getByLabel(/^Required for every applicant/).uncheck();
      await form.getByRole("button", { name: "Add assessment" }).click();
      await expect(manager.getByTestId("assessment-item")).toHaveCount(2);
      expect((await rows())[1]).toMatchObject({ assessment_type: "other", label: "Group exercise", is_required: false });

      // shown publicly at once, with its prep
      await publicPage.goto(`${LIST}/e2eam-admin`);
      await expect(publicPage.getByTestId("assessment-name")).toHaveText(["Numerical reasoning test", "Other assessment — Group exercise"]);
      await expect(item(publicPage, "numerical").getByTestId("assessment-provider")).toContainText("Named Test Co");
      await expect(item(publicPage, "numerical").getByTestId("prep-link")).toBeVisible();

      // ---- edit: change to a different kind, and refresh the evidence ----
      await manager.getByRole("button", { name: "Edit Group exercise" }).click();
      form = page.getByRole("form", { name: "Edit assessment" });
      await form.getByLabel("Assessment type").selectOption("assessment_centre");
      await form.getByLabel("Name (optional)").fill("");
      await form.getByLabel(/^Required for every applicant/).check();
      await form.getByLabel("Source for this assessment").fill("https://example.com/e2eam-new-source");
      await form.getByRole("button", { name: "Save assessment" }).click();
      await expect(manager.getByTestId("assessment-item").nth(1)).toContainText("Assessment centre");
      expect((await rows())[1]).toMatchObject({ assessment_type: "assessment_centre", label: null, is_required: true, source_url: "https://example.com/e2eam-new-source" });
      await publicPage.goto(`${LIST}/e2eam-admin`);
      await expect(item(publicPage, "assessment_centre").getByTestId("assessment-evidence").getByRole("link")).toHaveAttribute("href", "https://example.com/e2eam-new-source");

      // the admin list counts them
      await page.goto("/admin/graduate-schemes");
      await expect(page.getByTestId("admin-scheme-row").filter({ hasText: "Admin Programme" }).getByTestId("assessment-count")).toHaveText("2 mapped");

      // ---- remove ----
      await page.getByRole("link", { name: "Edit Admin Programme" }).click();
      page.once("dialog", (dialog) => void dialog.accept());
      await manager.getByRole("button", { name: "Remove Assessment centre" }).click();
      await expect(manager.getByTestId("assessment-item")).toHaveCount(1);
      expect(await rows()).toHaveLength(1);

      // ---- bulk import ----
      await page.goto("/admin/graduate-schemes/assessments/import");
      const header = "employer,scheme_name,assessment_type,label,provider,required,notes,source_url,source_date,verified_at";
      const ev = `https://example.com/e2eam-csv-source,${ukToday(-15)},${ukToday(-1)}`;
      const csv = [
        header,
        `E2EAM Csv Co,Csv Programme,SJT,,,yes,First,${ev}`,
        `E2EAM Csv Co,Csv Programme,Case interview,,,no,,${ev}`,
        `E2EAM Csv Co,Csv Programme,Other,Presentation,,yes,,${ev}`,
        `E2EAM Csv Co,Csv Programme,Other,,,yes,,${ev}`,
        `E2EAM Nobody,Nothing,sjt,,,yes,,${ev}`,
        `E2EAM Csv Co,Csv Programme,psychometric,,,yes,,${ev}`,
        `E2EAM Csv Co,Csv Programme,sjt,,,yes,dup,${ev}`,
        `E2EAM Csv Co,Csv Programme,verbal,,,maybe,,${ev}`,
        `E2EAM Csv Co,Csv Programme,numerical,,,yes,,https://example.com/x,${ukToday(-1)},${ukToday(-9)}`,
      ].join("\n");
      await page.getByLabel("CSV data").fill(csv);
      await page.getByRole("button", { name: "Check (nothing is saved)" }).click();
      const result = page.getByTestId("import-result");
      await expect(result).toContainText("Would create 3");
      await expect(result).toContainText("6 skipped");
      await expect(result).toContainText("Row 5: Say what this other assessment is");
      await expect(result).toContainText('Row 6: No scheme "Nothing" for "E2EAM Nobody"');
      await expect(result).toContainText('Row 7: Unrecognised assessment type "psychometric"');
      await expect(result).toContainText("Row 8: Duplicate of an earlier row");
      await expect(result).toContainText('Row 9: "required" must be yes or no');
      await expect(result).toContainText("Row 10: The verification date can't be before the source date");
      const { data: csvScheme } = await db().from("graduate_schemes").select("id").eq("slug", "e2eam-csv").single();
      expect((await db().from("graduate_scheme_assessments").select("id", { count: "exact", head: true }).eq("scheme_id", csvScheme!.id)).count).toBe(0);

      await page.getByRole("button", { name: "Import", exact: true }).click();
      await expect(result).toContainText("Created 3, updated 0");
      const imported = (await db().from("graduate_scheme_assessments").select("assessment_type, label, is_required, notes, source_url, source_date, verified_at").eq("scheme_id", csvScheme!.id)).data!;
      expect(imported.map((r) => `${r.assessment_type}:${r.label ?? ""}:${r.is_required}`).sort()).toEqual(["case_interview::false", "other:Presentation:true", "sjt::true"]);
      expect(imported.every((r) => r.source_url === "https://example.com/e2eam-csv-source" && r.source_date === ukToday(-15) && r.verified_at === ukToday(-1))).toBe(true);

      // Re-import: matched by scheme + kind + name, updated in place.
      await page.getByLabel("CSV data").fill(`${header}\nE2EAM Csv Co,Csv Programme,sjt,,Named Provider,yes,Updated note,${ev}`);
      await page.getByRole("button", { name: "Import", exact: true }).click();
      await expect(result).toContainText("Created 0, updated 1");
      const sjt = (await db().from("graduate_scheme_assessments").select("provider, notes").eq("scheme_id", csvScheme!.id).eq("assessment_type", "sjt")).data!;
      expect(sjt).toEqual([{ provider: "Named Provider", notes: "Updated note" }]);
      expect((await db().from("graduate_scheme_assessments").select("id", { count: "exact", head: true }).eq("scheme_id", csvScheme!.id)).count).toBe(3);

      // ---- audit ----
      const { data: audit } = await db().from("admin_audit_logs").select("action").eq("actor_id", admin.id).eq("entity_type", "graduate_scheme");
      const actions = new Set(audit!.map((entry) => entry.action));
      for (const action of ["graduate_scheme.assessment_add", "graduate_scheme.assessment_update", "graduate_scheme.assessment_delete", "graduate_scheme.assessment_import"]) {
        expect(actions.has(action), action).toBe(true);
      }
    } finally {
      await context.close();
      await deleteIsolatedUser(admin.id);
    }
  });
});
