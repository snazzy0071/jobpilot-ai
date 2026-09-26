import { expect } from "@playwright/test";
import { CV_TEMPLATES, CV_TEMPLATE_CATEGORIES, CV_TEMPLATE_CATEGORY_LABELS } from "../../src/config/cv-templates";
import { getAdminClient } from "../support/admin-client";
import { makeCvTest, openSeededEditor } from "../support/cv-fixture";
import { seedCv } from "../support/cv";

// The template gallery (the "Templates" chooser) and the thumbnails on the CV list: all 24 templates shown as real
// renderings with their name, style, ATS-safe badge and recommended-for text; the category filters narrow the list
// to exactly the templates in that category; Preview shows the user's own CV in that template.

const test = makeCvTest({ name: "CV Gallery Tester", plan: "pro" });
const db = () => getAdminClient();

test.describe("template gallery", () => {
  test("shows all 24 templates as real thumbnails with name, style, ATS-safe badge and recommended-for text", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id);
    await page.getByRole("button", { name: "Templates" }).click();
    const dialog = page.getByRole("dialog");
    const cards = dialog.getByRole("listitem").filter({ has: page.locator("[data-cv-template]") });
    await expect(cards).toHaveCount(24);

    for (const template of CV_TEMPLATES) {
      const card = dialog.getByRole("listitem").filter({ has: page.getByRole("button", { name: new RegExp(`(Use the ${template.name} template|${template.name} is your current template)`) }) });
      await expect(card, template.slug).toHaveCount(1);
      await expect(card.locator("[data-cv-template]").first(), `${template.slug}: thumbnail is its own design`).toHaveAttribute("data-cv-template", template.slug);
      await expect(card.getByText(template.name, { exact: true }).first()).toBeVisible();
      await expect(card.getByText(/ATS[- ]safe/i).first(), `${template.slug}: ATS-safe badge`).toBeVisible();
      await expect(card, `${template.slug}: recommended-for text`).toContainText(template.recommendedFor);
      // A real rendering, not an empty frame: it holds the sample CV's text.
      expect((await card.locator("[data-cv-template]").first().innerText()).trim().length, `${template.slug}: thumbnail has content`).toBeGreaterThan(40);
    }
  });

  test("each category filter shows exactly the templates in that category", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id);
    await page.getByRole("button", { name: "Templates" }).click();
    const dialog = page.getByRole("dialog");
    const filters = dialog.getByRole("group", { name: "Filter templates by category" });

    for (const category of CV_TEMPLATE_CATEGORIES) {
      await filters.getByRole("button", { name: new RegExp(`^${CV_TEMPLATE_CATEGORY_LABELS[category]}( |$)`) }).click();
      const expected = CV_TEMPLATES.filter((template) => template.categories.includes(category)).map((template) => template.slug).sort();
      const shown = await dialog.locator("li [data-cv-template]").evaluateAll((els) => els.map((el) => el.getAttribute("data-cv-template")!).sort());
      expect(shown, `category ${category}`).toEqual(expected);
    }
    await filters.getByRole("button", { name: /^All/ }).click();
    await expect(dialog.locator("li [data-cv-template]")).toHaveCount(24);
  });

  test("Preview shows the user's own CV in that template, and going back returns to the gallery", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id);
    await page.getByRole("button", { name: "Templates" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Preview Sovereign" }).click();
    await expect(dialog.getByRole("heading", { name: /Preview Sovereign/ })).toBeVisible();
    await expect(dialog.locator("[data-cv-template='sovereign']").first()).toBeVisible();
    await expect(dialog.locator("[data-cv-template='sovereign']").first()).toContainText("Marlow Tech"); // the user's data, not sample data
    // Previewing changes nothing.
    await dialog.getByRole("button", { name: "All templates" }).click();
    await expect(dialog.getByRole("listitem").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-current-template]")).not.toHaveAttribute("data-current-template", "sovereign");
  });
});

test.describe("thumbnails on the CV list", () => {
  test("each CV card shows that CV's own content in its own template, and follows a template change", async ({ open, account }) => {
    const a = await seedCv(account.user.id, { title: "Gallery A", template: "sovereign", fullName: "Alpha Person" });
    const b = await seedCv(account.user.id, { title: "Gallery B", template: "terminal", fullName: "Beta Person" });
    const page = await open();
    await page.goto("/dashboard/cvs");
    await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
    const card = (title: string) => page.locator("[data-slot='card']").filter({ has: page.getByRole("link", { name: title, exact: true }) }).first();

    await expect(card("Gallery A").locator("[data-cv-template]").first()).toHaveAttribute("data-cv-template", "sovereign");
    await expect(card("Gallery A")).toContainText("Alpha Person");
    await expect(card("Gallery B").locator("[data-cv-template]").first()).toHaveAttribute("data-cv-template", "terminal");
    await expect(card("Gallery B")).toContainText("Beta Person");

    await db().from("cvs").update({ template: "atlas" }).eq("id", b.cvId);
    await page.reload();
    await expect(card("Gallery B").locator("[data-cv-template]").first()).toHaveAttribute("data-cv-template", "atlas");
    expect(a.cvId).not.toBe(b.cvId);
  });
});
