import { test, expect as baseExpect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { deleteIsolatedUserByEmail, uniqueEmail } from "../support/test-user";
import { selectOption } from "../fixtures";

// Scheme-specific signup (/signup?from=grad&scheme=<slug>) against the REAL database: the selected scheme is shown, survives
// email confirmation and onboarding, and ends in that scheme's preparation flow — while a normal /signup is untouched. Email
// confirmation is done through the admin API (this sandbox has no inbox), the same way the confirmation link would.
// Schemes are created here (employer "E2ESU…", slug "e2esu-…") and deleted afterwards.

test.describe.configure({ mode: "serial" });
const expect = baseExpect.configure({ timeout: 30_000 });
test.beforeEach(() => {
  test.setTimeout(240_000);
});

const db = () => getAdminClient();
const SLUG = "e2esu-programme";
const PREPARE = `/dashboard/graduate-schemes/${SLUG}/prepare`;
const PASSWORD = "A-Real-Password-123!";
const created: string[] = [];

function ukToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

async function cleanup() {
  await db().from("graduate_schemes").delete().like("slug", "e2esu-%");
  for (const email of created.splice(0)) await deleteIsolatedUserByEmail(email);
}

async function warmAndResetLimits() {
  // Sign-up is limited to 5 per hour per IP; earlier runs may have used it up.
  await db().from("anonymous_rate_limits").delete().eq("scope", "auth_sign_up");
}

test.beforeAll(async () => {
  await cleanup();
  await warmAndResetLimits();
  const { data, error } = await db().from("graduate_schemes").insert([
    {
      slug: SLUG, employer: "E2ESU Employer", scheme_name: "Signup Programme", sector: "technology", sponsorship_status: "sponsors", deadline_on: ukToday(12), opens_on: ukToday(-3),
      is_rolling: false, is_published: true, study_stages: [], locations: [], source_url: "https://example.com/e2esu", source_date: ukToday(-30), verified_at: ukToday(-2),
    },
    {
      slug: "e2esu-draft", employer: "E2ESU Draft", scheme_name: "Hidden Programme", sector: "other", sponsorship_status: "not_published", is_rolling: false, is_published: false,
      study_stages: [], locations: [], source_url: "https://example.com/e2esu", source_date: ukToday(-30), verified_at: ukToday(-2),
    },
  ]).select("id, slug");
  if (error) throw new Error(error.message);
  const id = data!.find((row) => row.slug === SLUG)!.id;
  const ev = { source_url: "https://example.com/e2esu-sel", source_date: ukToday(-30), verified_at: ukToday(-2), is_required: true, display_order: 0, label: null, provider: null, notes: null };
  const { error: mapError } = await db().from("graduate_scheme_assessments").insert([
    { scheme_id: id, assessment_type: "numerical", ...ev, display_order: 1 },
    { scheme_id: id, assessment_type: "watson_glaser", ...ev, display_order: 2 },
    { scheme_id: id, assessment_type: "sjt", ...ev, is_required: false, display_order: 3 },
  ]);
  if (mapError) throw new Error(mapError.message);
  for (const path of [`/signup?from=grad&scheme=${SLUG}`, "/signup", "/signup/verified", PREPARE]) await fetch(`${process.env.E2E_BASE_URL ?? "http://localhost:3000"}${path}`, { redirect: "manual" }).catch(() => undefined);
});

test.afterAll(cleanup);

/**
 * Creates the account the signup form would have created. The form itself can't complete here: Supabase's built-in mailer is
 * limited to a few emails an hour (and refuses the e2e domain), so a real `auth.signUp` isn't repeatable in this environment.
 * The account gets the same metadata the signup action stores (covered by src/lib/auth/scheme-signup-action.test.ts); everything
 * after it — email confirmation, the verified page, onboarding and the hand-off — is exercised for real.
 */
async function makeAccount(name: string, scheme: string | null): Promise<string> {
  const email = uniqueEmail();
  created.push(email);
  const { data, error } = await db().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: false,
    user_metadata: { full_name: name, date_of_birth: "2000-01-01", ...(scheme ? { grad_scheme_slug: scheme } : {}) },
  });
  if (error || !data.user) throw new Error(`couldn't create the account: ${error?.message}`);
  return email;
}

async function confirmEmail(page: Page, email: string) {
  const { data, error } = await db().auth.admin.generateLink({ type: "magiclink", email });
  if (!data?.properties) throw new Error(`no link: ${error?.message}`);
  expect(error).toBeNull();
  await page.goto(`/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink&next=/signup/verified`);
}

async function metadataFor(email: string): Promise<Record<string, unknown> | undefined> {
  const { data } = await db().auth.admin.listUsers({ page: 1, perPage: 200 });
  return data?.users.find((user) => user.email === email)?.user_metadata;
}

