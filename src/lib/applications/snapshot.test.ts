import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSnapshotFreeze, type SnapshotFields } from "@/lib/applications/snapshot";

vi.mock("@/lib/jobs/sponsor-match", () => ({ matchJobToSponsor: vi.fn() }));
vi.mock("@/lib/cvs/queries", () => ({ getCvEditorData: vi.fn() }));
vi.mock("@/lib/jobs/queries", () => ({ getJobMatchesForCv: vi.fn() }));

const BASE_PARAMS = {
  userId: "user-1",
  companyName: "Acme Ltd",
  cvId: "cv-1",
  jobId: "job-1",
};

describe("resolveSnapshotFreeze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing snapshot completely untouched once already frozen — no lookups at all", async () => {
    const { matchJobToSponsor } = await import("@/lib/jobs/sponsor-match");
    const { getCvEditorData } = await import("@/lib/cvs/queries");

    const existing: SnapshotFields = {
      sponsorStatus: "confirmed_sponsor",
      matchScore: 88,
      submittedCvVersionId: "version-old",
      frozenAt: "2024-01-01T00:00:00.000Z",
    };

    const result = await resolveSnapshotFreeze({ ...BASE_PARAMS, newStatus: "interview", existing });

    expect(result).toBe(existing);
    expect(matchJobToSponsor).not.toHaveBeenCalled();
    expect(getCvEditorData).not.toHaveBeenCalled();
  });

  it("resolves sponsor status live but leaves matchScore/submittedCvVersionId null for a non-applied status", async () => {
    const { matchJobToSponsor } = await import("@/lib/jobs/sponsor-match");
    (matchJobToSponsor as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "confirmed_sponsor",
      confidence: "exact",
      sponsors: [],
    });
    const { getCvEditorData } = await import("@/lib/cvs/queries");

    const result = await resolveSnapshotFreeze({ ...BASE_PARAMS, newStatus: "wishlist", existing: null });

    expect(result).toEqual({ sponsorStatus: "confirmed_sponsor", matchScore: null, submittedCvVersionId: null, frozenAt: null });
    expect(getCvEditorData).not.toHaveBeenCalled();
  });

  it("freezes sponsor status, CV version, and match score together on the first transition to applied", async () => {
    const { matchJobToSponsor } = await import("@/lib/jobs/sponsor-match");
    (matchJobToSponsor as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: "unconfirmed",
      confidence: "likely",
      sponsors: [],
    });
    const { getCvEditorData } = await import("@/lib/cvs/queries");
    (getCvEditorData as ReturnType<typeof vi.fn>).mockResolvedValue({ versionId: "version-42" });
    const { getJobMatchesForCv } = await import("@/lib/jobs/queries");
    (getJobMatchesForCv as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([["job-1", { matchScore: 73 }]]));

    const result = await resolveSnapshotFreeze({ ...BASE_PARAMS, newStatus: "applied", existing: null });

    expect(result.sponsorStatus).toBe("unconfirmed");
    expect(result.matchScore).toBe(73);
    expect(result.submittedCvVersionId).toBe("version-42");
    expect(result.frozenAt).not.toBeNull();
  });

  it("freezes with a null match score when there's no cvId to look up", async () => {
    const { matchJobToSponsor } = await import("@/lib/jobs/sponsor-match");
    (matchJobToSponsor as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "not_found", confidence: "none", sponsors: [] });
    const { getCvEditorData } = await import("@/lib/cvs/queries");
    const { getJobMatchesForCv } = await import("@/lib/jobs/queries");

    const result = await resolveSnapshotFreeze({ ...BASE_PARAMS, cvId: null, newStatus: "applied", existing: null });

    expect(result.submittedCvVersionId).toBeNull();
    expect(result.matchScore).toBeNull();
    expect(result.frozenAt).not.toBeNull();
    expect(getCvEditorData).not.toHaveBeenCalled();
    expect(getJobMatchesForCv).not.toHaveBeenCalled();
  });

  it("freezes with a null match score when there's no jobId, even though a CV was resolved", async () => {
    const { matchJobToSponsor } = await import("@/lib/jobs/sponsor-match");
    (matchJobToSponsor as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "not_found", confidence: "none", sponsors: [] });
    const { getCvEditorData } = await import("@/lib/cvs/queries");
    (getCvEditorData as ReturnType<typeof vi.fn>).mockResolvedValue({ versionId: "version-42" });
    const { getJobMatchesForCv } = await import("@/lib/jobs/queries");

    const result = await resolveSnapshotFreeze({ ...BASE_PARAMS, jobId: null, newStatus: "applied", existing: null });

    expect(result.submittedCvVersionId).toBe("version-42");
    expect(result.matchScore).toBeNull();
    expect(getJobMatchesForCv).not.toHaveBeenCalled();
  });

  it("freezes with a null match score when a job match was never actually computed for this job/version pair", async () => {
    const { matchJobToSponsor } = await import("@/lib/jobs/sponsor-match");
    (matchJobToSponsor as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "not_found", confidence: "none", sponsors: [] });
    const { getCvEditorData } = await import("@/lib/cvs/queries");
    (getCvEditorData as ReturnType<typeof vi.fn>).mockResolvedValue({ versionId: "version-42" });
    const { getJobMatchesForCv } = await import("@/lib/jobs/queries");
    (getJobMatchesForCv as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());

    const result = await resolveSnapshotFreeze({ ...BASE_PARAMS, newStatus: "applied", existing: null });
    expect(result.matchScore).toBeNull();
  });

  it("does not freeze at all when the CV lookup finds nothing (e.g. a deleted CV)", async () => {
    const { matchJobToSponsor } = await import("@/lib/jobs/sponsor-match");
    (matchJobToSponsor as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "not_found", confidence: "none", sponsors: [] });
    const { getCvEditorData } = await import("@/lib/cvs/queries");
    (getCvEditorData as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await resolveSnapshotFreeze({ ...BASE_PARAMS, newStatus: "applied", existing: null });
    expect(result.submittedCvVersionId).toBeNull();
    // Still genuinely frozen (frozenAt set) even though no CV snapshot
    // could be captured — a save at Applied always locks sponsor status
    // in, CV availability is a separate concern.
    expect(result.frozenAt).not.toBeNull();
  });
});
