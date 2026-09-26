import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeLinkedinKeywordCoverage } from "@/lib/linkedin/keyword-coverage";
import { saveLinkedinAboutSchema, saveLinkedinBulletSchema, saveLinkedinHeadlineSchema, createLinkedinDraftSchema } from "@/lib/linkedin/schemas";
import type { LinkedinKeywordTerm } from "@/lib/linkedin/types";

const TERMS: LinkedinKeywordTerm[] = [
  { term: "Roadmapping", importance: "high", suggestedPlacement: "headline" },
  { term: "SQL", importance: "medium", suggestedPlacement: "about" },
  { term: "OKRs", importance: "low", suggestedPlacement: "experience" },
];

describe("computeLinkedinKeywordCoverage", () => {
  it("weights high/medium/low 3/2/1 and reports what's found and missing", () => {
    const coverage = computeLinkedinKeywordCoverage(TERMS, "I own roadmapping for the team.");
    expect(coverage.found.map((k) => k.term)).toEqual(["Roadmapping"]);
    expect(coverage.missing.map((k) => k.term)).toEqual(["SQL", "OKRs"]);
    expect(coverage.score).toBe(50); // 3 of 6 weight
  });

  it("matches whole words case-insensitively — 'SQL' is not found inside 'MySQLite'", () => {
    expect(computeLinkedinKeywordCoverage(TERMS, "MySQLite fan").found).toHaveLength(0);
    expect(computeLinkedinKeywordCoverage(TERMS, "sql, okrs and ROADMAPPING").score).toBe(100);
  });

  it("scores 0 for no keywords rather than dividing by zero", () => {
    expect(computeLinkedinKeywordCoverage([], "anything").score).toBe(0);
  });

  it("rises as text is added — the basis of the live re-score", () => {
    const before = computeLinkedinKeywordCoverage(TERMS, "Product manager").score;
    const after = computeLinkedinKeywordCoverage(TERMS, "Product manager. Roadmapping, SQL and OKRs.").score;
    expect(after).toBeGreaterThan(before);
  });
});

describe("linkedin schemas", () => {
  const DRAFT_ID = "11111111-1111-4111-8111-111111111111";

  it("enforces LinkedIn's real limits on the input", () => {
    const base = { title: "T", targetRole: "PM", targetSeniority: "senior", currentExperience: "Did things" };
    expect(createLinkedinDraftSchema.safeParse({ ...base, currentHeadline: "x".repeat(221) }).success).toBe(false);
    expect(createLinkedinDraftSchema.safeParse({ ...base, currentAbout: "x".repeat(2601) }).success).toBe(false);
    expect(createLinkedinDraftSchema.safeParse({ ...base, currentExperience: "" }).success).toBe(false);
    expect(createLinkedinDraftSchema.safeParse({ ...base, targetSeniority: "wizard" }).success).toBe(false);
    expect(createLinkedinDraftSchema.safeParse(base).success).toBe(true); // headline/About are optional
  });

  it("validates autosaved edits", () => {
    expect(saveLinkedinAboutSchema.safeParse({ draftId: DRAFT_ID, about: "   " }).success).toBe(false);
    expect(saveLinkedinAboutSchema.safeParse({ draftId: DRAFT_ID, about: "x".repeat(2601) }).success).toBe(false);
    expect(saveLinkedinBulletSchema.safeParse({ bulletId: DRAFT_ID, content: "x".repeat(301) }).success).toBe(false);
    expect(saveLinkedinHeadlineSchema.safeParse({ draftId: DRAFT_ID, headline: "" }).success).toBe(true); // clears the choice
    expect(saveLinkedinHeadlineSchema.safeParse({ draftId: DRAFT_ID, headline: "x".repeat(221) }).success).toBe(false);
  });
});

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/linkedin/internal", () => ({
  buildLinkedinDraftSnapshot: vi.fn(),
  saveLinkedinDraftVersion: vi.fn(),
  applyLinkedinDraftSnapshot: vi.fn(),
  ensureLinkedinHistorySnapshot: vi.fn(),
  getLinkedinBulletDraftId: vi.fn(),
}));

describe("restoreLinkedinDraftVersion", () => {
  const DRAFT_ID = "11111111-1111-4111-8111-111111111111";
  const VERSION_ID = "22222222-2222-4222-8222-222222222222";
  const form = () => {
    const f = new FormData();
    f.set("draftId", DRAFT_ID);
    f.set("versionId", VERSION_ID);
    return f;
  };

  beforeEach(() => vi.clearAllMocks());

  async function setup(options: { versionFound?: boolean; backupOk?: boolean; applyResults?: boolean[] }) {
    const { requireUser } = await import("@/lib/auth/session");
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-1" });
    const { createClient } = await import("@/lib/supabase/server");
    const builder: Record<string, unknown> = {};
    builder.select = () => builder;
    builder.eq = () => builder;
    builder.maybeSingle = () =>
      Promise.resolve({ data: options.versionFound === false ? null : { snapshot: { title: "old" } }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ from: () => builder });
    const internal = await import("@/lib/linkedin/internal");
    (internal.buildLinkedinDraftSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({ title: "current" });
    (internal.saveLinkedinDraftVersion as ReturnType<typeof vi.fn>).mockResolvedValue(options.backupOk ?? true);
    const apply = internal.applyLinkedinDraftSnapshot as ReturnType<typeof vi.fn>;
    apply.mockReset(); // clear any unconsumed once-values queued by an earlier test
    for (const result of options.applyResults ?? [true]) apply.mockResolvedValueOnce(result);
    return internal;
  }

  it("backs up the current state before replacing it, so a restore is itself undoable", async () => {
    const internal = await setup({});
    const { restoreLinkedinDraftVersion } = await import("@/lib/linkedin/edit-actions");
    expect(await restoreLinkedinDraftVersion(undefined, form())).toEqual({ success: "Restored." });
    const order = [
      (internal.saveLinkedinDraftVersion as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
      (internal.applyLinkedinDraftSnapshot as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]);
  });

  it("changes nothing if the backup can't be saved", async () => {
    const internal = await setup({ backupOk: false });
    const { restoreLinkedinDraftVersion } = await import("@/lib/linkedin/edit-actions");
    const result = await restoreLinkedinDraftVersion(undefined, form());
    expect(result).toMatchObject({ error: expect.stringContaining("nothing was changed") });
    expect(internal.applyLinkedinDraftSnapshot).not.toHaveBeenCalled();
  });

  it("puts the backed-up state straight back if applying the old version fails partway", async () => {
    const internal = await setup({ applyResults: [false, true] });
    const { restoreLinkedinDraftVersion } = await import("@/lib/linkedin/edit-actions");
    const result = await restoreLinkedinDraftVersion(undefined, form());
    expect(result).toMatchObject({ error: expect.stringContaining("left as it was") });
    const apply = internal.applyLinkedinDraftSnapshot as ReturnType<typeof vi.fn>;
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply.mock.calls[1][3]).toEqual({ title: "current" });
  });

  it("refuses a version that isn't this user's / this draft's", async () => {
    await setup({ versionFound: false });
    const { restoreLinkedinDraftVersion } = await import("@/lib/linkedin/edit-actions");
    expect(await restoreLinkedinDraftVersion(undefined, form())).toEqual({ error: "That version couldn't be found." });
  });
});
