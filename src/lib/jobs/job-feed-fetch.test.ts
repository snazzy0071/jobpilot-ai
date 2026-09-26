import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFeedJson, requireResultsArray } from "@/lib/jobs/adapters/feed-fetch";
import { JobFeedError } from "@/lib/jobs/feed-error";

const URL_WITH_SECRET = new URL("https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=ID&app_key=SECRETKEY");

function respond(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

async function failureOf(promise: Promise<unknown>): Promise<JobFeedError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof JobFeedError) return err;
    throw err;
  }
  throw new Error("expected the call to fail");
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchFeedJson — feed error handling", () => {
  it("returns the parsed body on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, JSON.stringify({ results: [{ id: 1 }] }))));
    await expect(fetchFeedJson("Adzuna", URL_WITH_SECRET, {})).resolves.toEqual({ results: [{ id: 1 }] });
  });

  it("classifies a rejected key as fatal 'auth'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(401, "Invalid app_id or app_key")));
    const error = await failureOf(fetchFeedJson("Adzuna", URL_WITH_SECRET, {}));
    expect(error.kind).toBe("auth");
    expect(error.isFatal).toBe(true);
  });

  it("retries a 429 with backoff and succeeds when the provider recovers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(429, "slow down", { "retry-after": "0" }))
      .mockResolvedValueOnce(respond(200, JSON.stringify({ results: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchFeedJson("Reed", URL_WITH_SECRET, {})).resolves.toEqual({ results: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up on a 429 that outlasts the retries, as a fatal 'rate_limit'", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(respond(429, "slow down", { "retry-after": "0" })));
    vi.stubGlobal("fetch", fetchMock);
    const error = await failureOf(fetchFeedJson("Reed", URL_WITH_SECRET, {}, { maxRetries: 2 }));
    expect(error.kind).toBe("rate_limit");
    expect(error.isFatal).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("treats a 500 as a non-fatal 'http' failure (other searches may still work)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(500, "upstream exploded")));
    const error = await failureOf(fetchFeedJson("Adzuna", URL_WITH_SECRET, {}));
    expect(error.kind).toBe("http");
    expect(error.isFatal).toBe(false);
    expect(error.message).toContain("500");
  });

  it("classifies a timeout and a connection failure as 'network'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "TimeoutError" })));
    expect((await failureOf(fetchFeedJson("Reed", URL_WITH_SECRET, {}))).message).toMatch(/didn't respond in time/);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect((await failureOf(fetchFeedJson("Reed", URL_WITH_SECRET, {}))).kind).toBe("network");
  });

  it("rejects a 200 that isn't JSON, and a JSON body with no results list, as 'bad_response'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, "<html>maintenance</html>")));
    expect((await failureOf(fetchFeedJson("Adzuna", URL_WITH_SECRET, {}))).kind).toBe("bad_response");
    expect(() => requireResultsArray("Adzuna", { error: "oops" })).toThrow(/no results list/);
    expect(requireResultsArray("Adzuna", { results: [] })).toEqual([]);
  });

  it("never puts the request URL (and so the credentials) in any error message", async () => {
    for (const response of [respond(401, "x"), respond(500, "x"), respond(200, "not json")]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      const error = await failureOf(fetchFeedJson("Adzuna", URL_WITH_SECRET, {}));
      expect(error.message).not.toContain("SECRETKEY");
      expect(error.message).not.toContain("app_key");
    }
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError(`failed ${URL_WITH_SECRET.toString()}`)));
    expect((await failureOf(fetchFeedJson("Adzuna", URL_WITH_SECRET, {}))).message).not.toContain("SECRETKEY");
  });
});
