import { expect, type Route } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest } from "../support/cv-fixture";

// The CV's life cycle from the list page: create, rename, duplicate, archive, delete — each checked against the
// database, not just the screen — plus the Free plan's one-CV limit and the loading / not-found states.

const test = makeCvTest({ name: "CV Lifecycle Tester", plan: "elite" });
const db = () => getAdminClient();

const cardFor = (page: import("@playwright/test").Page, title: string) =>
  page.locator("[data-slot='card']").filter({ has: page.getByRole("link", { name: title, exact: true }) }).first();

test.describe("CV list actions", () => {
  test("create: the dialog makes a CV with a first version, opens it, and the list shows it", async ({ open, account }) => {
    const page = await open();
    await page.goto("/dashboard/cvs");
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: "New CV" }).first().click();
    await page.getByLabel("Title").fill("Lifecycle Created");
    await page.getByRole("button", { name: "Create CV" }).click();
    await page.waitForURL(/\/dashboard\/cvs\/[0-9a-f-]{36}$/);
    const cvId = page.url().split("/").pop()!;

    const { data: cv } = await db().from("cvs").select("title, user_id, template").eq("id", cvId).single();
    expect(cv).toMatchObject({ title: "Lifecycle Created", user_id: account.user.id });
    const { data: versions } = await db().from("cv_versions").select("id, is_current").eq("cv_id", cvId);
    expect(versions).toHaveLength(1);
    expect(versions![0].is_current).toBe(true);

    await page.goto("/dashboard/cvs");
    const card = cardFor(page, "Lifecycle Created");
    await expect(card).toBeVisible();
    await expect(card.locator("[data-cv-template]").first()).toBeVisible(); // a real thumbnail, not an empty tile
  });

  test("rename: the new title is stored and shown", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { title: "Before Rename" });
    const page = await open();
    await page.goto("/dashboard/cvs");
    await dismissCookieBanner(page);
    await cardFor(page, "Before Rename").getByRole("button", { name: "Rename CV" }).click();
    await page.getByRole("dialog").getByLabel("Title").fill("After Rename");
    await page.getByRole("dialog").getByRole("button", { name: /^rename|^save/i }).click();
    await expect.poll(async () => (await db().from("cvs").select("title").eq("id", cvId).single()).data?.title, { timeout: 15_000 }).toBe("After Rename");
    await expect(cardFor(page, "After Rename")).toBeVisible();
  });

  test("duplicate: an independent copy with the same template, section order and every section's content", async ({ open, account }) => {
    const { cvId, versionId } = await seedCv(account.user.id, { title: "Original To Copy", template: "sovereign" });
    // Give it a bit of everything so the copy has something to lose.
    await db().from("cv_skills").insert({ cv_version_id: versionId, user_id: account.user.id, name: "Copyable Skill", display_order: 0 });
    await db().from("cv_versions").update({ section_order: ["summary", "experience", "personal", "education", "skills", "projects", "certifications", "languages", "customSections"] }).eq("id", versionId);

    const page = await open();
    await page.goto("/dashboard/cvs");
    await dismissCookieBanner(page);
    await cardFor(page, "Original To Copy").getByRole("button", { name: "Duplicate CV" }).click();
    await expect(cardFor(page, "Original To Copy (Copy)")).toBeVisible({ timeout: 15_000 });

    const { data: copy } = await db().from("cvs").select("id, template, title").eq("title", "Original To Copy (Copy)").eq("user_id", account.user.id).single();
    expect(copy!.template).toBe("sovereign");
    const { data: copyVersion } = await db().from("cv_versions").select("id, section_order, is_current").eq("cv_id", copy!.id).single();
    expect(copyVersion!.is_current).toBe(true);
    expect(copyVersion!.section_order).toEqual(["summary", "experience", "personal", "education", "skills", "projects", "certifications", "languages", "customSections"]);

    const count = async (table: string, version: string) => (await db().from(table).select("id", { count: "exact", head: true }).eq("cv_version_id", version)).count;
    for (const table of ["cv_personal", "cv_summary", "cv_experience", "cv_education", "cv_skills"]) {
      expect(await count(table, copyVersion!.id), table).toBe(await count(table, versionId));
    }

    // Independent: editing the copy leaves the original alone.
    await page.goto(`/dashboard/cvs/${copy!.id}`);
    await page.getByLabel("Headline").fill("Only on the copy");
    await expect.poll(async () => (await db().from("cv_personal").select("headline").eq("cv_version_id", copyVersion!.id).single()).data?.headline, { timeout: 15_000 }).toBe("Only on the copy");
    expect((await db().from("cv_personal").select("headline").eq("cv_version_id", versionId).single()).data?.headline).toBe("Senior Platform Engineer");
    expect(cvId).not.toBe(copy!.id);
  });

  test("archive and restore: the flag flips, and the card moves between the lists", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { title: "To Archive" });
    const page = await open();
    await page.goto("/dashboard/cvs");
    await dismissCookieBanner(page);
    await cardFor(page, "To Archive").getByRole("button", { name: "Archive CV" }).click();
    await expect.poll(async () => (await db().from("cvs").select("is_archived").eq("id", cvId).single()).data?.is_archived, { timeout: 15_000 }).toBe(true);
    await expect(page.getByRole("heading", { name: "Archived" })).toBeVisible();
    await cardFor(page, "To Archive").getByRole("button", { name: "Restore CV" }).click();
    await expect.poll(async () => (await db().from("cvs").select("is_archived").eq("id", cvId).single()).data?.is_archived, { timeout: 15_000 }).toBe(false);
  });

  test("delete: cancel keeps the CV; confirming removes it and everything under it", async ({ open, account }) => {
    const { cvId, versionId } = await seedCv(account.user.id, { title: "To Delete" });
    const page = await open();
    await page.goto("/dashboard/cvs");
    await dismissCookieBanner(page);

    await cardFor(page, "To Delete").getByRole("button", { name: "Delete CV" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
    expect((await db().from("cvs").select("id").eq("id", cvId)).data).toHaveLength(1);

    await cardFor(page, "To Delete").getByRole("button", { name: "Delete CV" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(async () => (await db().from("cvs").select("id").eq("id", cvId)).data?.length, { timeout: 15_000 }).toBe(0);
    for (const table of ["cv_versions", "cv_personal", "cv_summary", "cv_experience", "cv_education", "cv_skills"]) {
      const column = table === "cv_versions" ? "id" : "cv_version_id";
      expect((await db().from(table).select("id").eq(column, versionId)).data, `${table} rows under the deleted CV`).toHaveLength(0);
    }
    await expect(page.getByRole("link", { name: "To Delete", exact: true })).toHaveCount(0);
  });
});

test.describe("loading, not-found and plan limit", () => {
  test("a CV that doesn't exist, isn't yours or has a broken id shows a not-found page, not a crash", async ({ open, account }) => {
    const other = await createIsolatedUser({ fullName: "Someone Else" });
    try {
      await markOnboarded(other.id);
      const { cvId: othersCv } = await seedCv(other.id, { title: "Not Yours" });
      const page = await open();
      for (const id of ["11111111-1111-4111-8111-111111111111", "not-a-uuid", othersCv]) {
        await page.goto(`/dashboard/cvs/${id}`);
        await expect(page.locator("[data-cv-not-found]"), id).toBeVisible();
        await expect(page.getByRole("link", { name: "Back to your CVs" })).toBeVisible();
      }
    } finally {
      await deleteIsolatedUser(other.id);
    }
  });

  test("the list and the editor show a skeleton while they load", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { title: "Slow To Open" });
    const page = await open();
    await page.goto("/dashboard");
    await dismissCookieBanner(page);

    // Hold the client-side navigation's data request so the loading UI is on screen long enough to see.
    await page.route(/\/dashboard\/cvs(\/[0-9a-f-]{36})?\?_rsc=/, async (route: Route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await page.getByRole("link", { name: /CV Builder/ }).first().click();
    await expect(page.locator("[data-cv-loading='list']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your CVs" })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "Slow To Open", exact: true }).first().click();
    await expect(page.locator("[data-cv-loading='editor']")).toBeVisible();
    await expect(page.getByLabel("Full name")).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain(cvId);
  });

  test("the Free plan's one-CV limit is enforced, and deleting a CV frees the slot", async ({ browser }) => {
    const free = await createIsolatedUser({ fullName: "Free Limit Tester" });
    try {
      await markOnboarded(free.id);
      const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", viewport: { width: 1360, height: 900 } });
      const page = await context.newPage();
      await page.goto("/login");
      await page.getByLabel("Email").fill(free.email);
      await page.getByLabel("Password", { exact: true }).fill(free.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/dashboard$/);
      await dismissCookieBanner(page);

      const create = async (title: string) => {
        await page.goto("/dashboard/cvs");
        await page.getByRole("button", { name: "New CV" }).first().click();
        await page.getByLabel("Title").fill(title);
        await page.getByRole("button", { name: "Create CV" }).click();
      };

      await create("Free First");
      await page.waitForURL(/\/dashboard\/cvs\/[0-9a-f-]{36}$/);

      await create("Free Second");
      await expect(page.getByRole("dialog").getByText(/limit|upgrade|plan/i).first()).toBeVisible({ timeout: 15_000 });
      expect((await db().from("cvs").select("id").eq("user_id", free.id)).data).toHaveLength(1);

      await page.keyboard.press("Escape");
      await page.goto("/dashboard/cvs");
      await cardFor(page, "Free First").getByRole("button", { name: "Delete CV" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
      await expect.poll(async () => (await db().from("cvs").select("id").eq("user_id", free.id)).data?.length, { timeout: 15_000 }).toBe(0);

      await create("Free Again");
      await page.waitForURL(/\/dashboard\/cvs\/[0-9a-f-]{36}$/);
      await context.close();
    } finally {
      await deleteIsolatedUser(free.id);
    }
  });
});
