import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { makeSuperAdmin, markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner } from "../support/cv-fixture";

// Institutions, end to end against the REAL database: licences, seats, access codes, invites, domains, members, the institution_admin
// role, co-branding, seat enforcement, licence expiry, aggregate analytics, tenant RLS, and that an institution admin can never reach a
// student's private CVs, interviews, cover letters or notes. Serial: later steps build on earlier ones. Every row belongs to the
// throwaway institutions/users created here and is deleted afterwards (institutions cascade to licences, members, invites, domains).

test.describe.configure({ mode: "serial" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const RUN = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const PRIVATE_CV = `PRIVATE-CV-${RUN}`;
const PRIVATE_NOTE = `PRIVATE-NOTE-${RUN}`;
const PRIVATE_LETTER_COMPANY = `PRIVATE-LETTER-${RUN}`;
const DOMAIN = `e2e-uni-${RUN}.ac.uk`;

type Inst = { id: string; licenceId: string };
const users: IsolatedUser[] = [];
const institutions: string[] = [];
const codes: string[] = [];
const domains: string[] = [];
let X: Inst;
let Y: Inst;
let Z: Inst;
let adminX: IsolatedUser;
let members: IsolatedUser[] = [];
let adminY: IsolatedUser;
let memberY: IsolatedUser;
let stranger: IsolatedUser;
let planIds: Record<string, string> = {};

async function user(name: string, onboarded = true): Promise<IsolatedUser> {
  const u = await createIsolatedUser({ fullName: name });
  if (onboarded) await markOnboarded(u.id);
  users.push(u);
  return u;
}

async function institution(name: string, seats: number, plan: "premium" | "pro" = "premium", licence: { startsAt?: string; expiresAt?: string | null } = {}): Promise<Inst> {
  const { data: inst, error } = await db().from("institutions").insert({ name, slug: `e2e-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${RUN}` }).select("id").single();
  if (error) throw new Error(error.message);
  institutions.push(inst!.id);
  const { data: lic, error: licError } = await db()
    .from("institution_licences")
    .insert({ institution_id: inst!.id, plan_id: planIds[plan], seat_count: seats, starts_at: licence.startsAt ?? new Date(Date.now() - 86_400_000).toISOString(), expires_at: licence.expiresAt ?? null })
    .select("id")
    .single();
  if (licError) throw new Error(licError.message);
  return { id: inst!.id, licenceId: lic!.id };
}

async function join(inst: Inst, u: IsolatedUser, role: "admin" | "member") {
  const { error } = await db().from("institution_members").insert({ institution_id: inst.id, user_id: u.id, role });
  if (error) throw new Error(`join: ${error.message}`);
}

/** A client signed in as this user with the public anon key — exactly what a browser (or anyone holding their session) could do through the API. */
async function asUser(u: IsolatedUser): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: u.email, password: u.password });
  if (error) throw new Error(`asUser: ${error.message}`);
  return client;
}

// Sign-in is rate limited per IP, so each account signs in once and its session is reused.
const sessions = new Map<string, unknown>();

async function loginPage(browser: Browser, u: IsolatedUser, expectUrl: RegExp): Promise<Page> {
  const saved = sessions.get(u.id);
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1360, height: 900 }, ...(saved ? { storageState: saved as never } : {}) });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  if (saved) {
    await page.goto("/");
    return page;
  }
  await page.goto("/login");
  await dismissCookieBanner(page);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(expectUrl, { timeout: 45_000 });
  sessions.set(u.id, await context.storageState());
  return page;
}

