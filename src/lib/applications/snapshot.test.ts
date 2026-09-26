import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSnapshotFreeze, SnapshotError, type SnapshotFields } from "@/lib/applications/snapshot";

const mocks = vi.hoisted(() => ({
  matchJobToSponsor: vi.fn(),
  getJobMatchesForCv: vi.fn(),
  createSubmittedCvVersion: vi.fn(),
  currentVersionId: { value: "version-live" as string | null },
}));

vi.mock("@/lib/jobs/sponsor-match", () => ({ matchJobToSponsor: mocks.matchJobToSponsor }));
vi.mock("@/lib/jobs/queries", () => ({ getJobMatchesForCv: mocks.getJobMatchesForCv }));
vi.mock("@/lib/cvs/internal", () => ({ createSubmittedCvVersion: mocks.createSubmittedCvVersion }));
vi.mock("@/lib/supabase/server", () => ({
  // Only the current-version lookup goes through this client: from().select().eq().eq().eq().maybeSingle().
  createClient: async () => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.maybeSingle = () => Promise.resolve({ data: mocks.currentVersionId.value ? { id: mocks.currentVersionId.value } : null });
    return { from: () => chain };
  },
}));

const BASE = { userId: "user-1", companyName: "Acme Ltd", jobTitle: "Analyst", cvId: "cv-1", jobId: "job-1" };
const FROZEN: SnapshotFields = { sponsorStatus: "confirmed_sponsor", matchScore: 88, submittedCvVersionId: "version-old", frozenAt: "2024-01-01T00:00:00.000Z" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentVersionId.value = "version-live";
  mocks.matchJobToSponsor.mockResolvedValue({ status: "confirmed_sponsor", confidence: "exact", sponsors: [] });
  mocks.getJobMatchesForCv.mockResolvedValue(new Map([["job-1", { matchScore: 74 }]]));
  mocks.createSubmittedCvVersion.mockResolvedValue("version-copy");
});

describe("resolveSnapshotFreeze", () => {
  it("returns an already-frozen snapshot completely untouched — no lookups, no CV copy", async () => {
    const result = await resolveSnapshotFreeze({ ...BASE, newStatus: "interview", existing: FROZEN });
    expect(result).toBe(FROZEN);
    expect(mocks.matchJobToSponsor).not.toHaveBeenCalled();
    expect(mocks.createSubmittedCvVersion).not.toHaveBeenCalled();
  });

  it("stays frozen even if the company, CV and status all changed afterwards", async () => {
    const result = await resolveSnapshotFreeze({ ...BASE, companyName: "Totally Different plc", cvId: "cv-2", newStatus: "applied", existing: FROZEN });
    expect(result).toBe(FROZEN);
  });

  it("before Applied: resolves sponsor state and the job's stored score live, freezes nothing, copies no CV", async () => {
    const result = await resolveSnapshotFreeze({ ...BASE, newStatus: "wishlist", existing: null });
    expect(result).toEqual({ sponsorStatus: "confirmed_sponsor", matchScore: 74, submittedCvVersionId: null, frozenAt: null });
    expect(mocks.createSubmittedCvVersion).not.toHaveBeenCalled();
    expect(mocks.getJobMatchesForCv).toHaveBeenCalledWith(["job-1"], "version-live");
  });

  it("at first Applied: freezes sponsor state, the match score, and a PERMANENT COPY of the CV (not the live version's id)", async () => {
    const result = await resolveSnapshotFreeze({ ...BASE, newStatus: "applied", existing: null });

    expect(result.sponsorStatus).toBe("confirmed_sponsor");
    expect(result.matchScore).toBe(74);
    expect(result.submittedCvVersionId).toBe("version-copy");
    expect(result.submittedCvVersionId).not.toBe("version-live");
    expect(result.frozenAt).toEqual(expect.any(String));
    expect(mocks.createSubmittedCvVersion).toHaveBeenCalledWith(expect.anything(), "user-1", "cv-1", "version-live", "Submitted: Analyst at Acme Ltd");
  });

  it("at first Applied with an unfrozen earlier snapshot, still freezes fresh values", async () => {
    const unfrozen: SnapshotFields = { sponsorStatus: "not_found", matchScore: null, submittedCvVersionId: null, frozenAt: null };
    const result = await resolveSnapshotFreeze({ ...BASE, newStatus: "applied", existing: unfrozen });
    expect(result.sponsorStatus).toBe("confirmed_sponsor");
    expect(result.frozenAt).not.toBeNull();
  });

  it("freezes with a null score when there is no linked job, and with no CV copy when there is no CV", async () => {
    const noJob = await resolveSnapshotFreeze({ ...BASE, jobId: null, newStatus: "applied", existing: null });
    expect(noJob.matchScore).toBeNull();
    expect(noJob.submittedCvVersionId).toBe("version-copy");

    mocks.createSubmittedCvVersion.mockClear();
    const noCv = await resolveSnapshotFreeze({ ...BASE, cvId: null, newStatus: "applied", existing: null });
    expect(noCv).toMatchObject({ matchScore: null, submittedCvVersionId: null });
    expect(noCv.frozenAt).not.toBeNull();
    expect(mocks.createSubmittedCvVersion).not.toHaveBeenCalled();
  });

  it("freezes a null score when the job was never scored for this CV — it never invents one", async () => {
    mocks.getJobMatchesForCv.mockResolvedValue(new Map());
    const result = await resolveSnapshotFreeze({ ...BASE, newStatus: "applied", existing: null });
    expect(result.matchScore).toBeNull();
  });

  it("refuses to freeze if the sponsor register can't be checked (nothing is guessed)", async () => {
    mocks.matchJobToSponsor.mockRejectedValue(new Error("statement timeout"));
    await expect(resolveSnapshotFreeze({ ...BASE, newStatus: "applied", existing: null })).rejects.toBeInstanceOf(SnapshotError);
    await expect(resolveSnapshotFreeze({ ...BASE, newStatus: "wishlist", existing: null })).rejects.toThrow(/sponsor register/);
  });

  it("refuses to freeze if the CV copy can't be made, rather than freezing the live version", async () => {
    mocks.createSubmittedCvVersion.mockResolvedValue(null);
    await expect(resolveSnapshotFreeze({ ...BASE, newStatus: "applied", existing: null })).rejects.toThrow(/copy of your CV/);
  });
});
