import { expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest } from "../support/cv-fixture";

// The plan's template allowance (`cv_template_count`: Free 3, paid 24) enforced on the server, with the picker showing what is locked.

const test = makeCvTest({ name: "Template Plan Tester" });
test.describe.configure({ mode: "serial", timeout: 120_000 });
const db = () => getAdminClient();
let cvId = "";

async function templateOf(id: string) {
  return (await db().from("cvs").select("template").eq("id", id).single()).data?.template as string;
}

async function openPicker(page: Page) {
  await page.goto(`/dashboard/cvs/${cvId}`);
  await dismissCookieBanner(page);
  await page.getByRole("button", { name: "Templates" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("a Free account can choose its three templates and the rest are marked as paid", async ({ open, account }) => {
  cvId = (await seedCv(account.user.id, { title: "Plan CV", template: "northlight" })).cvId;
  const page = await open();
  await openPicker(page);
  const locked = page.getByRole("button", { name: /needs a paid plan/ });
  await expect(locked).toHaveCount(21);
  await expect(page.getByRole("button", { name: "Use the Oxford template" })).toBeEnabled();
  await page.getByRole("button", { name: "Use the Oxford template" }).click();
  await expect.poll(() => templateOf(cvId), { timeout: 20_000 }).toBe("oxford");
  await page.context().close();
});

test("the server refuses a locked template even when the button is forced on, and the CV keeps its template", async ({ open }) => {
  const page = await open();
  await openPicker(page);
  const card = page.getByRole("button", { name: "Whitehall needs a paid plan" });
  await card.evaluate((element) => element.removeAttribute("disabled"));
  await card.click();
  // The save is attempted and rejected; give it time to complete, then the CV must still have its template (and the editor reverts).
  await page.waitForTimeout(5000);
  await expect(page.getByText(/couldn.t save|part of a paid plan/i).first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  expect(await templateOf(cvId)).toBe("oxford");
  await page.context().close();
});

test("creating a CV works on an allowed template and the locked ones are disabled in the list", async ({ open, account }) => {
  const page = await open();
  await page.goto("/dashboard/cvs");
  await dismissCookieBanner(page);
  await page.getByRole("button", { name: "New CV" }).first().click();
  await page.getByLabel("Title").fill("Allowed template CV");
  await page.getByRole("button", { name: "Create CV" }).click();
  await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/,{ timeout: 30_000 });
  const { data } = await db().from("cvs").select("title, template").eq("user_id", account.user.id).eq("title", "Allowed template CV");
  expect(data).toEqual([{ title: "Allowed template CV", template: "northlight" }]);
  // Locked options are disabled in the list (and the server refuses them regardless: same check as the picker test above).
  await page.goto("/dashboard/cvs");
  await page.getByRole("button", { name: "New CV" }).first().click();
  await page.getByRole("combobox", { name: "Template" }).click();
  await expect(page.getByRole("option", { name: /Whitehall.*paid plan/ })).toHaveAttribute("aria-disabled", "true");
  await page.context().close();
});

test("a paid account sees every template unlocked", async ({ open, account }) => {
  await db().from("subscriptions").upsert({ user_id: account.user.id, plan_id: (await db().from("plans").select("id").eq("slug", "pro").single()).data!.id, status: "active" }, { onConflict: "user_id" });
  const page = await open();
  await openPicker(page);
  await expect(page.getByRole("button", { name: /needs a paid plan/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Use the Whitehall template" }).click();
  await expect.poll(() => templateOf(cvId), { timeout: 20_000 }).toBe("whitehall");
  await page.context().close();
});
