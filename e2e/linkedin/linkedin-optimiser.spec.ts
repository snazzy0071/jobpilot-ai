import { expect, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { markOnboarded, setPlan } from "../support/roles";
import { dismissCookieBanner, makeCvTest, providersMocked, DESKTOP } from "../support/cv-fixture";

// LinkedIn Optimiser (/dashboard/linkedin): paste a headline / About / Experience (no LinkedIn login or API),
// choose a target role + seniority, get keyword analysis, three headline variants, an About rewrite and Experience
// bullet rewrites with before/after, accept/reject, autosaved edits, recoverable history, a live re-score and plan
// gating. Requires the mocked AI provider (E2E_MOCK_PROVIDERS=1); its LinkedIn responses are deterministic (see
// e2e/support/mock-providers/mock-agent.mjs) so the keyword score can be asserted exactly:
//   9 recruiter terms, weights high 3 / medium 2 / low 1 => 20 total.
//   pasted text contains only "SQL"                          => before 3/20 = 15
//   generated About + bullets contain Roadmapping, Agile     => after  6/20 = 30
//   + keyword-dense headline (Stakeholder Management, SQL)   =>        12/20 = 60
//   + accepted About rewrite (Prioritisation, OKRs)          =>        15/20 = 75
//   + accepted bullet rewrite (Experimentation, User Research)=>       18/20 = 90

const test = makeCvTest({ name: "LinkedIn Tester", plan: "pro" }); // pro includes linkedin_optimiser
const db = () => getAdminClient();
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const INPUT = {
  title: "PM switch",
  role: "Product Manager",
  headline: "Product Analyst",
  about: "I like SQL and spreadsheets.",
  experience: "Product Analyst at Acme 2020-2024: built dashboards and reported to leadership.",
};

const appAlert = (page: Page) => page.locator("p[role=alert]");
const rateLimited = (page: Page) => appAlert(page).filter({ hasText: /too quickly/i });

/** The gateway's real 10-AI-calls/60s per-user limit can refuse a call right after another test's — wait and retry, as a person would. */
async function createDraft(page: Page, options: Partial<typeof INPUT> & { seniority?: string } = {}) {
  await page.goto("/dashboard/linkedin/new");
  await dismissCookieBanner(page);
  await page.getByLabel("Draft name").fill(options.title ?? INPUT.title);
  await page.getByLabel("Target role").fill(options.role ?? INPUT.role);
  await page.getByRole("combobox", { name: "Target seniority" }).click();
  await page.getByRole("option", { name: options.seniority ?? "Senior", exact: true }).click();
  await page.getByLabel("Current headline (optional)").fill(options.headline ?? INPUT.headline);
  await page.getByLabel("Current About section (optional)").fill(options.about ?? INPUT.about);
  await page.getByLabel("Current Experience section").fill(options.experience ?? INPUT.experience);
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.getByRole("button", { name: "Generate rewrite" }).click();
    await Promise.race([page.waitForURL(/\/dashboard\/linkedin\/[0-9a-f-]{36}$/, { timeout: 60_000 }), rateLimited(page).waitFor({ timeout: 60_000 })]).catch(() => undefined);
    if (/\/dashboard\/linkedin\/[0-9a-f-]{36}$/.test(page.url())) break;
    await page.waitForTimeout(15_000);
  }
  await expect(page.getByRole("heading", { name: options.title ?? INPUT.title })).toBeVisible({ timeout: 30_000 });
  await dismissCookieBanner(page);
  return page.url().split("/").pop()!;
}

/** Runs an AI rewrite panel to its suggestion (retrying only the shared rate limit). */
async function requestRewrite(page: Page, trigger: ReturnType<Page["getByRole"]>) {
  await trigger.click();
  for (let attempt = 0; attempt < 6; attempt++) {
    await expect(page.getByRole("button", { name: "Accept" }).or(appAlert(page))).toBeVisible({ timeout: 60_000 });
    if (await page.getByRole("button", { name: "Accept" }).isVisible()) return;
    if (!(await rateLimited(page).isVisible().catch(() => false))) throw new Error("Rewrite failed for a reason other than rate limiting.");
    await page.waitForTimeout(15_000);
    await page.getByRole("button", { name: "Try again" }).click();
  }
  throw new Error("Still rate limited after 6 retries.");
}

