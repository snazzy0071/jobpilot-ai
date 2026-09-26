import { type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "./admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "./test-user";
import { makeSuperAdmin, markOnboarded } from "./roles";
import { dismissCookieBanner } from "./cv-fixture";

// One sign-in per account per spec (sign-in is rate limited per IP), reused through saved storage state. Used by the admin-area specs.

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export type AdminSession = { user: IsolatedUser; state: unknown };

export async function signInState(browser: Browser, user: IsolatedUser, landing: RegExp): Promise<unknown> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto("/login");
  await dismissCookieBanner(page);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing, { timeout: 45_000 });
  const state = await context.storageState();
  await context.close();
  return state;
}

/** A page signed in from a saved session, at desktop width unless told otherwise. */
export async function openAs(browser: Browser, session: AdminSession, viewport = { width: 1360, height: 900 }): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, storageState: session.state as never, viewport });
  return context.newPage();
}

export async function createSuperAdmin(browser: Browser, name = "E2E Super Admin"): Promise<AdminSession> {
  const user = await createIsolatedUser({ fullName: name });
  await makeSuperAdmin(user.id);
  return { user, state: await signInState(browser, user, /\/admin$/) };
}

/** An admin whose only permission is the one given (so anything else must send them back to /admin). Returns the role slug for cleanup. */
export async function createLimitedAdmin(browser: Browser, permission: string, slug: string): Promise<AdminSession> {
  const db = getAdminClient();
  const user = await createIsolatedUser({ fullName: "E2E Limited Admin" });
  await markOnboarded(user.id);
  await db.from("profiles").update({ role: "admin" }).eq("id", user.id);
  const { data: role, error } = await db.from("admin_roles").insert({ slug, name: `E2E ${slug}`, permissions: [permission] }).select("id").single();
  if (error || !role) throw new Error(`createLimitedAdmin: ${error?.message}`);
  await db.from("admin_user_roles").insert({ user_id: user.id, admin_role_id: role.id });
  return { user, state: await signInState(browser, user, /\/admin$/) };
}

export async function removeAdminSession(session: AdminSession | undefined, roleSlug?: string): Promise<void> {
  const db = getAdminClient();
  if (session) {
    await db.from("admin_audit_logs").delete().eq("actor_id", session.user.id);
    await deleteIsolatedUser(session.user.id);
  }
  if (roleSlug) await db.from("admin_roles").delete().eq("slug", roleSlug);
}
