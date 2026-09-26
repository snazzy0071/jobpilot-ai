import { describe, expect, it } from "vitest";
import { dedupeKey, evaluateJob, matchesAny, remainingToday, ukDayWindow } from "@/lib/auto-apply/eligibility";
import { dueItems, retryDelayMinutes, runAttempt } from "@/lib/auto-apply/runner";
import { resolveAdapter } from "@/lib/auto-apply/adapters/registry";
import { assistedAdapter } from "@/lib/auto-apply/adapters/assisted";
import type { AdapterOutcome, ApplyAdapter, ApplyPackage } from "@/lib/auto-apply/adapters/types";
import { settingsSchema } from "@/lib/auto-apply/schemas";
import { DEFAULT_SETTINGS, type AutoApplySettings, type JobFacts } from "@/lib/auto-apply/types";

const settings = (over: Partial<AutoApplySettings> = {}): AutoApplySettings => ({ ...DEFAULT_SETTINGS, enabled: true, ...over });
const job = (over: Partial<JobFacts> = {}): JobFacts => ({ jobId: "j1", title: "Graduate Data Analyst", company: "Acme Ltd", location: "London", applyUrl: "https://x.test/1", matchScore: 85, sponsorConfirmed: true, salaryMin: null, active: true, ...over });
const pkg: ApplyPackage = { queueId: "q", applyUrl: "https://x.test/1", companyName: "Acme", jobTitle: "Analyst", cvId: "cv", coverLetterId: null };
const fake = (outcome: AdapterOutcome | "throw", canSubmit = true): ApplyAdapter => ({
  id: "fake",
  label: "Fake",
  canSubmit,
  supports: (url) => url.includes("x.test"),
  apply: async () => {
    if (outcome === "throw") throw new Error("boom with secret cv text");
    return outcome;
  },
});
const item = (over = {}) => ({ attemptCount: 0, maxAttempts: 3, hasApplyUrl: true, ...over });
const now = new Date("2026-09-26T10:00:00Z");

describe("evaluateJob", () => {
  it("accepts a job that meets every rule", () => expect(evaluateJob(settings(), job())).toEqual({ eligible: true, reasons: [] }));
  it("rejects inactive listings", () => expect(evaluateJob(settings(), job({ active: false })).reasons).toContain("inactive"));
  it("rejects unscored jobs", () => expect(evaluateJob(settings(), job({ matchScore: null })).reasons).toEqual(["no_score"]));
  it("rejects scores below the threshold but accepts equal", () => {
    expect(evaluateJob(settings({ minMatchScore: 80 }), job({ matchScore: 79 })).reasons).toEqual(["below_threshold"]);
    expect(evaluateJob(settings({ minMatchScore: 80 }), job({ matchScore: 80 })).eligible).toBe(true);
  });
  it("applies role and location keywords", () => {
    expect(evaluateJob(settings({ roleKeywords: ["nurse"] }), job()).reasons).toEqual(["role_mismatch"]);
    expect(evaluateJob(settings({ roleKeywords: ["ANALYST"] }), job()).eligible).toBe(true);
    expect(evaluateJob(settings({ locations: ["leeds"] }), job()).reasons).toEqual(["location_mismatch"]);
    expect(evaluateJob(settings({ locations: ["leeds"] }), job({ location: null })).reasons).toEqual(["location_mismatch"]);
  });
  it("handles salary: unknown allowed or excluded, known below minimum", () => {
    expect(evaluateJob(settings({ minSalary: 30000, includeUnknownSalary: true }), job()).eligible).toBe(true);
    expect(evaluateJob(settings({ minSalary: 30000, includeUnknownSalary: false }), job()).reasons).toEqual(["salary_unknown"]);
    expect(evaluateJob(settings({ minSalary: 30000 }), job({ salaryMin: 25000 })).reasons).toEqual(["salary_below_minimum"]);
    expect(evaluateJob(settings({ minSalary: 30000 }), job({ salaryMin: 30000 })).eligible).toBe(true);
  });
  it("enforces sponsor-only", () => expect(evaluateJob(settings({ sponsorOnly: true }), job({ sponsorConfirmed: false })).reasons).toEqual(["not_confirmed_sponsor"]));
  it("reports every failing reason", () => expect(evaluateJob(settings({ sponsorOnly: true }), job({ active: false, matchScore: 10, sponsorConfirmed: false })).reasons).toHaveLength(3));
});

describe("matchesAny / dedupeKey", () => {
  it("empty keywords match anything, null text matches nothing otherwise", () => {
    expect(matchesAny(null, [])).toBe(true);
    expect(matchesAny(null, ["a"])).toBe(false);
  });
  it("treats the same employer and title as one job across formatting", () => {
    expect(dedupeKey("Acme Ltd.", "Graduate  Analyst")).toBe(dedupeKey("ACME", "graduate analyst"));
    expect(dedupeKey("Acme", "Analyst")).not.toBe(dedupeKey("Acme", "Engineer"));
  });
});

