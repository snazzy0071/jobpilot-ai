import { beforeEach, describe, expect, it, vi } from "vitest";

// signUpWithPassword remembers the graduate scheme on the account only when the form named a REAL, published one — and a normal
// signup posts nothing extra and gets nothing extra.

const signUp = vi.fn();
const findPublishedScheme = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signUp } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_SITE_URL: "https://site.test" } }));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeSignUpRateLimit: async () => true,
  consumeSignInRateLimit: async () => true,
  consumePasswordResetRateLimit: async () => true,
  consumeResendConfirmationRateLimit: async () => true,
  AUTH_RATE_LIMIT_MESSAGE: "limited",
}));
vi.mock("@/lib/admin/settings/queries", () => ({ getAppSettings: async () => ({ maintenanceMode: false }) }));
vi.mock("@/lib/graduate-schemes/signup-server", () => ({ findPublishedScheme: (slug: string | null) => findPublishedScheme(slug) }));

import { signUpWithPassword } from "@/lib/auth/actions";

function form(extra: Record<string, string> = {}) {
  const data = new FormData();
  data.set("mode", "subscribe");
  data.set("fullName", "Test Person");
  data.set("email", "person@example.com");
  data.set("password", "A-Real-Password-123!");
  data.set("dateOfBirth", "2000-01-01");
  for (const [key, value] of Object.entries(extra)) data.set(key, value);
  return data;
}

async function submit(data: FormData) {
  try {
    await signUpWithPassword(undefined, data);
  } catch (error) {
    return (error as Error).message;
  }
  return null;
}

describe("signUpWithPassword and the graduate scheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    findPublishedScheme.mockResolvedValue(null);
  });

  it("a normal signup works (Subscribe mode has no access-code field) and stores no scheme", async () => {
    expect(await submit(form())).toBe("REDIRECT:/signup/check-email?email=person%40example.com");
    const options = signUp.mock.calls[0][0].options;
    expect(options.data).toEqual({ full_name: "Test Person", date_of_birth: "2000-01-01", newsletter_opt_in: false });
    expect(options.emailRedirectTo).toBe("https://site.test/auth/confirm?next=/signup/verified"); // the confirmation link is unchanged
    expect(findPublishedScheme).toHaveBeenCalledWith(null);
  });

  it("remembers a real, published scheme on the account and leaves the confirmation link alone", async () => {
    findPublishedScheme.mockResolvedValue({ slug: "acme-grad" });
    expect(await submit(form({ from: "grad", scheme: "acme-grad" }))).toMatch(/^REDIRECT:\/signup\/check-email/);
    expect(findPublishedScheme).toHaveBeenCalledWith("acme-grad");
    const options = signUp.mock.calls[0][0].options;
    expect(options.data.grad_scheme_slug).toBe("acme-grad");
    expect(options.emailRedirectTo).toBe("https://site.test/auth/confirm?next=/signup/verified");
  });

  it("ignores a scheme that isn't published or doesn't exist — the signup still succeeds", async () => {
    findPublishedScheme.mockResolvedValue(null);
    expect(await submit(form({ from: "grad", scheme: "gone" }))).toMatch(/^REDIRECT:\/signup\/check-email/);
    expect(signUp.mock.calls[0][0].options.data).not.toHaveProperty("grad_scheme_slug");
  });

  it("only looks at the scheme when the form says from=grad, and only ever passes a valid slug on", async () => {
    await submit(form({ scheme: "acme-grad" }));
    expect(findPublishedScheme).toHaveBeenLastCalledWith(null);
    await submit(form({ from: "grad", scheme: "../admin" }));
    expect(findPublishedScheme).toHaveBeenLastCalledWith(null);
    await submit(form({ from: "grad", scheme: "<script>" }));
    expect(findPublishedScheme).toHaveBeenLastCalledWith(null);
  });

  it("does not remember the scheme when the account couldn't be created", async () => {
    findPublishedScheme.mockResolvedValue({ slug: "acme-grad" });
    signUp.mockResolvedValue({ data: {}, error: { message: "nope" } });
    const result = await signUpWithPassword(undefined, form({ from: "grad", scheme: "acme-grad" }));
    expect(result).toEqual({ error: "nope" });
  });
});