const setLicenceWindow = (inst: Inst, startsAt: string, expiresAt: string | null) => db().from("institution_licences").update({ starts_at: startsAt, expires_at: expiresAt }).eq("id", inst.licenceId);
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const profileRole = async (id: string) => (await db().from("profiles").select("role").eq("id", id).single()).data?.role;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const { data: plans } = await db().from("plans").select("id, slug");
  planIds = Object.fromEntries((plans ?? []).map((p) => [p.slug, p.id]));

  X = await institution("Institution X", 12);
  Y = await institution("Institution Y", 4);
  Z = await institution("Institution Z", 2);

  adminX = await user("Admin X");
  await join(X, adminX, "admin");
  members = [];
  for (let i = 1; i <= 5; i++) {
    const m = await user(`Member X${i}`);
    await join(X, m, "member");
    members.push(m);
  }
  adminY = await user("Admin Y");
  await join(Y, adminY, "admin");
  memberY = await user("Member Y");
  await join(Y, memberY, "member");
  stranger = await user("Stranger");

  // Private data belonging to the first student: an institution admin must never be able to read any of it.
  await seedCv(members[0].id, { title: PRIVATE_CV, fullName: "Private Person" });
  await db().from("applications").insert({ user_id: members[0].id, company_name: "Private Co", job_title: "Private Role", status: "applied", notes: PRIVATE_NOTE });
  await db().from("interview_sessions").insert({ user_id: members[0].id, role: "Private interview", status: "completed", completed_at: new Date().toISOString() });
  expect((await db().from("cover_letters").insert({ user_id: members[0].id, job_description: "private text", company_name: PRIVATE_LETTER_COMPANY, job_title: "Private letter" })).error).toBeNull();
});

test.afterAll(async () => {
  if (codes.length) await db().from("access_codes").delete().in("code", codes);
  if (domains.length) await db().from("institution_domains").delete().in("domain", domains);
  if (institutions.length) await db().from("institutions").delete().in("id", institutions);
  for (const u of users) await deleteIsolatedUser(u.id);
});

test.describe("licence and tenant isolation", () => {
  test("the institution admin sees their own licence, read-only, and only their own tenant", async ({ browser }) => {
    const page = await loginPage(browser, adminX, /\/institution-admin/);
    await page.goto("/institution-admin/licence");
    await expect(page.getByText("Premium").first()).toBeVisible();
    await expect(page.getByText("12", { exact: true })).toBeVisible();
    await expect(page.getByTestId("licence-state")).toHaveText("Active");
    await page.context().close();

    const client = await asUser(adminX);
    // Read: own tenant only.
    expect((await client.from("institution_licences").select("id").eq("institution_id", X.id)).data).toHaveLength(1);
    for (const table of ["institution_licences", "institution_invites", "institution_domains", "institution_members"]) {
      const { data } = await client.from(table).select("id").eq("institution_id", Y.id);
      expect(data, `${table} of another institution`).toHaveLength(0);
    }
    expect((await client.from("institutions").select("id").eq("id", Y.id)).data).toHaveLength(0);
    // Write: never their own licence, never another tenant.
    expect((await client.from("institution_licences").update({ seat_count: 999 }).eq("id", X.licenceId).select()).data ?? []).toHaveLength(0);
    expect((await client.from("institutions").update({ name: "Hijacked" }).eq("id", Y.id).select()).data ?? []).toHaveLength(0);
    expect((await client.from("institution_members").update({ role: "admin" }).eq("user_id", memberY.id).select()).data ?? []).toHaveLength(0);
    expect((await client.from("institution_members").delete().eq("user_id", memberY.id).select()).data ?? []).toHaveLength(0);
    expect((await client.from("institution_members").insert({ institution_id: Y.id, user_id: stranger.id, role: "member" })).error).not.toBeNull();
    // An institution admin can no longer add membership rows directly (people join by invite, code or verified domain).
    expect((await client.from("institution_members").insert({ institution_id: X.id, user_id: stranger.id, role: "member" })).error).not.toBeNull();
    // Nor rename the tenant's slug, nor reassign a membership to another user.
    expect((await client.from("institutions").update({ slug: `renamed-${RUN}` }).eq("id", X.id)).error).not.toBeNull();
    expect((await client.from("institution_members").update({ user_id: stranger.id }).eq("user_id", members[4].id)).error).not.toBeNull();
    // The analytics function is not callable by a signed-in user.
    expect((await client.rpc("get_institution_analytics", { p_institution_id: X.id })).error).not.toBeNull();
  });

  test("a student sees only their own membership row and no licence, invites or domains", async () => {
    const client = await asUser(members[1]);
    const { data } = await client.from("institution_members").select("user_id");
    expect(data).toEqual([{ user_id: members[1].id }]);
    for (const table of ["institution_licences", "institution_invites", "institution_domains"]) {
      expect((await client.from(table).select("id")).data, table).toHaveLength(0);
    }
    expect((await client.from("institution_members").insert({ institution_id: X.id, user_id: stranger.id, role: "member" })).error).not.toBeNull();
  });
});

