import { expect } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, expectSaved, makeCvTest, openSeededEditor, PHONE } from "../support/cv-fixture";

// Creating, editing and restyling a CV on a phone (375px): the create dialog, autosave from the editor, and the template chooser.

const test = makeCvTest({ name: "CV Mobile Tester", plan: "pro" });
test.describe.configure({ mode: "serial", timeout: 120_000 });
const db = () => getAdminClient();
const noSideways = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test("a CV can be created from the list on a phone", async ({ open, account }) => {
  const page = await open(PHONE);
  await page.goto("/dashboard/cvs");
  await dismissCookieBanner(page);
  expect(await noSideways(page)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "New CV" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Title").fill("Phone CV");
  await page.getByRole("button", { name: "Create CV" }).click();
  await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/, { timeout: 30_000 });
  const { data } = await db().from("cvs").select("title").eq("user_id", account.user.id).eq("title", "Phone CV");
  expect(data).toHaveLength(1);
  await page.context().close();
});

test("editing on a phone autosaves and survives a reload, with no sideways scroll", async ({ open, account }) => {
  const { page, cvId } = await openSeededEditor(open, account.user.id, { title: "Phone Edit CV" }, PHONE);
  expect(await noSideways(page)).toBeLessThanOrEqual(1);
  await page.getByLabel("Full name").fill("Phone Typed Name");
  await expectSaved(page);
  const { data: versions } = await db().from("cv_versions").select("id").eq("cv_id", cvId);
  const { data } = await db().from("cv_personal").select("full_name").in("cv_version_id", (versions ?? []).map((row) => row.id));
  expect(data).toContainEqual({ full_name: "Phone Typed Name" }); // (an earlier checkpoint keeps the previous name)
  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue("Phone Typed Name");
  expect(await noSideways(page)).toBeLessThanOrEqual(1);
  await page.context().close();
});

test("the template chooser fits a phone and a chosen template is saved", async ({ open, account }) => {
  const { cvId } = await seedCv(account.user.id, { title: "Phone Template CV", template: "northlight" });
  const page = await open(PHONE);
  await page.goto(`/dashboard/cvs/${cvId}`);
  await dismissCookieBanner(page);
  await page.getByRole("button", { name: "Templates" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(PHONE.width + 1);
  expect(await noSideways(page)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Use the Oxford template" }).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Use the Oxford template" }).click();
  await expect.poll(async () => (await db().from("cvs").select("template").eq("id", cvId).single()).data?.template, { timeout: 20_000 }).toBe("oxford");
  await page.context().close();
});
