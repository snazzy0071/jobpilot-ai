import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobFeedError } from "@/lib/jobs/feed-error";
import type { NormalizedJobInput } from "@/lib/jobs/types";

const ingest = vi.hoisted(() => ({
  startJobImport: vi.fn(),
  completeJobImport: vi.fn(),
  failJobImport: vi.fn(),
  ingestNormalizedJobs: vi.fn(),
}));
vi.mock("@/lib/jobs/ingest", () => ingest);

// job_sources lookup only — the run itself is what's under test.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "source-1" } }) }) }),
    }),
  }),
}));

import { runJobSync, type JobFeedAdapter } from "@/lib/jobs/sync-runner";

function job(id: string): NormalizedJobInput {
  return {
    externalId: id,
    title: `Job ${id}`,
    titleNormalized: `job ${id}`,
    companyName: "Acme",
    companyNameNormalized: "acme",
    location: null,
    locationNormalized: null,
    description: "d",
    url: "https://x.test/1",
    postedAt: null,
    expiresAt: null,
  };
}

type Page = { results: unknown[] } | Error;

/** An adapter whose responses are scripted per "keywords|page". */
function scriptedAdapter(script: Record<string, Page>): JobFeedAdapter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    slug: "test",
    name: "TestFeed",
    baseUrl: "https://feed.test",
    betweenRequestsMs: 0,
    async fetchPage(search, page) {
      const key = `${search.keywords}|${page}`;
      calls.push(key);
      const entry = script[key] ?? { results: [] };
      if (entry instanceof Error) throw entry;
      return entry;
    },
    normalize(raw) {
      const item = raw as { id?: string };
      return item.id ? { job: job(item.id) } : { error: "TestFeed job without an id." };
    },
  };
}

const SEARCHES = [{ keywords: "a" }, { keywords: "b" }];

beforeEach(() => {
  vi.clearAllMocks();
  ingest.startJobImport.mockResolvedValue("import-1");
  ingest.ingestNormalizedJobs.mockImplementation(async (_s: unknown, _id: string, jobs: unknown[]) => ({ createdCount: jobs.length, updatedCount: 0, duplicateCount: 0 }));
});

describe("runJobSync", () => {
  it("walks every search and page, ingests everything and records a clean completed run", async () => {
    const adapter = scriptedAdapter({ "a|1": { results: [{ id: "1" }, { id: "2" }] }, "a|2": { results: [] }, "b|1": { results: [{ id: "3" }] } });
    const result = await runJobSync(adapter, { searches: SEARCHES, maxPages: 3 });

    expect(result).toMatchObject({ importId: "import-1", fetchedCount: 3, createdCount: 3, skippedCount: 0, warnings: [] });
    expect(adapter.calls).toEqual(["a|1", "a|2", "b|1", "b|2"]); // an empty page ends that search
    expect(ingest.ingestNormalizedJobs.mock.calls[0][2]).toHaveLength(3);
    expect(ingest.completeJobImport).toHaveBeenCalledWith(expect.anything(), "import-1", expect.objectContaining({ fetchedCount: 3 }), null);
    expect(ingest.failJobImport).not.toHaveBeenCalled();
  });

  it("records a FAILED run — and ingests nothing — when not one request succeeds", async () => {
    const adapter = scriptedAdapter({ "a|1": new JobFeedError("http", "TestFeed search failed (500): boom"), "b|1": new JobFeedError("http", "TestFeed search failed (500): boom") });
    const result = await runJobSync(adapter, { searches: SEARCHES });

    expect(result).toEqual({ error: expect.stringContaining("500") });
    expect(ingest.failJobImport).toHaveBeenCalledWith(expect.anything(), "import-1", expect.stringContaining("500"));
    expect(ingest.ingestNormalizedJobs).not.toHaveBeenCalled();
    expect(ingest.completeJobImport).not.toHaveBeenCalled();
  });

  it("stops the whole run on a fatal error (rejected key) instead of hammering the provider", async () => {
    const adapter = scriptedAdapter({ "a|1": new JobFeedError("auth", "TestFeed rejected the API credentials (401)") });
    const result = await runJobSync(adapter, { searches: SEARCHES });

    expect("error" in result).toBe(true);
    expect(adapter.calls).toEqual(["a|1"]); // never tried search "b"
    expect(ingest.failJobImport).toHaveBeenCalledOnce();
  });

  it("keeps what was fetched when a later request fails, and completes the run WITH a warning", async () => {
    const adapter = scriptedAdapter({
      "a|1": { results: [{ id: "1" }] },
      "a|2": new JobFeedError("network", "Couldn't reach TestFeed."),
      "b|1": { results: [{ id: "2" }] },
    });
    const result = await runJobSync(adapter, { searches: SEARCHES, maxPages: 2 });

    if ("error" in result) throw new Error(result.error);
    expect(result.createdCount).toBe(2);
    expect(result.warnings).toEqual([expect.stringContaining("Couldn't reach TestFeed")]);
    expect(ingest.completeJobImport).toHaveBeenCalledWith(expect.anything(), "import-1", expect.anything(), expect.stringContaining("Couldn't reach TestFeed"));
    expect(ingest.failJobImport).not.toHaveBeenCalled();
  });

  it("stops after a fatal error mid-run but still ingests what it already had", async () => {
    const adapter = scriptedAdapter({ "a|1": { results: [{ id: "1" }] }, "a|2": new JobFeedError("rate_limit", "TestFeed rate limit exceeded") });
    const result = await runJobSync(adapter, { searches: SEARCHES, maxPages: 2 });

    if ("error" in result) throw new Error(result.error);
    expect(result.createdCount).toBe(1);
    expect(adapter.calls).toEqual(["a|1", "a|2"]);
    expect(result.warnings[0]).toContain("rate limit");
  });

  it("counts malformed listings as skipped, with a sample, without failing the run", async () => {
    const adapter = scriptedAdapter({ "a|1": { results: [{ id: "1" }, {}, {}] } });
    const result = await runJobSync(adapter, { searches: [{ keywords: "a" }] });

    if ("error" in result) throw new Error(result.error);
    expect(result).toMatchObject({ fetchedCount: 3, skippedCount: 2, createdCount: 1 });
    expect(result.warnings[0]).toMatch(/2 listings skipped as malformed/);
  });

  it("stops starting requests once its time budget is spent, and says so", async () => {
    const adapter = scriptedAdapter({ "a|1": { results: [{ id: "1" }] } });
    const result = await runJobSync(adapter, { searches: SEARCHES, timeBudgetMs: 0 });

    expect(adapter.calls).toEqual([]);
    expect(result).toEqual({ error: expect.stringContaining("time budget") });
  });

  it("records a failed run if saving the fetched jobs fails", async () => {
    ingest.ingestNormalizedJobs.mockRejectedValueOnce(new Error("Couldn't save new jobs: disk full"));
    const adapter = scriptedAdapter({ "a|1": { results: [{ id: "1" }] } });
    const result = await runJobSync(adapter, { searches: [{ keywords: "a" }] });

    expect(result).toEqual({ error: expect.stringContaining("disk full") });
    expect(ingest.failJobImport).toHaveBeenCalledWith(expect.anything(), "import-1", expect.stringContaining("disk full"));
  });
});