test.describe("institution admins cannot reach students' private data", () => {
  test("no CV, cover letter, interview, application or note is readable through the admin's session or the admin pages", async ({ browser }) => {
    const client = await asUser(adminX);
    for (const table of ["cvs", "cv_versions", "cover_letters", "interview_sessions", "applications", "ats_scans", "test_sessions"]) {
      const { data, error } = await client.from(table).select("*").eq("user_id", members[0].id);
      expect(error, table).toBeNull();
      expect(data, `${table} rows of a student in their own institution`).toHaveLength(0);
    }
    // Notes and CV titles are also absent from every institution-admin page, including the member list.
    const page = await loginPage(browser, adminX, /\/institution-admin/);
    for (const path of ["/institution-admin", "/institution-admin/members", "/institution-admin/analytics", "/institution-admin/seats", "/institution-admin/invites"]) {
      await page.goto(path);
      const text = await page.locator("body").innerText();
      for (const secret of [PRIVATE_CV, PRIVATE_NOTE, PRIVATE_LETTER_COMPANY, "Private Co", "Private interview"]) expect(text, `${path} leaks ${secret}`).not.toContain(secret);
    }
    await page.context().close();
  });

  test("the student themself can still read it (the isolation is not simply broken reads)", async () => {
    const client = await asUser(members[0]);
    expect((await client.from("cvs").select("title").eq("user_id", members[0].id)).data?.[0]?.title).toBe(PRIVATE_CV);
    expect((await client.from("applications").select("notes")).data?.[0]?.notes).toBe(PRIVATE_NOTE);
  });
});

test.describe("aggregate analytics", () => {
  test("counts are real, aggregate-only, and withheld for a tiny cohort", async ({ browser }) => {
    const big = (await db().rpc("get_institution_analytics", { p_institution_id: X.id })).data;
    expect(big).toMatchObject({ studentCount: 5, activatedStudents: 1, cvsBuilt: 1, applicationsTracked: 1, interviewsCompleted: 1, atsScans: 0, suppressed: false });
    // No per-student field of any kind.
    expect(Object.keys(big).sort()).toEqual(["activatedStudents", "applicationsTracked", "atsScans", "cvsBuilt", "interviewsCompleted", "minCohort", "studentCount", "suppressed", "testSessionsCompleted"]);
    expect(JSON.stringify(big)).not.toContain(members[0].id);

    const small = (await db().rpc("get_institution_analytics", { p_institution_id: Y.id })).data;
    expect(small).toMatchObject({ studentCount: 1, suppressed: true, cvsBuilt: 0, activatedStudents: 0 });

    const page = await loginPage(browser, adminX, /\/institution-admin/);
    await page.goto("/institution-admin/analytics");
    await expect(page.getByText("Activated students")).toBeVisible();
    await expect(page.getByText("CVs built")).toBeVisible();
    await page.context().close();
  });
});

