import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";

// Newsletter double opt-in: a signup is pending until the address's owner opens the emailed link. The email itself cannot be read here
// (only its token's hash is stored, by design), so each case plants a row with a token of the test's own and opens that link.

test.describe.configure({ mode: "serial" });

const db = () => getAdminClient();
const RUN = `e2enl${Date.now().toString(36)}`;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

async function plant(name: string, over: Record<string, unknown>) {
  const token = `${RUN}-${name}-token`;
  const email = `${RUN}-${name}@example.com`;
  const { error } = await db().from("newsletter_subscribers").insert({ email, consent_source: "newsletter_page", status: "pending", confirm_token_hash: hash(token), confirmation_sent_at: hoursAgo(1), ...over });
  if (error) throw new Error(error.message);
  return { token, email };
}
const row = async (email: string) => (await db().from("newsletter_subscribers").select("status, confirmed_at, unsubscribed_at").eq("email", email).single()).data!;

test.afterAll(async () => {
  await db().from("newsletter_subscribers").delete().like("email", `${RUN}%`);
});

test("opening the emailed link confirms the subscription, and opening it again is harmless", async ({ page }) => {
  const { token, email } = await plant("ok", {});
  expect(await row(email)).toMatchObject({ status: "pending", confirmed_at: null });
  await page.goto(`/newsletter/confirm/${token}`);
  await expect(page.getByRole("heading", { name: "You're subscribed" })).toBeVisible();
  expect(await row(email)).toMatchObject({ status: "subscribed" });
  expect((await row(email)).confirmed_at).not.toBeNull();

  await page.goto(`/newsletter/confirm/${token}`);
  await expect(page.getByRole("heading", { name: "You're already subscribed" })).toBeVisible();
  expect(await row(email)).toMatchObject({ status: "subscribed" });
});

test("an expired link does not subscribe anyone and offers to start again", async ({ page }) => {
  const { token, email } = await plant("old", { confirmation_sent_at: hoursAgo(24 * 5) });
  await page.goto(`/newsletter/confirm/${token}`);
  await expect(page.getByRole("heading", { name: "That link has expired" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Subscribe again" })).toHaveAttribute("href", "/newsletter");
  expect(await row(email)).toMatchObject({ status: "pending", confirmed_at: null });
});

test("an unknown token is refused and the page never says whether an address exists", async ({ page }) => {
  await page.goto(`/newsletter/confirm/${RUN}-not-a-real-token`);
  await expect(page.getByRole("heading", { name: "That link isn't valid" })).toBeVisible();
});

test("someone who has since unsubscribed is not re-subscribed by an old link", async ({ page }) => {
  const { token, email } = await plant("gone", { status: "unsubscribed", unsubscribed_at: hoursAgo(1) });
  await page.goto(`/newsletter/confirm/${token}`);
  await expect(page.getByRole("heading", { name: "That link isn't valid" })).toBeVisible();
  expect(await row(email)).toMatchObject({ status: "unsubscribed" });
});

test("the unsubscribe link still works, including for a pending signup", async ({ page }) => {
  const { email } = await plant("unsub", {});
  const { data } = await db().from("newsletter_subscribers").select("unsubscribe_token").eq("email", email).single();
  await page.goto(`/newsletter/unsubscribe/${data!.unsubscribe_token}`);
  await expect(page.getByRole("heading", { name: "You're unsubscribed" })).toBeVisible();
  expect(await row(email)).toMatchObject({ status: "unsubscribed" });
});

test("the raw token is never stored, and the confirm page is not indexed", async ({ page }) => {
  const { token, email } = await plant("hash", {});
  const { data } = await db().from("newsletter_subscribers").select("*").eq("email", email).single();
  expect(JSON.stringify(data)).not.toContain(token);
  await page.goto(`/newsletter/confirm/${token}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
