import { describe, expect, it, vi } from "vitest";
import { applyFilters, applySort, deadlineState, groupByStatus, hasActiveFilters, DEFAULT_TRACKER_FILTERS, type TrackerFilterState } from "@/lib/applications/view";
import { daysBetweenFirstReaches, median } from "@/lib/applications/analytics";
import { createReminderSchema } from "@/lib/applications/reminders/schemas";
import type { Application } from "@/lib/applications/types";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const TODAY = "2026-09-25";

function app(overrides: Partial<Application> & { id: string }): Application {
  return {
    jobId: null,
    cvId: null,
    coverLetterId: null,
    companyName: "Acme",
    jobTitle: "Analyst",
    location: null,
    salary: null,
    url: null,
    deadline: null,
    status: "wishlist",
    notes: null,
    appliedAt: null,
    sponsorStatus: null,
    matchScore: null,
    submittedCvVersionId: null,
    frozenAt: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const filters = (overrides: Partial<TrackerFilterState> = {}): TrackerFilterState => ({ ...DEFAULT_TRACKER_FILTERS, ...overrides });

const LIST = [
  app({ id: "a", companyName: "Barclays", jobTitle: "Data Analyst", location: "London", salary: "£50,000", notes: "Referred by Sam", status: "applied", deadline: "2026-09-20", sponsorStatus: "confirmed_sponsor", matchScore: 82, cvId: "cv1", appliedAt: "2026-09-10", updatedAt: "2026-09-20T00:00:00Z" }),
  app({ id: "b", companyName: "Rolls-Royce", jobTitle: "Engineer", location: "Derby", status: "wishlist", deadline: "2026-09-28", cvId: "cv2", coverLetterId: "cl1", matchScore: 60, updatedAt: "2026-09-22T00:00:00Z" }),
  app({ id: "c", companyName: "Acme", jobTitle: "Nurse", status: "rejected", deadline: "2026-09-01", sponsorStatus: "not_found", updatedAt: "2026-09-05T00:00:00Z" }),
  app({ id: "d", companyName: "acme", jobTitle: "Consultant", status: "interview", deadline: "2026-12-01", matchScore: 91, appliedAt: "2026-09-15", updatedAt: "2026-09-24T00:00:00Z" }),
];

const ids = (list: Application[]) => list.map((a) => a.id);

describe("deadlineState", () => {
  it("is overdue only for an open application whose date has passed", () => {
    expect(deadlineState({ deadline: "2026-09-20", status: "applied" }, TODAY)).toBe("overdue");
    expect(deadlineState({ deadline: "2026-09-25", status: "wishlist" }, TODAY)).toBe("soon"); // today isn't overdue
    expect(deadlineState({ deadline: "2026-10-02", status: "wishlist" }, TODAY)).toBe("soon");
    expect(deadlineState({ deadline: "2026-10-03", status: "wishlist" }, TODAY)).toBe("later");
    expect(deadlineState({ deadline: null, status: "wishlist" }, TODAY)).toBe("none");
  });
  it("never chases a deadline on a closed application", () => {
    expect(deadlineState({ deadline: "2026-09-01", status: "rejected" }, TODAY)).toBe("later");
    expect(deadlineState({ deadline: "2026-09-01", status: "withdrawn" }, TODAY)).toBe("later");
  });
});

describe("applyFilters", () => {
  it("searches company, role, location, salary and notes, every word must match", () => {
    expect(ids(applyFilters(LIST, filters({ search: "barclays" }), TODAY))).toEqual(["a"]);
    expect(ids(applyFilters(LIST, filters({ search: "derby" }), TODAY))).toEqual(["b"]);
    expect(ids(applyFilters(LIST, filters({ search: "50,000" }), TODAY))).toEqual(["a"]);
    expect(ids(applyFilters(LIST, filters({ search: "referred sam" }), TODAY))).toEqual(["a"]);
    expect(ids(applyFilters(LIST, filters({ search: "acme nurse" }), TODAY))).toEqual(["c"]);
    expect(ids(applyFilters(LIST, filters({ search: "  ACME  " }), TODAY))).toEqual(["c", "d"]);
    expect(applyFilters(LIST, filters({ search: "zzz" }), TODAY)).toEqual([]);
  });

  it("filters by status, sponsor state, CV and cover letter", () => {
    expect(ids(applyFilters(LIST, filters({ status: "applied" }), TODAY))).toEqual(["a"]);
    expect(ids(applyFilters(LIST, filters({ sponsor: "confirmed_sponsor" }), TODAY))).toEqual(["a"]);
    expect(ids(applyFilters(LIST, filters({ sponsor: "none" }), TODAY))).toEqual(["b", "d"]); // never checked
    expect(ids(applyFilters(LIST, filters({ cvId: "cv2" }), TODAY))).toEqual(["b"]);
    expect(ids(applyFilters(LIST, filters({ cvId: "none" }), TODAY))).toEqual(["c", "d"]);
    expect(ids(applyFilters(LIST, filters({ coverLetterId: "cl1" }), TODAY))).toEqual(["b"]);
    expect(ids(applyFilters(LIST, filters({ coverLetterId: "none" }), TODAY))).toEqual(["a", "c", "d"]);
  });

  it("filters by deadline: overdue (open only), next 7 days, has/no deadline", () => {
    expect(ids(applyFilters(LIST, filters({ deadline: "overdue" }), TODAY))).toEqual(["a"]); // c is closed
    expect(ids(applyFilters(LIST, filters({ deadline: "next_7_days" }), TODAY))).toEqual(["b"]);
    expect(ids(applyFilters(LIST, filters({ deadline: "has_deadline" }), TODAY))).toHaveLength(4);
    expect(applyFilters(LIST, filters({ deadline: "no_deadline" }), TODAY)).toEqual([]);
  });

  it("combines filters", () => {
    expect(ids(applyFilters(LIST, filters({ search: "acme", status: "interview" }), TODAY))).toEqual(["d"]);
  });
});

describe("applySort", () => {
  it("sorts by last updated, newest first, by default", () => {
    expect(ids(applySort(LIST, "updated_desc"))).toEqual(["d", "b", "a", "c"]);
  });
  it("sorts by deadline soonest with no-deadline last", () => {
    const withNone = [...LIST, app({ id: "e" })];
    expect(ids(applySort(withNone, "deadline_asc"))).toEqual(["c", "a", "b", "d", "e"]);
  });
  it("sorts by match score highest first with unscored last", () => {
    expect(ids(applySort(LIST, "match_desc"))).toEqual(["d", "a", "b", "c"]);
  });
  it("sorts by date applied, latest first, never-applied last", () => {
    expect(ids(applySort(LIST, "applied_desc"))).toEqual(["d", "a", "b", "c"]);
  });
  it("sorts by company A-Z ignoring case, then role", () => {
    expect(ids(applySort(LIST, "company_az"))).toEqual(["d", "c", "a", "b"]); // acme Consultant, Acme Nurse, Barclays, Rolls-Royce
  });
  it("sorts by pipeline stage", () => {
    expect(ids(applySort(LIST, "status"))).toEqual(["b", "a", "d", "c"]);
  });
  it("does not mutate its input", () => {
    const copy = [...LIST];
    applySort(LIST, "company_az");
    expect(LIST).toEqual(copy);
  });
});

describe("groupByStatus / hasActiveFilters", () => {
  it("puts every application in its column, keeping empty columns", () => {
    const groups = groupByStatus(LIST);
    expect(Object.keys(groups)).toEqual(["wishlist", "applied", "interview", "offer", "rejected", "withdrawn"]);
    expect(ids(groups.interview)).toEqual(["d"]);
    expect(groups.offer).toEqual([]);
  });
  it("knows when a filter is on", () => {
    expect(hasActiveFilters(DEFAULT_TRACKER_FILTERS)).toBe(false);
    expect(hasActiveFilters(filters({ sort: "company_az" }))).toBe(false); // sorting isn't filtering
    expect(hasActiveFilters(filters({ deadline: "overdue" }))).toBe(true);
  });
});

describe("analytics helpers", () => {
  it("median handles odd, even and empty lists", () => {
    expect(median([])).toBeNull();
    expect(median([3])).toBe(3);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });

  it("measures days between the FIRST time each application reached two stages", () => {
    const day = (n: number) => `2026-09-${String(n).padStart(2, "0")}T00:00:00Z`;
    const history = [
      { application_id: "x", to_status: "wishlist", changed_at: day(1) },
      { application_id: "x", to_status: "applied", changed_at: day(2) },
      { application_id: "x", to_status: "interview", changed_at: day(8) },
      { application_id: "x", to_status: "applied", changed_at: day(20) }, // moved back and forth: the first time counts
      { application_id: "y", to_status: "applied", changed_at: day(3) },
      { application_id: "z", to_status: "applied", changed_at: day(4) },
      { application_id: "z", to_status: "interview", changed_at: day(6) },
    ];
    expect(daysBetweenFirstReaches(history, "applied", "interview").sort()).toEqual([2, 6]); // y never got an interview
    expect(daysBetweenFirstReaches(history, "applied", "offer")).toEqual([]);
  });
});

describe("createReminderSchema", () => {
  const base = { applicationId: "6f1c2c9e-1b1f-4b7e-8d3e-0c9d3a4c1a11", message: "Follow up", sendEmail: false, sendInApp: true };
  const inOneHour = new Date(Date.now() + 3_600_000).toISOString();

  it("accepts an absolute future time and normalises it to UTC", () => {
    const result = createReminderSchema.safeParse({ ...base, remindAt: inOneHour.replace("Z", "+00:00") });
    expect(result.success && result.data.remindAt).toBe(inOneHour);
  });
  it("rejects a bare local time — the server can't know the person's zone", () => {
    expect(createReminderSchema.safeParse({ ...base, remindAt: "2026-12-05T14:30" }).success).toBe(false);
  });
  it("rejects a time in the past", () => {
    const result = createReminderSchema.safeParse({ ...base, remindAt: new Date(Date.now() - 3_600_000).toISOString() });
    expect(result.success).toBe(false);
  });
  it("needs a channel and a message", () => {
    expect(createReminderSchema.safeParse({ ...base, remindAt: inOneHour, sendInApp: false, sendEmail: false }).success).toBe(false);
    expect(createReminderSchema.safeParse({ ...base, remindAt: inOneHour, message: "  " }).success).toBe(false);
  });
});