test.describe("seats, invites and licence expiry", () => {
  test("a full licence refuses new members and invites; nobody can be oversold", async () => {
    // Z has 2 seats.
    const a = await user("Z admin");
    const b = await user("Z member");
    const c = await user("Z extra");
    await join(Z, a, "admin");
    await join(Z, b, "member");
    const third = await db().from("institution_members").insert({ institution_id: Z.id, user_id: c.id, role: "member" });
    expect(third.error?.message).toContain("No seats remaining");
    const invite = await db().from("institution_invites").insert({ institution_id: Z.id, email: "extra@e2e.jobpilotai.test", token_hash: hash("t-full") });
    expect(invite.error?.message).toContain("No seats remaining");

    // Two simultaneous joins for one free seat: exactly one succeeds.
    await db().from("institution_licences").update({ seat_count: 3 }).eq("id", Z.licenceId);
    const d = await user("Z race d");
    const e = await user("Z race e");
    const results = await Promise.all([d, e].map((u) => db().from("institution_members").insert({ institution_id: Z.id, user_id: u.id, role: "member" })));
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    await db().from("institution_licences").update({ seat_count: 2 }).eq("id", Z.licenceId).then(() => undefined);
  });

  test("an invite is bound to its email, works at exactly-full capacity, and cannot be reused", async () => {
    // Fresh 2-seat institution: admin + one pending invite = full.
    const T = await institution("Institution T", 2);
    const admin = await user("T admin");
    await join(T, admin, "admin");
    const invitee = await user("T invitee");
    const wrong = await user("T wrong person");
    const token = randomBytes(24).toString("base64url");
    const { error } = await db().from("institution_invites").insert({ institution_id: T.id, email: invitee.email.toLowerCase(), token_hash: hash(token) });
    expect(error).toBeNull();
    // Full: the invite holds the last seat.
    expect((await db().from("institution_invites").insert({ institution_id: T.id, email: "another@e2e.jobpilotai.test", token_hash: hash("t-2") })).error?.message).toContain("No seats remaining");

    // Someone else holding the link can't use it.
    expect((await db().rpc("accept_institution_invite", { p_token_hash: hash(token), p_user_id: wrong.id })).data).toBeNull();
    expect((await db().from("institution_members").select("id").eq("user_id", wrong.id)).data).toHaveLength(0);

    // The invitee can, even though the institution is full (their own invite reserved the seat).
    const accepted = await db().rpc("accept_institution_invite", { p_token_hash: hash(token), p_user_id: invitee.id });
    expect(accepted.error).toBeNull();
    expect(accepted.data).toMatchObject({ institution_id: T.id, role: "member" });
    // Single use.
    expect((await db().rpc("accept_institution_invite", { p_token_hash: hash(token), p_user_id: invitee.id })).data).toBeNull();
    // An expired invite is refused too.
    const late = await user("T late");
    const lateToken = randomBytes(24).toString("base64url");
    await db().from("institution_licences").update({ seat_count: 5 }).eq("institution_id", T.id);
    await db().from("institution_invites").insert({ institution_id: T.id, email: late.email.toLowerCase(), token_hash: hash(lateToken), expires_at: ahead(1) });
    await db().from("institution_invites").update({ expires_at: ago(1) }).eq("token_hash", hash(lateToken));
    expect((await db().rpc("accept_institution_invite", { p_token_hash: hash(lateToken), p_user_id: late.id })).data).toBeNull();
  });

  test("an admin invite makes a real institution admin; demoting or removing them takes it back", async () => {
    const promoted = await user("Promoted");
    const token = randomBytes(24).toString("base64url");
    await db().from("institution_invites").insert({ institution_id: X.id, email: promoted.email.toLowerCase(), token_hash: hash(token), role: "admin" });
    const accepted = await db().rpc("accept_institution_invite", { p_token_hash: hash(token), p_user_id: promoted.id });
    expect(accepted.data).toMatchObject({ role: "admin" });
    expect(await profileRole(promoted.id)).toBe("institution_admin");

    // Role changes through the admin's own (RLS) session keep the account role in step both ways.
    const client = await asUser(adminX);
    expect((await client.from("institution_members").update({ role: "member" }).eq("user_id", promoted.id).select()).data).toHaveLength(1);
    expect(await profileRole(promoted.id)).toBe("user");
    expect((await client.from("institution_members").update({ role: "admin" }).eq("user_id", promoted.id).select()).data).toHaveLength(1);
    expect(await profileRole(promoted.id)).toBe("institution_admin");
    expect((await client.from("institution_members").delete().eq("user_id", promoted.id).select()).data).toHaveLength(1);
    expect(await profileRole(promoted.id)).toBe("user");
  });

  test("the admin manages invites in the UI: send, see the reserved seat, refuse a duplicate, revoke", async ({ browser }) => {
    const page = await loginPage(browser, adminX, /\/institution-admin/);
    await page.goto("/institution-admin/invites");
    await dismissCookieBanner(page);
    const email = `ui-invite-${RUN}@e2e.jobpilotai.test`;
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send invite", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText("Pending")).toBeVisible();

    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send invite", exact: true }).click();
    await expect(page.getByText("There's already a pending invite for that email.")).toBeVisible();

    const before = (await db().from("institution_invites").select("id").eq("institution_id", X.id).is("accepted_at", null)).data!.length;
    await row.getByRole("button", { name: "Revoke invite" }).click();
    await expect(row).toHaveCount(0);
    expect((await db().from("institution_invites").select("id").eq("institution_id", X.id).is("accepted_at", null)).data!.length).toBe(before - 1);
    // The raw token is never stored: only a hash column exists, and it is not the invite link.
    const stored = (await db().from("institution_invites").select("token_hash").eq("institution_id", X.id).limit(1)).data?.[0]?.token_hash as string | undefined;
    if (stored) expect(stored).toMatch(/^[0-9a-f]{64}$/);
    await page.context().close();
  });

  test("invite acceptance through the emailed link, and the co-branded onboarding it leads to", async ({ browser }) => {
    // Branding first, through the admin's own page (validation included).
    const adminPage = await loginPage(browser, adminX, /\/institution-admin/);
    await adminPage.goto("/institution-admin/branding");
    await dismissCookieBanner(adminPage);
    await adminPage.getByLabel("Logo URL").fill("http://insecure.example/logo.png");
    await adminPage.getByRole("button", { name: "Save branding" }).click();
    await expect(adminPage.getByText("Logo URL must start with https://")).toBeVisible();
    await adminPage.getByLabel("Logo URL").fill("");
    await adminPage.getByLabel("Accent colour", { exact: true }).fill("blue");
    await adminPage.getByRole("button", { name: "Save branding" }).click();
    await expect(adminPage.getByText("Enter a hex color like #1D4ED8")).toBeVisible();
    await adminPage.getByLabel("Accent colour", { exact: true }).fill("#1D4ED8");
    await adminPage.getByLabel("Institution name").fill(`Institution X ${RUN}`);
    await adminPage.getByLabel("Welcome message").fill(`Welcome to ${RUN} careers`);
    await adminPage.getByRole("button", { name: "Save branding" }).click();
    await expect(adminPage.getByText("Saved.")).toBeVisible();
    await adminPage.context().close();
    expect((await db().from("institutions").select("primary_color, welcome_message").eq("id", X.id).single()).data).toMatchObject({ primary_color: "#1D4ED8", welcome_message: `Welcome to ${RUN} careers` });

    // A new (not yet onboarded) student follows their invite link.
    const newbie = await user("Newbie", false);
    const token = randomBytes(24).toString("base64url");
    await db().from("institution_invites").insert({ institution_id: X.id, email: newbie.email.toLowerCase(), token_hash: hash(token) });
    const page = await loginPage(browser, newbie, /\/(onboarding|dashboard)/);
    await page.goto(`/institution-invite/${token}`);
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: "Accept invite" }).click();
    await expect(page.getByRole("link", { name: "Go to dashboard" })).toBeVisible();
    expect((await db().from("institution_members").select("institution_id, role").eq("user_id", newbie.id).single()).data).toMatchObject({ institution_id: X.id, role: "member" });

    // Co-branding: their onboarding shows their institution's name and message (and only theirs).
    await page.goto("/onboarding");
    await expect(page.getByText(`Institution X ${RUN}`)).toBeVisible();
    await expect(page.getByText(`Welcome to ${RUN} careers`)).toBeVisible();
    await page.context().close();
    const outsider = await asUser(memberY);
    expect((await outsider.from("institutions").select("name, welcome_message").eq("id", X.id)).data).toHaveLength(0);
  });

  test("licence expiry: seats stop, the page says so, members lose the licence plan, and renewing restores everything", async ({ browser }) => {
    // A student on the free plan gets the licence's Premium features while it is in force.
    const student = members[2];
    const studentPage = await loginPage(browser, student, /\/dashboard/);
    await studentPage.goto("/dashboard/auto-apply");
    await expect(studentPage.locator("#main-content").getByRole("heading", { name: "Auto-Apply", exact: true })).toBeVisible();
    await expect(studentPage.getByTestId("auto-apply-locked")).toHaveCount(0);
    expect((await db().rpc("get_institution_licence_plan", { p_user_id: student.id })).data).toMatchObject({ slug: "premium" });

    // Expire it.
    await setLicenceWindow(X, ago(30), ago(1));
    expect((await db().rpc("get_institution_licence_plan", { p_user_id: student.id })).data).toBeNull();
    await studentPage.goto("/dashboard/auto-apply");
    await expect(studentPage.getByTestId("auto-apply-locked")).toBeVisible();
    await studentPage.context().close();

    // No seat can be taken by anyone, by any route, even though seats are free on paper.
    const extra = await user("Expiry extra");
    expect((await db().from("institution_members").insert({ institution_id: X.id, user_id: extra.id, role: "member" })).error?.message).toContain("no active licence");
    expect((await db().from("institution_invites").insert({ institution_id: X.id, email: "late@e2e.jobpilotai.test", token_hash: hash("t-exp") })).error?.message).toContain("no active licence");

    const page = await loginPage(browser, adminX, /\/institution-admin/);
    await page.goto("/institution-admin");
    await expect(page.getByTestId("licence-expired")).toBeVisible();
    await page.goto("/institution-admin/licence");
    await expect(page.getByTestId("licence-state")).toHaveText("Expired");
    await page.goto("/institution-admin/seats");
    await expect(page.getByText("Your licence has expired, so no seats are available.")).toBeVisible();
    await page.goto("/institution-admin/invites");
    await dismissCookieBanner(page);
    await page.getByLabel("Email").fill(`expired-${RUN}@e2e.jobpilotai.test`);
    await page.getByRole("button", { name: "Send invite", exact: true }).click();
    await expect(page.getByText("No seats remaining on your institution's licence.")).toBeVisible();

    // A licence that has not started yet grants nothing either.
    await setLicenceWindow(X, ahead(5), ahead(60));
    expect((await db().rpc("get_institution_licence_plan", { p_user_id: student.id })).data).toBeNull();

    // Renewal restores it.
    await setLicenceWindow(X, ago(30), ahead(60));
    expect((await db().rpc("get_institution_licence_plan", { p_user_id: student.id })).data).toMatchObject({ slug: "premium" });
    await page.goto("/institution-admin/licence");
    await expect(page.getByTestId("licence-state")).toHaveText("Active");
    await page.context().close();
    await setLicenceWindow(X, ago(30), null);
  });

  test("a personal higher plan is kept; a deactivated licence grants nothing", async () => {
    const personal = members[3];
    const { error } = await db().from("subscriptions").upsert({ user_id: personal.id, plan_id: planIds.premium, status: "active" }, { onConflict: "user_id" });
    expect(error).toBeNull();
    // (Personal + licence: the higher wins, ties keep the personal plan — unit-tested in service.test.ts.)
    await db().from("institution_licences").update({ is_active: false }).eq("id", X.licenceId);
    expect((await db().rpc("get_institution_licence_plan", { p_user_id: members[2].id })).data).toBeNull();
    await db().from("institution_licences").update({ is_active: true }).eq("id", X.licenceId);
    expect((await db().rpc("get_institution_licence_plan", { p_user_id: members[2].id })).data).toMatchObject({ slug: "premium" });
  });
});