describe("ukDayWindow", () => {
  it("spans 24h in winter (GMT)", () => {
    const { start, end } = ukDayWindow(new Date("2026-01-15T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });
  it("starts at 23:00Z the day before in summer (BST)", () => {
    const { start, end } = ukDayWindow(new Date("2026-07-15T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-07-14T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-15T23:00:00.000Z");
  });
  it("puts 23:30Z in summer into the next UK day", () => expect(ukDayWindow(new Date("2026-07-15T23:30:00Z")).start.toISOString()).toBe("2026-07-15T23:00:00.000Z"));
  it("is 23h long on the spring-forward day", () => {
    const { start, end } = ukDayWindow(new Date("2026-03-29T12:00:00Z"));
    expect(end.getTime() - start.getTime()).toBe(23 * 3_600_000);
  });
});

describe("remainingToday", () => {
  it("never goes negative", () => {
    expect(remainingToday(5, 2)).toBe(3);
    expect(remainingToday(5, 9)).toBe(0);
  });
});

describe("retryDelayMinutes", () => {
  it("backs off and caps", () => {
    expect([1, 2, 3].map(retryDelayMinutes)).toEqual([15, 30, 60]);
    expect(retryDelayMinutes(20)).toBe(360);
  });
});

describe("runAttempt", () => {
  it("submitted → applied and marked sent", async () => {
    const r = await runAttempt(item(), fake({ kind: "submitted", reference: "ref-1" }), pkg, now);
    expect(r).toMatchObject({ status: "applied", sent: true, event: "submitted", attemptCount: 1, reference: "ref-1" });
  });
  it("manual_required → needs_manual, not sent", async () => {
    const r = await runAttempt(item(), assistedAdapter, pkg, now);
    expect(r).toMatchObject({ status: "needs_manual", sent: false, event: "handed_to_manual" });
  });
  it("blocked goes straight to the user and is never retried", async () => {
    const r = await runAttempt(item(), fake({ kind: "blocked", reason: "CAPTCHA" }), pkg, now);
    expect(r).toMatchObject({ status: "needs_manual", nextAttemptAt: null, event: "blocked_handed_to_manual" });
  });
  it("retryable errors back off, then give up to the user", async () => {
    const first = await runAttempt(item(), fake({ kind: "retryable_error", reason: "timeout" }), pkg, now);
    expect(first).toMatchObject({ status: "approved", attemptCount: 1, event: "attempt_failed" });
    expect(first.nextAttemptAt?.getTime()).toBe(now.getTime() + 15 * 60_000);
    const last = await runAttempt(item({ attemptCount: 2 }), fake({ kind: "retryable_error", reason: "timeout" }), pkg, now);
    expect(last).toMatchObject({ status: "needs_manual", nextAttemptAt: null, event: "gave_up_handed_to_manual" });
  });
  it("permanent errors hand over when there is a link, else fail", async () => {
    expect((await runAttempt(item(), fake({ kind: "permanent_error", reason: "gone" }), pkg, now)).status).toBe("needs_manual");
    expect((await runAttempt(item({ hasApplyUrl: false }), fake({ kind: "permanent_error", reason: "gone" }), pkg, now)).status).toBe("failed");
  });
  it("a throwing adapter is retried and its message is not kept", async () => {
    const r = await runAttempt(item(), fake("throw"), pkg, now);
    expect(r.status).toBe("approved");
    expect(r.lastError).not.toContain("secret");
  });
});

describe("dueItems", () => {
  it("returns approved items whose retry time has come, oldest approval first", () => {
    const rows = [
      { status: "approved" as const, nextAttemptAt: null, approvedAt: "2026-09-26T09:00:00Z" },
      { status: "approved" as const, nextAttemptAt: "2026-09-26T11:00:00Z", approvedAt: "2026-09-26T08:00:00Z" },
      { status: "approved" as const, nextAttemptAt: "2026-09-26T09:30:00Z", approvedAt: "2026-09-26T07:00:00Z" },
      { status: "pending_review" as const, nextAttemptAt: null, approvedAt: null },
    ];
    expect(dueItems(rows, now).map((r) => r.approvedAt)).toEqual(["2026-09-26T07:00:00Z", "2026-09-26T09:00:00Z"]);
  });
});

describe("resolveAdapter", () => {
  it("uses a submitting adapter that supports the URL", () => expect(resolveAdapter("https://x.test/1", [fake({ kind: "submitted" })]).id).toBe("fake"));
  it("falls back to assisted for unsupported sites and for non-submitting adapters", () => {
    expect(resolveAdapter("https://other.test", [fake({ kind: "submitted" })])).toBe(assistedAdapter);
    expect(resolveAdapter("https://x.test/1", [fake({ kind: "submitted" }, false)])).toBe(assistedAdapter);
    expect(resolveAdapter("https://x.test/1").id).toBe("assisted");
  });
});

describe("settingsSchema", () => {
  const base = { enabled: true, minMatchScore: "75", roleKeywords: "analyst, analyst, engineer", locations: "", minSalary: "£30,000", includeUnknownSalary: true, sponsorOnly: false, dailyLimit: "5", cvId: "", coverLetterId: "", consent: true };
  it("normalises lists, salary and empty ids", () => {
    const r = settingsSchema.parse(base);
    expect(r).toMatchObject({ roleKeywords: ["analyst", "engineer"], locations: [], minSalary: 30000, cvId: null, minMatchScore: 75, dailyLimit: 5 });
  });
  it("rejects out-of-range values and non-uuid ids", () => {
    expect(settingsSchema.safeParse({ ...base, minMatchScore: "10" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, dailyLimit: "0" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, dailyLimit: "999" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, minSalary: "abc" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, cvId: "not-a-uuid" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, roleKeywords: Array.from({ length: 11 }, (_, i) => `k${i}`).join(",") }).success).toBe(false);
  });
});
