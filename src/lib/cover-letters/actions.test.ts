import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/cvs/queries", () => ({ getCvEditorData: vi.fn() }));
vi.mock("@/lib/ai/gateway", () => ({ generateTextGated: vi.fn(), generateStructuredGated: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
// revalidatePath needs a real Next.js request-rendering context
// (App Router's static-generation store) that plain Vitest has no
// reason to provide — a no-op here, same as every other Next-runtime-
// only API this session's integration tests stub out.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const CV_ID = "11111111-1111-1111-8111-111111111111";

const NON_EMPTY_CV = {
  versionId: "version-1",
  personal: { id: "p1", fullName: "Jane Doe", headline: null, email: null, phone: null, location: null, websiteUrl: null, linkedinUrl: null, portfolioUrl: null },
  summary: { id: "s1", content: "Experienced engineer." },
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  customSections: [],
  sectionOrder: [],
};

const EMPTY_CV = { ...NON_EMPTY_CV, personal: null, summary: null };

function generateForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("cvId", CV_ID);
  form.set("companyName", "Acme Ltd");
  form.set("jobTitle", "Software Engineer");
  form.set("jobDescription", "We are hiring a software engineer to build and maintain our platform.");
  form.set("tone", "formal");
  form.set("length", "standard");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

/** Tracks inserts across the 3-table sequence (cover_letters -> cover_letter_versions -> cover_letter_paragraphs) and any cleanup deletes, so a test can assert on the real multi-step orchestration, not just the final return value. */
function stubSupabase(log: { table: string; op: "insert" | "delete"; payload?: unknown }[], options: { failAt?: string } = {}) {
  function builderFor(table: string) {
    const builder: Record<string, (...args: never[]) => unknown> = {};
    builder.insert = (payload: unknown) => {
      log.push({ table, op: "insert", payload });
      return builder;
    };
    builder.delete = () => {
      log.push({ table, op: "delete" });
      return builder;
    };
    builder.eq = () => builder;
    builder.select = () => builder;
    builder.single = () => {
      if (options.failAt === table) return Promise.resolve({ data: null, error: { message: "insert failed" } });
      const lastInsert = [...log].reverse().find((entry) => entry.table === table && entry.op === "insert");
      const row = Array.isArray(lastInsert?.payload) ? {} : (lastInsert?.payload as Record<string, unknown>) ?? {};
      return Promise.resolve({ data: { id: `${table}-1`, ...row }, error: null });
    };
    builder.then = (onFulfilled: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(onFulfilled);
    return builder;
  }
  return { from: (table: string) => builderFor(table) };
}

describe("generateCoverLetter", () => {
  beforeEach(() => vi.clearAllMocks());

  async function setup(cv: unknown = NON_EMPTY_CV) {
    const { requireUser } = await import("@/lib/auth/session");
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-1" });
    const { getCvEditorData } = await import("@/lib/cvs/queries");
    (getCvEditorData as ReturnType<typeof vi.fn>).mockResolvedValue(cv);
  }

  it("splits the model's blank-line-separated draft into individually stored paragraphs", async () => {
    await setup();
    const { generateTextGated } = await import("@/lib/ai/gateway");
    // Three real blank-line-separated paragraphs (coverLetterPrompt's own
    // opening/body/closing structure) — each paragraph is internally a
    // single line here specifically so the split points are
    // unambiguous; splitIntoParagraphs's regex (/\n\s*\n/) treats *any*
    // run of blank lines as one break, so a paragraph with its own
    // internal blank line would itself split further, which isn't what
    // this test is checking.
    (generateTextGated as ReturnType<typeof vi.fn>).mockResolvedValue(
      "Dear Hiring Manager,\n\nI am writing to apply for this role, and my experience aligns well with your needs.\n\nSincerely,\nJane",
    );
    const log: { table: string; op: "insert" | "delete"; payload?: unknown }[] = [];
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(stubSupabase(log));

    const { generateCoverLetter } = await import("@/lib/cover-letters/actions");
    const result = await generateCoverLetter(generateForm());

    expect(result).toEqual({ coverLetterId: "cover_letters-1" });
    const paragraphsInsert = log.find((entry) => entry.table === "cover_letter_paragraphs");
    const paragraphs = paragraphsInsert?.payload as { content: string; display_order: number }[];
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]).toMatchObject({ content: "Dear Hiring Manager,", display_order: 0 });
    expect(paragraphs[1]).toMatchObject({
      content: "I am writing to apply for this role, and my experience aligns well with your needs.",
      display_order: 1,
    });
    expect(paragraphs[2]).toMatchObject({ content: "Sincerely,\nJane", display_order: 2 });
  });

  it("rejects an empty CV before ever calling the AI", async () => {
    await setup(EMPTY_CV);
    const { generateTextGated } = await import("@/lib/ai/gateway");

    const { generateCoverLetter } = await import("@/lib/cover-letters/actions");
    const result = await generateCoverLetter(generateForm());

    expect(result).toEqual({ error: "That CV has no content yet — add some before generating a cover letter." });
    expect(generateTextGated).not.toHaveBeenCalled();
  });

  it("returns a not-found error when the CV doesn't belong to this user", async () => {
    await setup(null);
    const { generateCoverLetter } = await import("@/lib/cover-letters/actions");
    const result = await generateCoverLetter(generateForm());
    expect(result).toEqual({ error: "That CV couldn't be found." });
  });

  it("surfaces a real EntitlementError as-is (e.g. Free plan lacking cover_letter_generator)", async () => {
    await setup();
    const { generateTextGated } = await import("@/lib/ai/gateway");
    const { EntitlementError } = await import("@/lib/entitlements/service");
    (generateTextGated as ReturnType<typeof vi.fn>).mockRejectedValue(
      new EntitlementError("This feature isn't included in your current plan."),
    );

    const { generateCoverLetter } = await import("@/lib/cover-letters/actions");
    const result = await generateCoverLetter(generateForm());
    expect(result).toEqual({ error: "This feature isn't included in your current plan." });
  });

  it("rejects a job description shorter than the real minimum, without ever calling the AI", async () => {
    await setup();
    const { generateTextGated } = await import("@/lib/ai/gateway");

    const { generateCoverLetter } = await import("@/lib/cover-letters/actions");
    const result = await generateCoverLetter(generateForm({ jobDescription: "Too short." }));

    expect(result).toEqual({ error: "Paste the full job description first." });
    expect(generateTextGated).not.toHaveBeenCalled();
  });

  it("errors gracefully when the model returns only blank content, with no paragraphs to save", async () => {
    await setup();
    const { generateTextGated } = await import("@/lib/ai/gateway");
    (generateTextGated as ReturnType<typeof vi.fn>).mockResolvedValue("   \n\n   ");
    const log: { table: string; op: "insert" | "delete"; payload?: unknown }[] = [];
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(stubSupabase(log));

    const { generateCoverLetter } = await import("@/lib/cover-letters/actions");
    const result = await generateCoverLetter(generateForm());

    expect(result).toEqual({ error: "That came back empty — try again." });
    expect(log).toHaveLength(0); // never even reached the database
  });

  it("cleans up the cover_letters row if saving the version fails partway through", async () => {
    await setup();
    const { generateTextGated } = await import("@/lib/ai/gateway");
    (generateTextGated as ReturnType<typeof vi.fn>).mockResolvedValue("Dear Hiring Manager,\n\nBody.\n\nSincerely.");
    const log: { table: string; op: "insert" | "delete"; payload?: unknown }[] = [];
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(stubSupabase(log, { failAt: "cover_letter_versions" }));

    const { generateCoverLetter } = await import("@/lib/cover-letters/actions");
    const result = await generateCoverLetter(generateForm());

    expect(result).toEqual({ error: "Your letter was generated, but couldn't be saved — try again." });
    expect(log.some((entry) => entry.table === "cover_letters" && entry.op === "delete")).toBe(true);
  });
});