test.describe("access codes", () => {
  test("a code enrolls the redeemer, uses a seat, and a failed enrolment burns nothing", async () => {
    const code = `E2E-${RUN}-A`.toUpperCase();
    codes.push(code);
    await db().from("access_codes").insert({ code, label: "e2e", institution_id: X.id, max_redemptions: 10 });
    const redeemed = await db().rpc("redeem_access_code", { p_code: code, p_user_id: stranger.id });
    expect(redeemed.error).toBeNull();
    expect(redeemed.data).toMatchObject({ institution_id: X.id, institution_joined: true });
    expect((await db().from("institution_members").select("role").eq("user_id", stranger.id).single()).data?.role).toBe("member");
    expect((await db().from("access_codes").select("redemption_count").eq("code", code).single()).data?.redemption_count).toBe(1);
    // Access codes never confer institution-admin rights.
    expect(await profileRole(stranger.id)).toBe("user");

    // Full institution (Z has 2 seats, both taken): the redeem fails as a whole and the code is not consumed.
    const zCode = `E2E-${RUN}-Z`.toUpperCase();
    codes.push(zCode);
    await db().from("access_codes").insert({ code: zCode, label: "e2e", institution_id: Z.id, max_redemptions: 5 });
    const victim = await user("Code victim");
    const full = await db().rpc("redeem_access_code", { p_code: zCode, p_user_id: victim.id });
    expect(full.error?.message).toContain("No seats remaining");
    expect((await db().from("access_codes").select("redemption_count").eq("code", zCode).single()).data?.redemption_count).toBe(0);
    expect((await db().from("access_code_redemptions").select("id").eq("user_id", victim.id)).data).toHaveLength(0);

    // An expired code and an unknown code are both refused.
    const expired = `E2E-${RUN}-X`.toUpperCase();
    codes.push(expired);
    await db().from("access_codes").insert({ code: expired, label: "e2e", institution_id: X.id, expires_at: ago(1) });
    expect((await db().rpc("redeem_access_code", { p_code: expired, p_user_id: victim.id })).data).toBeNull();
    expect((await db().rpc("redeem_access_code", { p_code: "NOPE-NOT-A-CODE", p_user_id: victim.id })).data).toBeNull();
  });
});

