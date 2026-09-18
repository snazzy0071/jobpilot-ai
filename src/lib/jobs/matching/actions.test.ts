import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/cvs/queries", () => ({ getCvEditorData: vi.fn() }));
vi.mock("@/lib/jobs/queries", () => ({ getJobById: vi.fn() }));
vi.mock("@/lib/ai/gateway", () => ({ generateStructuredGated: vi.fn() }));
// Not used directly by this test, but importing the real (unmocked)
// @/lib/entitlements/service below (for its real EntitlementError class)
// pulls in @/lib/supabase/admin at module load time, which parses real
// env vars this Vitest process doesn't have — same reason every other
// integration test this session mocks it even when nothing here calls it.
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

function component(score: number) {
  return { score, summary: "Mock summary." };
}

/** runJobMatch's own insert payload already uses real (snake_case) column names directly — no camelCase conversion needed, just echo it back the way Supabase's own .select().single() would after a real insert. */
function stubInsert(insertedRows: unknown[]) {
  const builder: Record<string, (...args: never[]) => unknown> = {};
  builder.insert = (row: unknown) => {
    insertedRows.push(row);
    return builder;
  };
  builder.select = () => builder;
  builder.single = () =>
    Promise.resolve({
      data: { id: "match-1", ...(insertedRows[0] as Record<string, unknown>), created_at: "2024-01-01T00:00:00.000Z" },
      error: null,
    });
  return { from: () => builder };
}

describe("runJobMatch", () => {
  beforeEach(() => vi.clearAllMocks());

  const DEFAULT_CV = {
    // buildCvPlainText (via getVisibleContent) needs the full
    // CvEditorData array shape, not just the fields runJobMatch itself
    // reads — an empty CV is a legitimate fixture, same as
    // src/lib/cvs/ats-format-checks.test.ts's own emptyCv() helper.
    versionId: "version-1",
    personal: { id: "p1", fullName: "Jane Doe", headline: null, email: null, phone: null, location: null, websiteUrl: null, linkedinUrl: null, portfolioUrl: null },
    summary: null,
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: [],
    customSections: [],
    sectionOrder: [],
  };
  const DEFAULT_JOB = { id: "11111111-1111-1111-8111-111111111111", title: "Software Engineer", description: "Build things." };

  // `"cv" in overrides` (not `overrides.cv ?? DEFAULT`) is what lets a
  // test pass `cv: null` and have that actually reach the mock as null
  // — `??` treats an explicit null the same as "not provided", which
  // would silently fall back to DEFAULT_CV instead.
  async function setup(overrides: { cv?: unknown; job?: unknown } = {}) {
    const { requireUser } = await import("@/lib/auth/session");
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-1" });
    const { getCvEditorData } = await import("@/lib/cvs/queries");
    (getCvEditorData as ReturnType<typeof vi.fn>).mockResolvedValue("cv" in overrides ? overrides.cv : DEFAULT_CV);
    const { getJobById } = await import("@/lib/jobs/queries");
    (getJobById as ReturnType<typeof vi.fn>).mockResolvedValue("job" in overrides ? overrides.job : DEFAULT_JOB);
  }

  it("derives the verdict deterministically from the AI's matchScore and persists it", async () => {
    await setup();
    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    (generateStructuredGated as ReturnType<typeof vi.fn>).mockResolvedValue({
      matchScore: 85,
      coreSkills: component(80),
      techFunctionalSkills: component(80),
      domainFit: component(80),
      seniority: component(80),
      reasons: ["Strong overlap in required skills."],
      gaps: [],
    });
    const insertedRows: unknown[] = [];
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(stubInsert(insertedRows));

    const { runJobMatch } = await import("@/lib/jobs/matching/actions");
    const result = await runJobMatch({ jobId: "11111111-1111-1111-8111-111111111111", cvId: "22222222-2222-2222-8222-222222222222" });

    if (!("match" in result)) throw new Error("expected a real match");
    expect(result.match.verdict).toBe("strong_match"); // 85 >= VERDICT_THRESHOLDS.strongMatch
    expect((insertedRows[0] as Record<string, unknown>).verdict).toBe("strong_match");
  });

  it("returns a not-found error without ever calling the AI gateway when the CV doesn't belong to this user", async () => {
    await setup({ cv: null });
    const { generateStructuredGated } = await import("@/lib/ai/gateway");

    const { runJobMatch } = await import("@/lib/jobs/matching/actions");
    const result = await runJobMatch({ jobId: "11111111-1111-1111-8111-111111111111", cvId: "22222222-2222-2222-8222-222222222222" });

    expect(result).toEqual({ error: "That CV couldn't be found." });
    expect(generateStructuredGated).not.toHaveBeenCalled();
  });

  it("returns a not-found error when the job doesn't exist", async () => {
    await setup({ job: null });
    const { runJobMatch } = await import("@/lib/jobs/matching/actions");
    const result = await runJobMatch({ jobId: "11111111-1111-1111-8111-111111111111", cvId: "22222222-2222-2222-8222-222222222222" });
    expect(result).toEqual({ error: "That job couldn't be found." });
  });

  it("surfaces a real EntitlementError message (e.g. Free plan lacking the job_match feature) as-is", async () => {
    await setup();
    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    const { EntitlementError } = await import("@/lib/entitlements/service");
    (generateStructuredGated as ReturnType<typeof vi.fn>).mockRejectedValue(
      new EntitlementError("This feature isn't included in your current plan."),
    );

    const { runJobMatch } = await import("@/lib/jobs/matching/actions");
    const result = await runJobMatch({ jobId: "11111111-1111-1111-8111-111111111111", cvId: "22222222-2222-2222-8222-222222222222" });
    expect(result).toEqual({ error: "This feature isn't included in your current plan." });
  });

  it("gives a generic, safe error for an unexpected failure rather than leaking internals", async () => {
    await setup();
    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    (generateStructuredGated as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("some internal detail"));

    const { runJobMatch } = await import("@/lib/jobs/matching/actions");
    const result = await runJobMatch({ jobId: "11111111-1111-1111-8111-111111111111", cvId: "22222222-2222-2222-8222-222222222222" });
    expect(result).toEqual({ error: "Couldn't run that match — try again." });
  });
});