/** "before → after / 100", read off the keyword coverage card. */
async function scores(page: Page) {
  const text = await page.getByText("Recruiter-search keyword coverage").locator("xpath=following-sibling::p").innerText();
  const match = /(\d+)\s*→\s*(\d+)/.exec(text);
  if (!match) throw new Error(`Couldn't read the score from "${text}"`);
  return { before: Number(match[1]), after: Number(match[2]) };
}

const draftOf = async (id: string) => (await db().from("linkedin_profile_drafts").select("*").eq("id", id).single()).data!;
const bulletsOf = async (id: string) => (await db().from("linkedin_experience_bullets").select("id, content, display_order").eq("draft_id", id).order("display_order")).data ?? [];
const versionsOf = async (id: string) => (await db().from("linkedin_draft_versions").select("id, label, snapshot").eq("draft_id", id).order("created_at")).data ?? [];

async function withFreshUser(browser: Browser, plan: "pro" | null, run: (page: Page, user: IsolatedUser) => Promise<void>) {
  const user = await createIsolatedUser({ fullName: `LinkedIn ${plan ?? "free"} Tester` });
  try {
    await markOnboarded(user.id);
    if (plan) await setPlan(user.id, plan);
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard$/);
    await run(page, user);
    await context.close();
  } finally {
    await deleteIsolatedUser(user.id);
  }
}