test.describe("email domains", () => {
  test("a claim is unverified and inert; only JobPilot verifies; enrolment needs a confirmed address", async ({ browser }) => {
    const page = await loginPage(browser, adminX, /\/institution-admin/);
    await page.goto("/institution-admin/domains");
    await dismissCookieBanner(page);
    await page.getByLabel("Email domain").fill("gmail.com");
    await page.getByRole("button", { name: "Claim domain" }).click();
    await expect(page.getByText("Public email providers can't be claimed as an institution domain")).toBeVisible();
    await page.getByLabel("Email domain").fill(DOMAIN);
    await page.getByRole("button", { name: "Claim domain" }).click();
    domains.push(DOMAIN);
    const row = page.locator(`[data-domain="${DOMAIN}"]`);
    await expect(row).toBeVisible();
    await expect(row.getByText("Awaiting verification")).toBeVisible();
    // The same domain can't be claimed twice.
    await page.getByLabel("Email domain").fill(DOMAIN);
    await page.getByRole("button", { name: "Claim domain" }).click();
    await expect(page.getByText("That domain is already claimed.")).toBeVisible();
    await page.context().close();

    // An institution admin cannot verify their own claim, nor insert an already-verified one, nor claim on Y's behalf.
    const client = await asUser(adminX);
    expect((await client.from("institution_domains").update({ is_verified: true }).eq("domain", DOMAIN).select()).data ?? []).toHaveLength(0);
    const sneaky = await client.from("institution_domains").insert({ institution_id: X.id, domain: `sneaky-${RUN}.example`, is_verified: true });
    expect(sneaky.error).not.toBeNull();
    expect((await client.from("institution_domains").insert({ institution_id: Y.id, domain: `sneaky2-${RUN}.example` })).error).not.toBeNull();

    // A person at the domain (confirmed) is NOT enrolled by an unverified claim.
    const email = `student-${RUN}@${DOMAIN}`;
    const { data: created } = await db().auth.admin.createUser({ email, password: `Pw-${RUN}-xyz!1`, email_confirm: true });
    users.push({ id: created.user!.id, email, password: "", fullName: "Domain student" });
    expect((await db().rpc("enroll_via_verified_domain", { p_user_id: created.user!.id })).data).toMatchObject({ matched: false });
  });

  test("JobPilot verifies in the admin UI; then confirmed addresses join, unconfirmed ones do not, and it stops with the licence", async ({ browser }) => {
    const superAdmin = await user("Super admin");
    await makeSuperAdmin(superAdmin.id);
    const page = await loginPage(browser, superAdmin, /\/admin/);
    await page.goto(`/admin/institutions/${X.id}`);
    await dismissCookieBanner(page);
    const row = page.locator(`[data-domain="${DOMAIN}"]`);
    await expect(row.getByText("Unverified")).toBeVisible();
    await row.getByRole("button", { name: `Verify ${DOMAIN}` }).click();
    await expect(row.getByText("Verified", { exact: true })).toBeVisible();
    expect((await db().from("admin_audit_logs").select("action").eq("entity_id", X.id).eq("action", "institution_domain.verify")).data?.length).toBeGreaterThan(0);
    await page.context().close();

    const student = users.find((u) => u.email === `student-${RUN}@${DOMAIN}`)!;
    const joined = await db().rpc("enroll_via_verified_domain", { p_user_id: student.id });
    expect(joined.data).toMatchObject({ matched: true, institution_id: X.id, joined: true });
    expect((await db().from("institution_members").select("role").eq("user_id", student.id).single()).data?.role).toBe("member");

    // An address nobody has confirmed proves nothing: no enrolment.
    const unconfirmedEmail = `unconfirmed-${RUN}@${DOMAIN}`;
    const { data: un } = await db().auth.admin.createUser({ email: unconfirmedEmail, password: `Pw-${RUN}-xyz!2`, email_confirm: false });
    users.push({ id: un.user!.id, email: unconfirmedEmail, password: "", fullName: "Unconfirmed" });
    expect((await db().rpc("enroll_via_verified_domain", { p_user_id: un.user!.id })).data).toMatchObject({ matched: false });
    expect((await db().from("institution_members").select("id").eq("user_id", un.user!.id)).data).toHaveLength(0);

    // With the licence expired the matched student is not enrolled (no seats exist).
    await db().from("institution_members").delete().eq("user_id", student.id);
    await setLicenceWindow(X, ago(30), ago(1));
    expect((await db().rpc("enroll_via_verified_domain", { p_user_id: student.id })).error?.message).toContain("no active licence");
    await setLicenceWindow(X, ago(30), null);
  });
});

