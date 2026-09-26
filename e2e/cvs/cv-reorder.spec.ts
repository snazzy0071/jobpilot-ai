import { expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { expectSaved, makeCvTest, norm, openSeededEditor, previewDoc } from "../support/cv-fixture";

// Reordering: the section blocks (Skills before Experience, say) and the rows inside a section. Both by dragging
// the grip with the mouse and by keyboard (focus the grip, arrow keys) — and both must reach the database, the
// preview, and survive a reload.

const test = makeCvTest({ name: "CV Reorder Tester" });
const db = () => getAdminClient();

const chip = (page: Page, label: string) => page.getByRole("button", { name: `Drag to reorder ${label}` });
const sectionOrder = async (versionId: string) => (await db().from("cv_versions").select("section_order").eq("id", versionId).single()).data?.section_order as string[];
// The section chips only (row grips inside the sections also carry data-drag-handle).
const chipLabels = (page: Page) =>
  page.getByText(/^Section order/).locator("xpath=..").locator("[data-drag-handle]").evaluateAll((els) => els.map((el) => el.getAttribute("data-drag-handle")));

/** Where a section's heading appears in the preview's text — smaller means higher on the page. */
async function previewPosition(page: Page, heading: string) {
  return norm(await previewDoc(page).innerText()).indexOf(heading);
}

/** Drags a grip onto another, in small mouse moves and overshooting a little, the way a hand does: the list only reorders once the dragged item has passed its neighbour's midpoint. */
async function dragTo(page: Page, from: ReturnType<typeof chip>, to: ReturnType<typeof chip>) {
  await from.scrollIntoViewIfNeeded();
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error("grip not visible");
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const horizontal = Math.abs(end.x - start.x) > Math.abs(end.y - start.y);
  const overshoot = 30;
  const target = horizontal ? { x: end.x + Math.sign(end.x - start.x) * overshoot, y: end.y } : { x: end.x, y: end.y + Math.sign(end.y - start.y) * overshoot };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + (horizontal ? Math.sign(target.x - start.x) * 5 : 0), start.y + (horizontal ? 0 : Math.sign(target.y - start.y) * 5), { steps: 3 });
  const steps = 40;
  for (let i = 1; i <= steps; i++) await page.mouse.move(start.x + ((target.x - start.x) * i) / steps, start.y + ((target.y - start.y) * i) / steps);
  await page.mouse.up();
}

test.describe("section order", () => {
  test("keyboard: the grip's arrow keys move a section, the order is saved, the preview follows, and it survives a reload", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    const before = await sectionOrder(versionId);
    const skillsIndex = before.indexOf("skills");
    expect(skillsIndex).toBeGreaterThan(0);

    const skillsBeforeExperience = async () => (await previewPosition(page, "Skills")) < (await previewPosition(page, "Experience"));
    expect(await skillsBeforeExperience()).toBe(false);

    await chip(page, "Skills").focus();
    for (let i = 0; i < before.indexOf("skills") - before.indexOf("experience"); i++) await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft"); // one more: now ahead of Experience
    await expect(chip(page, "Skills")).toBeFocused(); // focus stays on the grip so the keys keep working

    await expect.poll(async () => (await sectionOrder(versionId)).indexOf("skills"), { timeout: 15_000 }).toBeLessThan(before.indexOf("experience"));
    await expectSaved(page);
    await expect.poll(skillsBeforeExperience).toBe(true);

    const saved = await sectionOrder(versionId);
    await page.reload();
    expect(await sectionOrder(versionId)).toEqual(saved);
    expect(await skillsBeforeExperience()).toBe(true);
    expect((await chipLabels(page))[0]).toBe(saved[0]);
  });

  test("keyboard: the first section can't move earlier and the last can't move later", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    const before = await sectionOrder(versionId);
    await chip(page, "Personal details").focus();
    await page.keyboard.press("ArrowLeft");
    await chip(page, "Custom sections").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1500);
    expect(await sectionOrder(versionId)).toEqual(before);
  });

  test("drag: dragging a section's grip moves it, and the order is saved", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    const before = await sectionOrder(versionId);
    await dragTo(page, chip(page, "Skills"), chip(page, "Summary"));
    await expect.poll(async () => (await sectionOrder(versionId)).indexOf("skills"), { timeout: 15_000 }).toBeLessThan(before.indexOf("skills"));
    await expectSaved(page);
    await page.waitForTimeout(1500); // a drag past several neighbours saves several times; take the settled order
    await expectSaved(page);
    const saved = await sectionOrder(versionId);
    await page.reload();
    expect(await chipLabels(page)).toEqual(saved);
  });
});

test.describe("rows inside a section", () => {
  test("keyboard: moving a skill changes its stored order, the preview order, and survives a reload", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id); // seeded skills: TypeScript, Kubernetes
    const stored = async () =>
      ((await db().from("cv_skills").select("name, display_order").eq("cv_version_id", versionId).order("display_order")).data ?? []).map((row) => row.name);
    expect(await stored()).toEqual(["TypeScript", "Kubernetes"]);

    const inPreview = async (first: string, second: string) => {
      const text = norm(await previewDoc(page).innerText());
      return text.indexOf(first) < text.indexOf(second);
    };
    expect(await inPreview("TypeScript", "Kubernetes")).toBe(true);

    const kubernetesRow = page.getByText("Kubernetes").first().locator("xpath=ancestor::*[.//button[@aria-label='Delete skill']][1]");
    await kubernetesRow.getByRole("button", { name: "Drag to reorder" }).focus();
    await page.keyboard.press("ArrowUp");

    await expect.poll(stored, { timeout: 15_000 }).toEqual(["Kubernetes", "TypeScript"]);
    await expectSaved(page);
    await expect.poll(() => inPreview("Kubernetes", "TypeScript")).toBe(true);

    await page.reload();
    expect(await stored()).toEqual(["Kubernetes", "TypeScript"]);
    expect(await inPreview("Kubernetes", "TypeScript")).toBe(true);
  });

  test("drag: dragging one experience row above another is saved", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id); // Senior Platform Engineer, Software Engineer
    const stored = async () =>
      ((await db().from("cv_experience").select("job_title, display_order").eq("cv_version_id", versionId).order("display_order")).data ?? []).map((row) => row.job_title);
    expect(await stored()).toEqual(["Senior Platform Engineer", "Software Engineer"]);

    const second = page.getByText("Software Engineer", { exact: true }).first().locator("xpath=ancestor::*[.//button[@aria-label='Delete role']][1]").getByRole("button", { name: "Drag to reorder" });
    const first = page.getByText("Senior Platform Engineer", { exact: true }).first().locator("xpath=ancestor::*[.//button[@aria-label='Delete role']][1]").getByRole("button", { name: "Drag to reorder" });
    await dragTo(page, second, first);
    await expect.poll(stored, { timeout: 15_000 }).toEqual(["Software Engineer", "Senior Platform Engineer"]);
    await page.reload();
    expect(await stored()).toEqual(["Software Engineer", "Senior Platform Engineer"]);
  });
});
