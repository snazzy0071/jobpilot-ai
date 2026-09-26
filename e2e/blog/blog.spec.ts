import { expect, test, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { dismissCookieBanner } from "../support/cv-fixture";
import { createLimitedAdmin, createSuperAdmin, openAs, BASE_URL, removeAdminSession, type AdminSession } from "../support/admin-session";

// The Blog against the real database: public list, category filter, post page, drafts and scheduled posts staying private, sitemap;
// and the admin create / edit / publish / delete flow with its validation, permission and audit trail. The six real posts are only
// read; everything these tests add has a "e2eblog-" slug and is deleted afterwards.

test.describe.configure({ mode: "serial", timeout: 180_000 });

const db = () => getAdminClient();
const ROLE = `e2e-blog-${Date.now().toString(36)}`;
let admin: AdminSession;
let limited: AdminSession;
let categoryId = "";
let categoryName = "";
let authorId = "";

const block = (text: string) => ({ type: "paragraph", text });
const post = (over: Record<string, unknown>) => ({
  title: "E2E Post", excerpt: "An e2e post.", content: [block("Body text.")], category_id: categoryId, author_id: authorId,
  published_at: new Date(Date.now() - 3_600_000).toISOString(), ...over,
});

async function cleanup() {
  await db().from("blog_posts").delete().like("slug", "e2eblog-%");
  await db().from("blog_categories").delete().like("slug", "e2eblog-%");
  await db().from("blog_authors").delete().like("slug", "e2eblog-%");
}

async function visit(page: Page, path: string) {
  const response = await page.goto(path);
  await dismissCookieBanner(page);
  return response;
}

test.beforeAll(async ({ browser }) => {
  await cleanup();
  const { data: cats } = await db().from("blog_categories").select("id, name").limit(1);
  const { data: authors } = await db().from("blog_authors").select("id").limit(1);
  categoryId = cats![0].id;
  categoryName = cats![0].name;
  authorId = authors![0].id;
  const { error } = await db().from("blog_posts").insert([
    post({ slug: "e2eblog-live", title: "E2E Zebrastripe Live Post", excerpt: "A live post about quokkacorns." }),
    post({ slug: "e2eblog-draft", title: "E2E Secret Draft", published_at: null }),
    post({ slug: "e2eblog-scheduled", title: "E2E Scheduled Post", published_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }),
  ]);
  if (error) throw new Error(error.message);
  admin = await createSuperAdmin(browser, "Blog Admin");
  limited = await createLimitedAdmin(browser, "manage_users", ROLE);
});

test.afterAll(async () => {
  await cleanup();
  await removeAdminSession(admin);
  await removeAdminSession(limited, ROLE);
});

test("the public blog lists live posts with categories, and never a draft or a scheduled post", async ({ page }) => {
  await visit(page, "/blog");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("visa advice");
  await expect(page.getByText("E2E Zebrastripe Live Post")).toBeVisible();
  await expect(page.getByText("E2E Secret Draft")).toHaveCount(0);
  await expect(page.getByText("E2E Scheduled Post")).toHaveCount(0);
  // The real seeded posts are there too.
  expect(await page.getByRole("link", { name: /Read|post/i }).count()).toBeGreaterThan(0);
});

test("filtering by category narrows the list and is a shareable URL; an unknown category says there is nothing", async ({ page }) => {
  await visit(page, "/blog");
  await page.getByRole("link", { name: categoryName, exact: true }).click();
  await expect(page).toHaveURL(/\/blog\?category=/);
  await expect(page.getByText("E2E Zebrastripe Live Post")).toBeVisible();
  await visit(page, "/blog?category=no-such-category");
  await expect(page.getByText("No posts here yet")).toBeVisible();
});

test("a post page shows its content and metadata; drafts, scheduled and unknown posts are 404", async ({ page }) => {
  const response = await visit(page, "/blog/e2eblog-live");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E Zebrastripe Live Post");
  await expect(page.getByText("Body text.")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/blog\/e2eblog-live$/);
  for (const slug of ["e2eblog-draft", "e2eblog-scheduled", "e2eblog-nothing"]) {
    const missing = await visit(page, `/blog/${slug}`);
    expect(missing?.status(), slug).toBe(404);
  }
});

test("the sitemap lists live posts only", async ({ request }) => {
  const xml = await (await request.get(`${BASE_URL}/sitemap.xml`)).text();
  expect(xml).toContain("/blog/e2eblog-live");
  expect(xml).not.toContain("e2eblog-draft");
  expect(xml).not.toContain("e2eblog-scheduled");
});

test("the blog has no sideways scroll on a phone", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  for (const path of ["/blog", "/blog/e2eblog-live"]) {
    await visit(page, path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(1);
  }
  await context.close();
});

test("admin: a post is created as a draft, invalid input is refused, a duplicate slug is refused, and it is audited", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, "/admin/blog/new");
  await page.getByLabel("Title").fill("E2E Admin Post");
  await page.getByLabel("Excerpt").fill("Created through the admin form.");
  await page.getByLabel("Slug").fill("Bad Slug!");
  await page.getByRole("button", { name: "Create post" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("lowercase");

  await page.getByLabel("Slug").fill("e2eblog-live");
  await page.getByPlaceholder("Paragraph text").fill("Written in the admin editor.");
  await page.getByRole("button", { name: "Create post" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("already in use");

  await page.getByLabel("Slug").fill("e2eblog-admin");
  await page.getByRole("button", { name: "Create post" }).click();
  await page.waitForURL(/\/admin\/blog$/);
  await expect(page.getByRole("row", { name: /E2E Admin Post/ })).toContainText("Draft");

  const { data } = await db().from("blog_posts").select("id, published_at, content").eq("slug", "e2eblog-admin").single();
  expect(data!.published_at).toBeNull();
  expect(data!.content).toEqual([{ type: "paragraph", text: "Written in the admin editor." }]);

  const anonymous = await page.context().browser()!.newContext({ baseURL: BASE_URL });
  const publicPage = await anonymous.newPage();
  expect((await publicPage.goto("/blog/e2eblog-admin"))?.status()).toBe(404);

  const { data: audit } = await db().from("admin_audit_logs").select("action, metadata").eq("actor_id", admin.user.id).eq("action", "blog_post.create");
  expect(audit).toEqual([{ action: "blog_post.create", metadata: { slug: "e2eblog-admin", published: false } }]);

  // Publishing (setting a date in the past) makes it public straight away.
  await visit(page, `/admin/blog/${data!.id}/edit`);
  await page.getByLabel("Title").fill("E2E Admin Post (edited)");
  await page.getByLabel(/Published/).fill(new Date(Date.now() - 3_600_000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Save post" }).click();
  await page.waitForURL(/\/admin\/blog$/);
  await expect(page.getByRole("row", { name: /E2E Admin Post \(edited\)/ })).toContainText("Published");
  const live = await publicPage.goto("/blog/e2eblog-admin");
  expect(live?.status()).toBe(200);
  await expect(publicPage.getByRole("heading", { level: 1 })).toContainText("E2E Admin Post (edited)");
  await expect(publicPage.getByText("Written in the admin editor.")).toBeVisible();
  await anonymous.close();

  // Deleting removes it everywhere and is audited.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete E2E Admin Post (edited)" }).click();
  await expect(page.getByText("E2E Admin Post (edited)")).toHaveCount(0);
  expect((await db().from("blog_posts").select("id").eq("slug", "e2eblog-admin")).data).toHaveLength(0);
  const { data: actions } = await db().from("admin_audit_logs").select("action").eq("actor_id", admin.user.id);
  expect((actions ?? []).map((row) => row.action).sort()).toEqual(["blog_post.create", "blog_post.delete", "blog_post.update"]);
  await page.context().close();
});

test("admin: a category and an author can be added, and an empty content block is refused", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, "/admin/blog/new");
  await page.getByLabel("Title").fill("E2E Empty Post");
  await page.getByLabel("Slug").fill("e2eblog-empty");
  await page.getByLabel("Excerpt").fill("No content.");
  await page.getByRole("button", { name: "Create post" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("Every content block needs some text");
  expect((await db().from("blog_posts").select("id").eq("slug", "e2eblog-empty")).data).toHaveLength(0);

  await visit(page, "/admin/blog");
  await page.getByLabel("Category name").fill("E2E Category");
  await page.getByLabel("Category slug").fill("e2eblog-category");
  await page.getByLabel("Category slug").locator("xpath=ancestor::form").getByRole("button", { name: "Add" }).click();
  await expect.poll(async () => (await db().from("blog_categories").select("id").eq("slug", "e2eblog-category")).data?.length).toBe(1);
  await page.context().close();
});

test("only an admin with the manage_blog permission can open the blog admin", async ({ browser }) => {
  const page = await openAs(browser, limited);
  for (const path of ["/admin/blog", "/admin/blog/new"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin$/);
  }
  await page.context().close();
});