test.describe("members and the institution_admin role", () => {
  test("the roster lists names and emails only, an only-admin cannot lock themself out, and removing a member frees a seat", async ({ browser }) => {
    const page = await loginPage(browser, adminX, /\/institution-admin/);
    await page.goto("/institution-admin/members");
    await dismissCookieBanner(page);
    await expect(page.getByRole("row").filter({ hasText: members[0].email })).toBeVisible();
    // Another institution's people never appear.
    await expect(page.getByText(memberY.email)).toHaveCount(0);

    const seatsBefore = (await db().from("institution_members").select("id").eq("institution_id", X.id)).data!.length;
    await page.getByRole("row").filter({ hasText: members[4].email }).getByRole("button", { name: "Remove member" }).click();
    await expect(page.getByRole("row").filter({ hasText: members[4].email })).toHaveCount(0);
    expect((await db().from("institution_members").select("id").eq("institution_id", X.id)).data!.length).toBe(seatsBefore - 1);
    await page.context().close();

    // A plain student has no route to admin rights through the API:
    const client = await asUser(members[1]);
    expect((await client.from("institution_members").update({ role: "admin" }).eq("user_id", members[1].id).select()).data ?? []).toHaveLength(0);
    expect(await profileRole(members[1].id)).toBe("user");
  });
});