test.describe("input, analysis and the first rewrite", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("pasted text + target role/seniority produce keyword analysis, 3 headline variants, an About and bullet rewrites with before/after — all persisted, no LinkedIn login", async ({ open }) => {
    test.setTimeout(180_000);
    const page = await open();
    await page.goto("/dashboard/linkedin/new");
    await dismissCookieBanner(page);
    await expect(page.getByText("No LinkedIn sign-in needed")).toBeVisible();
    await expect(page.locator("input[type=password]")).toHaveCount(0); // never asks for LinkedIn credentials
    // Readable label on first paint, not the raw enum value ("mid").
    await expect(page.getByRole("combobox", { name: "Target seniority" })).toHaveText(/^Mid-level/);

    const draftId = await createDraft(page);

    // Three genuinely distinct headline variants.
    await expect(page.getByText("Product Manager | Roadmapping", { exact: true })).toBeVisible();
    await expect(page.getByText("Product manager who turns customer problems into shipped, measurable products")).toBeVisible();
    await expect(page.getByText("Product Manager | Roadmapping | Stakeholder Management | SQL | Agile")).toBeVisible();

    // Keyword analysis: a before → after score, what's found, and what's missing grouped by where it belongs.
    expect(await scores(page)).toEqual({ before: 15, after: 30 });
    await expect(page.getByText("Found (2)")).toBeVisible();
    await expect(page.getByText("Missing (7)")).toBeVisible();
    await expect(page.getByText("Add to Headline:")).toHaveCount(0); // Roadmapping (a headline term) is already found
    await expect(page.getByText("Add to About:")).toBeVisible();
    await expect(page.getByText("Add to Experience:")).toBeVisible();
    await expect(page.getByText("Stakeholder Management").first()).toBeVisible();

    // Before/after for About and Experience.
    await expect(page.getByText("I like SQL and spreadsheets.")).toBeVisible(); // before
    await expect(page.getByLabel("Your About section")).toHaveValue(/Roadmapping and Agile delivery/); // after
    await expect(page.getByText(INPUT.experience)).toBeVisible(); // before (as pasted)
    await expect(page.getByLabel("Experience bullet")).toHaveCount(3);
    await expect(page.getByText("Skills to add")).toBeVisible();

    // Everything is a real, persisted row.
    const draft = await draftOf(draftId);
    expect(draft).toMatchObject({ title: INPUT.title, target_role: INPUT.role, target_seniority: "senior", current_headline: INPUT.headline, current_about: INPUT.about, current_experience: INPUT.experience });
    expect(draft.optimized_headline_keyword_dense).toContain("Stakeholder Management");
    expect(draft.keyword_coverage_terms).toHaveLength(9);
    expect(draft.selected_headline).toBeNull();
    expect(await bulletsOf(draftId)).toHaveLength(3);
  });

  test("a dropped connection while generating says so and can simply be retried", async ({ open }) => {
    test.setTimeout(180_000);
    const page = await open();
    await page.goto("/dashboard/linkedin/new");
    await dismissCookieBanner(page);
    await page.getByLabel("Draft name").fill("Flaky network");
    await page.getByLabel("Target role").fill("Analyst");
    await page.getByLabel("Current Experience section").fill("Did analysis at a firm.");
    let dropNext = true;
    await page.route("**/dashboard/linkedin/new", (route) => {
      if (dropNext && route.request().method() === "POST") {
        dropNext = false;
        return route.abort();
      }
      return route.continue();
    });
    await page.getByRole("button", { name: "Generate rewrite" }).click();
    await expect(appAlert(page).filter({ hasText: /reach the server/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Generate rewrite" })).toBeEnabled(); // not stuck on "Generating…"
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.getByRole("button", { name: "Generate rewrite" }).click();
      await Promise.race([page.waitForURL(/\/dashboard\/linkedin\/[0-9a-f-]{36}$/, { timeout: 60_000 }), rateLimited(page).waitFor({ timeout: 60_000 })]).catch(() => undefined);
      if (/\/dashboard\/linkedin\/[0-9a-f-]{36}$/.test(page.url())) break;
      await page.waitForTimeout(15_000);
    }
    await expect(page.getByRole("heading", { name: "Flaky network" })).toBeVisible();
  });
});

test.describe("choose, edit, accept/reject and re-score", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("choosing a headline, editing with autosave and accepting rewrites each persist and re-score live", async ({ open }) => {
    test.setTimeout(300_000);
    const page = await open();
    const draftId = await createDraft(page, { title: "Rescore chain" });
    expect((await scores(page)).after).toBe(30);

    // Choose the keyword-dense headline: saved, marked "In use", and the score follows it (30 → 60).
    await page.getByRole("button", { name: "Use the Keyword-dense headline" }).click();
    await expect(page.getByRole("button", { name: "The Keyword-dense headline is in use" })).toBeVisible();
    await expect(page.getByLabel("Your headline")).toHaveValue(/Stakeholder Management/);
    expect((await scores(page)).after).toBe(60);
    await expect.poll(async () => (await draftOf(draftId)).selected_headline, { timeout: 10_000 }).toContain("Stakeholder Management");

    // Edit it freely — autosaved, and reload keeps it.
    await page.getByLabel("Your headline").fill("Senior Product Manager | Roadmapping | SQL");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => (await draftOf(draftId)).selected_headline, { timeout: 10_000 }).toBe("Senior Product Manager | Roadmapping | SQL");
    expect((await scores(page)).after).toBe(45); // Roadmapping, Agile (About/bullets), SQL = 9/20; Stakeholder Management is gone
    await page.getByLabel("Your headline").fill("Product Manager | Roadmapping | Stakeholder Management | SQL | Agile");
    await expect(page.getByText("Saved", { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    expect((await scores(page)).after).toBe(60);

    // Manual About edit: autosaved and re-scored live (+ Product Analytics, weight 2 → 70).
    const aboutBox = page.getByLabel("Your About section");
    await aboutBox.fill("I am a product manager focused on Roadmapping and Agile delivery, using Product Analytics.");
    await expect.poll(async () => (await draftOf(draftId)).optimized_about, { timeout: 10_000 }).toContain("Product Analytics");
    expect((await scores(page)).after).toBe(70);
    await page.reload();
    await expect(page.getByLabel("Your About section")).toHaveValue(/Product Analytics/);
    expect((await scores(page)).after).toBe(70); // the re-score survives a reload — it's derived from what's saved

    // Reject: a suggestion is shown, refused, and nothing changes.
    await requestRewrite(page, page.getByRole("button", { name: "Regenerate About with AI" }));
    await expect(page.getByText("Prioritisation and OKRs experience")).toBeVisible();
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByLabel("Your About section")).toHaveValue(/Product Analytics/);
    await expect.poll(async () => (await db().from("linkedin_about_rewrites").select("status").eq("draft_id", draftId)).data?.map((r) => r.status), { timeout: 10_000 }).toEqual(["rejected"]);
    expect((await draftOf(draftId)).optimized_about).toContain("Product Analytics");

    // Accept: the suggestion replaces the About, is persisted, and re-scores (Prioritisation 2 + OKRs 1, Product Analytics gone: 60 + 3 = ... see below).
    await requestRewrite(page, page.getByRole("button", { name: "Regenerate About with AI" }));
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByLabel("Your About section")).toHaveValue(/Prioritisation and OKRs experience/);
    await expect.poll(async () => (await draftOf(draftId)).optimized_about, { timeout: 10_000 }).toContain("Prioritisation and OKRs");
    // headline (Roadmapping, Stakeholder Management, SQL, Agile) 12 + Prioritisation 2 + OKRs 1 = 15/20
    expect((await scores(page)).after).toBe(75);

    // Experience bullet: accept a rewrite of the third bullet (+ Experimentation 2, User Research 1 → 90).
    await requestRewrite(page, page.getByRole("button", { name: "Regenerate this bullet" }).nth(2));
    await expect(page.getByText("Ran Experimentation and User Research reviews").first()).toBeVisible();
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByLabel("Experience bullet").nth(2)).toHaveValue(/Experimentation and User Research/);
    await expect.poll(async () => (await bulletsOf(draftId))[2].content, { timeout: 10_000 }).toContain("Experimentation");
    expect((await scores(page)).after).toBe(90);

    // Manual bullet edit autosaves too.
    await page.getByLabel("Experience bullet").first().fill("Led Agile delivery for a six-person squad across three releases.");
    await expect.poll(async () => (await bulletsOf(draftId))[0].content, { timeout: 10_000 }).toContain("three releases");

    // Every accept/reject was recorded.
    const { data: bulletRewrites } = await db().from("linkedin_experience_bullet_rewrites").select("status");
    expect(bulletRewrites!.some((r) => r.status === "accepted")).toBe(true);
  });
});

