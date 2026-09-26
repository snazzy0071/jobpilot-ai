import { expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { expectSaved, makeCvTest, openSeededEditor, previewDoc } from "../support/cv-fixture";

// Version history: the first edit to a CV keeps a checkpoint of how it was (one, however many fields change at
// once), the history dialog lists it, restoring it brings that content back everywhere (forms, preview, database),
// and nothing is lost by restoring — the version you left is itself restorable.

const test = makeCvTest({ name: "CV History Tester" });
const db = () => getAdminClient();

const versionsOf = async (cvId: string) =>
  (await db().from("cv_versions").select("id, is_current, label, version_number").eq("cv_id", cvId).order("version_number")).data ?? [];
const headlineOf = async (versionId: string) => (await db().from("cv_personal").select("headline").eq("cv_version_id", versionId).single()).data?.headline;

async function restoreOldest(page: Page) {
  await page.getByRole("button", { name: "Version history" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Restore" }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Restore" }).first().click();
  await page.keyboard.press("Escape");
}

test.describe("version history", () => {
  test("the first edit keeps one checkpoint of the CV as it was, even when several fields change at once", async ({ open, account }) => {
    const { page, cvId, versionId } = await openSeededEditor(open, account.user.id);
    expect(await versionsOf(cvId)).toHaveLength(1);

    // Two different forms save at nearly the same moment.
    await page.getByLabel("Headline").fill("Edited Headline One");
    await page.locator("textarea[name='content']").first().fill("An edited summary written at the same time.");
    await expectSaved(page);
    await expect.poll(async () => (await versionsOf(cvId)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await page.waitForTimeout(2000); // let any duplicate checkpoint show up
    const versions = await versionsOf(cvId);
    expect(versions, "one current version and exactly one checkpoint").toHaveLength(2);
    expect(versions.filter((v) => v.is_current)).toHaveLength(1);

    // The checkpoint holds the CV as it was before the edit; the current version holds the edit.
    const checkpoint = versions.find((v) => !v.is_current)!;
    expect(checkpoint.label).toMatch(/autosaved/i);
    expect(await headlineOf(checkpoint.id)).toBe("Senior Platform Engineer");
    expect(await headlineOf(versionId)).toBe("Edited Headline One");

    // More edits soon after reuse that checkpoint instead of piling up new ones.
    await page.getByLabel("Headline").fill("Edited Headline Two");
    await expectSaved(page);
    await page.waitForTimeout(1500);
    expect(await versionsOf(cvId)).toHaveLength(2);
  });

  test("restoring the checkpoint brings the old content back in the forms, the preview and the database — and the edited version stays restorable", async ({ open, account }) => {
    const { page, cvId, versionId } = await openSeededEditor(open, account.user.id);
    await page.getByLabel("Headline").fill("The Edited Headline");
    await expectSaved(page);
    await expect.poll(async () => (await versionsOf(cvId)).length, { timeout: 15_000 }).toBe(2);
    const checkpoint = (await versionsOf(cvId)).find((v) => !v.is_current)!;

    // The dialog lists both versions.
    await page.getByRole("button", { name: "Version history" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/current/i).first()).toBeVisible();
    await expect(dialog.getByText(/autosaved/i).first()).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Restore" })).toHaveCount(1);
    await page.keyboard.press("Escape");

    await restoreOldest(page);
    await expect.poll(async () => (await versionsOf(cvId)).find((v) => v.is_current)?.id, { timeout: 15_000 }).toBe(checkpoint.id);

    await expect(page.getByLabel("Headline")).toHaveValue("Senior Platform Engineer", { timeout: 15_000 });
    await expect(previewDoc(page)).toContainText("Senior Platform Engineer");
    await expect(previewDoc(page)).not.toContainText("The Edited Headline");
    await page.reload();
    await expect(page.getByLabel("Headline")).toHaveValue("Senior Platform Engineer");

    // Nothing was lost: the edited version is still in the history and can be brought back.
    await restoreOldest(page);
    await expect.poll(async () => (await versionsOf(cvId)).find((v) => v.is_current)?.id, { timeout: 15_000 }).toBe(versionId);
    await expect(page.getByLabel("Headline")).toHaveValue("The Edited Headline", { timeout: 15_000 });
    await expect(previewDoc(page)).toContainText("The Edited Headline");
  });

  test("editing after a restore keeps working on the restored version, and saves to it", async ({ open, account }) => {
    const { page, cvId } = await openSeededEditor(open, account.user.id);
    await page.getByLabel("Headline").fill("Before The Restore");
    await expectSaved(page);
    await expect.poll(async () => (await versionsOf(cvId)).length, { timeout: 15_000 }).toBe(2);
    await restoreOldest(page);
    await expect(page.getByLabel("Headline")).toHaveValue("Senior Platform Engineer", { timeout: 15_000 });

    await page.getByLabel("Headline").fill("After The Restore");
    await expectSaved(page);
    const current = (await versionsOf(cvId)).find((v) => v.is_current)!;
    await expect.poll(() => headlineOf(current.id), { timeout: 15_000 }).toBe("After The Restore");
    await page.reload();
    await expect(page.getByLabel("Headline")).toHaveValue("After The Restore");
    await expect(previewDoc(page)).toContainText("After The Restore");
  });
});