async function finishOnboarding(page: Page) {
  await page.waitForURL(/\/onboarding\/about/);
  await selectOption(page, "Career stage", "Recently graduated");
  await selectOption(page, "What's your main goal right now?", "Land my first role");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/onboarding\/targets/);
  await page.getByLabel("Target roles").fill("Software Engineer");
  await page.getByRole("checkbox", { name: "Technology" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/onboarding\/logistics/);
  await page.getByLabel("Location").fill("London");
  await page.getByLabel("Graduation year").fill("2024");
  await selectOption(page, "Right to work / sponsorship", "I already have the right to work");
}

test.describe("the signup page", () => {
  test("shows the selected scheme: employer, programme, deadline, sponsorship and required assessments", async ({ page }) => {
    await page.goto(`/signup?from=grad&scheme=${SLUG}`);
    const context = page.getByTestId("scheme-signup-context");
    await expect(context).toBeVisible();
    await expect(context.getByTestId("ctx-programme")).toHaveText("Signup Programme");
    await expect(context.getByTestId("ctx-employer")).toContainText("E2ESU Employer");
    await expect(context.getByTestId("ctx-employer")).toContainText("Technology");
    const closes = new Date(`${ukToday(12)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    await expect(context.getByTestId("ctx-deadline")).toContainText(`Deadline ${closes}`);
    await expect(context.getByTestId("ctx-deadline")).toContainText("Closes in 12 days");
    await expect(context.getByTestId("ctx-sponsorship")).toContainText("Visa sponsorship: Sponsors");
    // required assessments only (the SJT is "may be used")
    await expect(context.getByTestId("ctx-assessments")).toContainText("Numerical reasoning test, Watson-Glaser-style critical thinking test");
    await expect(context.getByTestId("ctx-assessments")).not.toContainText("situational");
    // It's still the ordinary signup form, plus the scheme carried in hidden fields; existing accounts can sign in and continue.
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await expect(page.locator('input[name="from"]')).toHaveValue("grad");
    await expect(page.locator('input[name="scheme"]')).toHaveValue(SLUG);
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", `/login?redirect=${encodeURIComponent(PREPARE)}`);
  });

  test("a normal /signup is unchanged — and so is one whose parameters name nothing real", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByTestId("scheme-signup-context")).toHaveCount(0);
    await expect(page.locator('input[name="from"]')).toHaveCount(0);
    await expect(page.locator('input[name="scheme"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    // What a person (and the browser) gets from the card: its text, its controls and its links. (Generated element ids and the
    // decorative animation styles are not compared.)
    const snapshot = () =>
      page.locator('[data-slot="card"]').first().evaluate((card) => ({
        text: (card as HTMLElement).innerText,
        controls: [...card.querySelectorAll("input, button, select, textarea")].map((el) => [el.tagName, el.getAttribute("name"), el.getAttribute("type"), el.textContent?.trim()]),
        links: [...card.querySelectorAll("a")].map((a) => [a.textContent?.trim(), a.getAttribute("href")]),
      }));
    const plain = await snapshot();

    // Each of these must render exactly the same page as plain /signup.
    for (const query of [
      "?from=grad&scheme=no-such-scheme",
      "?from=grad&scheme=e2esu-draft", // a draft is not a scheme anyone can sign up for
      `?scheme=${SLUG}`, // without from=grad
      `?from=other&scheme=${SLUG}`,
      "?from=grad",
      "?from=grad&scheme=..%2F..%2Fadmin",
      "?from=grad&scheme=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    ]) {
      await page.goto(`/signup${query}`);
      await expect(page.getByTestId("scheme-signup-context"), query).toHaveCount(0);
      await expect(page.locator('input[name="scheme"]'), query).toHaveCount(0);
      expect(await snapshot(), query).toEqual(plain);
    }
    await expect(page.getByRole("heading", { name: "Create your account" }).first()).toBeAttached();
  });

  test("OAuth sign-up carries the scheme through the provider round trip", async ({ page }) => {
    await page.goto(`/signup?from=grad&scheme=${SLUG}`);
    const authorize = page.waitForRequest((request) => request.url().includes("/auth/v1/authorize"));
    await page.getByRole("button", { name: "Google" }).click();
    const url = new URL((await authorize).url());
    const back = new URL(url.searchParams.get("redirect_to")!);
    expect(back.pathname).toBe("/auth/callback");
    expect(back.searchParams.get("scheme")).toBe(SLUG);
    expect(back.searchParams.get("from")).toBe("grad");
    expect(back.searchParams.get("next")).toBe(PREPARE);
  });

  test("works at phone width with no horizontal scroll", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", viewport: { width: 375, height: 760 } });
    const page = await context.newPage();
    try {
      await page.goto(`/signup?from=grad&scheme=${SLUG}`);
      await expect(page.getByTestId("scheme-signup-context")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });
});

test.describe("the signup form", () => {
  test("submits the scheme with the form when one is selected, and nothing extra for a normal signup", async ({ page }) => {
    // The fields the form would send to the signup action, for both variants.
    const fields = async (url: string) => {
      await page.goto(url);
      return page.locator("form").evaluate((form) => Object.fromEntries([...new FormData(form as HTMLFormElement).entries()].map(([key, value]) => [key, String(value)])));
    };
    const withScheme = await fields(`/signup?from=grad&scheme=${SLUG}`);
    expect(withScheme).toMatchObject({ from: "grad", scheme: SLUG, mode: "subscribe" });
    const plain = await fields("/signup");
    expect(Object.keys(plain).sort()).toEqual(Object.keys(withScheme).filter((key) => key !== "from" && key !== "scheme").sort());
  });
});

test.describe("from signup to the preparation flow", () => {
  test("signup -> confirm email -> onboarding -> the scheme's preparation flow, with the scheme kept in view throughout", async ({ page }) => {
    const email = await makeAccount("Scheme Signup Tester", SLUG);
    // The scheme is on the account itself, so it survives confirming the email on another device.
    expect((await metadataFor(email))?.grad_scheme_slug).toBe(SLUG);

    // Confirming the email (via the same route the emailed link uses) -> "verified", with the scheme and a way on.
    await confirmEmail(page, email);
    await expect(page).toHaveURL(/\/signup\/verified/);
    await expect(page.getByTestId("scheme-signup-context")).toContainText("Signup Programme");
    const next = page.getByRole("link", { name: "Continue to prepare for E2ESU Employer" });
    await expect(next).toHaveAttribute("href", PREPARE);
    await next.click();

    // A new account must finish onboarding first; the scheme is still shown there.
    await page.waitForURL(/\/onboarding\/about/);
    const banner = page.getByTestId("scheme-signup-context");
    await expect(banner).toContainText("After this, you'll prepare for");
    await expect(banner.getByTestId("ctx-programme")).toHaveText("Signup Programme");
    await expect(banner.getByTestId("ctx-sponsorship")).toContainText("Sponsors");
    await finishOnboarding(page);
    await expect(page.getByTestId("scheme-signup-context")).toBeVisible(); // still there on the last step
    await page.getByRole("button", { name: "Finish" }).click();

    // ...and finishing lands in that scheme's preparation flow, not the plain dashboard.
    await page.waitForURL(new RegExp(`${PREPARE}$`));
    await expect(page.getByRole("heading", { name: /Prepare your application/ })).toContainText("Signup Programme");
    await expect(page.getByTestId("step-scheme")).toBeVisible();
    await expect(page.getByTestId("required-assessments")).toContainText("Numerical reasoning test");

    // The remembered scheme steers this one arrival only: it is cleared, and the dashboard is the dashboard again.
    expect((await metadataFor(email))?.grad_scheme_slug ?? null).toBeNull();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("scheme-signup-context")).toHaveCount(0);
  });

  test("skipping onboarding also continues into the scheme's preparation flow", async ({ page }) => {
    const email = await makeAccount("Scheme Skip Tester", SLUG);
    await confirmEmail(page, email);
    await page.goto("/dashboard"); // bounced to onboarding
    await page.waitForURL(/\/onboarding\/about/);
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL(new RegExp(`${PREPARE}$`));
    await expect(page.getByRole("heading", { name: /Prepare your application/ })).toContainText("Signup Programme");
  });

  test("a normal signup is unchanged end to end: nothing remembered, the dashboard after onboarding", async ({ page }) => {
    const email = await makeAccount("Plain Signup Tester", null);
    expect((await metadataFor(email))?.grad_scheme_slug).toBeUndefined();
    await confirmEmail(page, email);
    await expect(page.getByTestId("scheme-signup-context")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Continue to dashboard" })).toHaveAttribute("href", "/dashboard");
    await page.getByRole("link", { name: "Continue to dashboard" }).click();
    await page.waitForURL(/\/onboarding\/about/);
    await expect(page.getByTestId("scheme-signup-context")).toHaveCount(0);
    await finishOnboarding(page);
    await page.getByRole("button", { name: "Finish" }).click();
    await page.waitForURL(/\/dashboard(?!\/)/);
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("a scheme that is unpublished before onboarding finishes falls back to the dashboard (no dead end)", async ({ page }) => {
    const email = await makeAccount("Scheme Gone Tester", SLUG);
    await confirmEmail(page, email);
    await page.goto("/dashboard");
    await page.waitForURL(/\/onboarding\/about/);

    await db().from("graduate_schemes").update({ is_published: false }).eq("slug", SLUG);
    try {
      await page.reload();
      await expect(page.getByTestId("scheme-signup-context")).toHaveCount(0);
      await page.getByRole("button", { name: "Skip for now" }).click();
      await page.waitForURL(/\/dashboard(?!\/)/);
      await expect(page).toHaveURL(/\/dashboard$/);
    } finally {
      await db().from("graduate_schemes").update({ is_published: true }).eq("slug", SLUG);
    }
  });
});