test.describe("recoverable history", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("edits checkpoint the draft, regenerate-everything keeps the previous state, and any version can be restored (undoably)", async ({ open }) => {
    test.setTimeout(300_000);
    const page = await open();
    const draftId = await createDraft(page, { title: "History draft" });
    expect(await versionsOf(draftId)).toHaveLength(0);

    // The first edit checkpoints the draft as it was generated.
    await page.getByLabel("Your About section").fill("My hand-edited About with Agile and Roadmapping.");
    await expect.poll(async () => (await draftOf(draftId)).optimized_about, { timeout: 10_000 }).toContain("hand-edited");
    await expect.poll(async () => (await versionsOf(draftId)).length, { timeout: 10_000 }).toBe(1);
    const checkpoint = (await versionsOf(draftId))[0];
    expect(checkpoint.label).toMatch(/autosaved/i);
    expect((checkpoint.snapshot as { about: string }).about).toContain("Roadmapping and Agile delivery for growing UK teams"); // the generated original
    await page.waitForTimeout(1500);
    await page.getByLabel("Your About section").fill("My hand-edited About with Agile and Roadmapping. More.");
    await page.waitForTimeout(2500);
    expect(await versionsOf(draftId)).toHaveLength(1); // a burst of edits reuses the checkpoint

    // Regenerate everything with a changed target: the previous state is kept, not overwritten and lost.
    await page.getByRole("button", { name: "Edit & regenerate all" }).click();
    await page.getByLabel("Target role").fill("Head of Product");
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.getByRole("button", { name: "Regenerate everything" }).click();
      await expect(page.getByRole("button", { name: "Regenerating…" })).toHaveCount(0, { timeout: 60_000 });
      if (!(await rateLimited(page).isVisible().catch(() => false))) break;
      await page.waitForTimeout(15_000);
    }
    await expect(page.getByText("Head of Product · Senior")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Your About section")).toHaveValue(/Roadmapping and Agile delivery for growing UK teams/); // freshly generated
    const afterRegenerate = await versionsOf(draftId);
    expect(afterRegenerate.some((v) => /before regenerating/i.test(v.label))).toBe(true);
    const beforeRegenerate = afterRegenerate.find((v) => /before regenerating/i.test(v.label))!;
    expect((beforeRegenerate.snapshot as { about: string; targetRole: string }).about).toContain("More.");
    expect((beforeRegenerate.snapshot as { targetRole: string }).targetRole).toBe(INPUT.role);
    expect((await draftOf(draftId)).selected_headline).toBeNull();

    // Restore the pre-regenerate state: About, target role, bullets all come back.
    await page.getByRole("button", { name: "Version history" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Current draft")).toBeVisible();
    await expect(dialog.getByText("Current", { exact: true })).toBeVisible();
    const row = dialog.locator("div.rounded-lg", { hasText: /Before regenerating/ });
    await row.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByText(`${INPUT.role} · Senior`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Your About section")).toHaveValue(/More\./);
    const restored = await draftOf(draftId);
    expect(restored.target_role).toBe(INPUT.role);
    expect(restored.optimized_about).toContain("More.");
    expect(await bulletsOf(draftId)).toHaveLength(3);

    // The restore was itself backed up, so it can be undone: the "Head of Product" state is still in the list.
    const afterRestore = await versionsOf(draftId);
    expect(afterRestore.some((v) => /before restoring/i.test(v.label))).toBe(true);
    const undo = afterRestore.find((v) => /before restoring/i.test(v.label))!;
    expect((undo.snapshot as { targetRole: string }).targetRole).toBe("Head of Product");
  });
});

test.describe("plan gating", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("the Free plan can't create a draft, and the server refuses AI on a draft it already has — while editing your own text still works", async ({ browser }) => {
    test.setTimeout(180_000);
    await withFreshUser(browser, null, async (page, user) => {
      await page.goto("/dashboard/linkedin/new");
      await expect(page.getByText("isn't included in your current plan")).toBeVisible();
      await expect(page.getByRole("link", { name: "See plans" })).toBeVisible();
      await expect(page.getByLabel("Current Experience section")).toHaveCount(0);

      // A draft that pre-dates a downgrade: still viewable and editable, but AI is refused server-side.
      const { data: draft } = await db()
        .from("linkedin_profile_drafts")
        .insert({
          user_id: user.id, title: "Old draft", target_role: "PM", target_seniority: "mid", current_experience: "Did PM things",
          optimized_headline_concise: "a", optimized_headline_narrative: "b", optimized_headline_keyword_dense: "c",
          optimized_about: "An about", generated_at: new Date().toISOString(),
          keyword_coverage_terms: [{ term: "SQL", importance: "high", suggestedPlacement: "about" }],
        })
        .select("id")
        .single();
      await db().from("linkedin_experience_bullets").insert({ draft_id: draft!.id, user_id: user.id, content: "A bullet", display_order: 0 });

      await page.goto(`/dashboard/linkedin/${draft!.id}`);
      await page.getByRole("button", { name: "Regenerate About with AI" }).click();
      await expect(appAlert(page).filter({ hasText: /plan|included/i })).toBeVisible({ timeout: 30_000 });
      expect((await db().from("linkedin_about_rewrites").select("id").eq("draft_id", draft!.id)).data).toHaveLength(0);

      await page.getByRole("button", { name: "Edit & regenerate all" }).click();
      await page.getByRole("button", { name: "Regenerate everything" }).click();
      await expect(appAlert(page).filter({ hasText: /plan|included/i })).toBeVisible({ timeout: 30_000 });
      expect((await draftOf(draft!.id)).target_role).toBe("PM"); // nothing was overwritten

      await page.getByRole("button", { name: "Cancel" }).click();
      await page.getByLabel("Your About section").fill("Hand-edited on the Free plan");
      await expect.poll(async () => (await draftOf(draft!.id)).optimized_about, { timeout: 10_000 }).toBe("Hand-edited on the Free plan");
    });
  });

  test("a draft is private to its owner", async ({ open }) => {
    const other = await createIsolatedUser({ fullName: "LinkedIn Other" });
    try {
      const { data: theirs } = await db()
        .from("linkedin_profile_drafts")
        .insert({ user_id: other.id, title: "Not yours", target_role: "PM", target_seniority: "mid", current_experience: "x" })
        .select("id")
        .single();
      const page = await open();
      await page.goto(`/dashboard/linkedin/${theirs!.id}`);
      await expect(page.locator("[data-route-not-found]")).toBeVisible(); // (a streamed page answers 200 before not-found renders, so check what the person sees)
      await expect(page.getByText("Not yours")).toHaveCount(0);
    } finally {
      await deleteIsolatedUser(other.id);
    }
  });
});
