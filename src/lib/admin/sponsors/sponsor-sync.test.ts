import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveSponsorSyncState, SPONSOR_SYNC_STALE_AFTER_HOURS, SPONSOR_SYNC_STUCK_AFTER_MINUTES } from "@/lib/admin/sponsors/sync-state";
import { getSponsorSyncDispatchConfig } from "@/lib/admin/sponsors/dispatch-config";

const NOW = Date.parse("2026-09-25T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe("deriveSponsorSyncState", () => {
  it("is 'never' when nothing has ever completed", () => {
    expect(deriveSponsorSyncState({ latestStatus: null, latestStartedAt: null, lastCompletedAt: null, now: NOW })).toBe("never");
  });

  it("is 'ok' after a recent completed sync", () => {
    expect(deriveSponsorSyncState({ latestStatus: "completed", latestStartedAt: hoursAgo(9), lastCompletedAt: hoursAgo(9), now: NOW })).toBe("ok");
  });

  it("is 'stale' once the last completed sync is older than the window — even if the last run 'completed'", () => {
    expect(deriveSponsorSyncState({ latestStatus: "completed", latestStartedAt: hoursAgo(50), lastCompletedAt: hoursAgo(SPONSOR_SYNC_STALE_AFTER_HOURS + 1), now: NOW })).toBe("stale");
    expect(deriveSponsorSyncState({ latestStatus: "completed", latestStartedAt: hoursAgo(30), lastCompletedAt: hoursAgo(SPONSOR_SYNC_STALE_AFTER_HOURS - 1), now: NOW })).toBe("ok");
  });

  it("reports a failed newest run over an otherwise fresh completed one", () => {
    expect(deriveSponsorSyncState({ latestStatus: "failed", latestStartedAt: hoursAgo(1), lastCompletedAt: hoursAgo(20), now: NOW })).toBe("failed");
  });

  it("is 'running' while a run is in progress, but a run stuck past the limit no longer counts as running", () => {
    expect(deriveSponsorSyncState({ latestStatus: "processing", latestStartedAt: minutesAgo(5), lastCompletedAt: hoursAgo(20), now: NOW })).toBe("running");
    expect(
      deriveSponsorSyncState({ latestStatus: "processing", latestStartedAt: minutesAgo(SPONSOR_SYNC_STUCK_AFTER_MINUTES + 5), lastCompletedAt: hoursAgo(20), now: NOW }),
    ).toBe("ok");
    expect(
      deriveSponsorSyncState({ latestStatus: "processing", latestStartedAt: minutesAgo(SPONSOR_SYNC_STUCK_AFTER_MINUTES + 5), lastCompletedAt: hoursAgo(40), now: NOW }),
    ).toBe("stale");
  });
});

describe("getSponsorSyncDispatchConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is null unless both the repo and token are set", () => {
    vi.stubEnv("SPONSOR_SYNC_GITHUB_REPO", "");
    vi.stubEnv("SPONSOR_SYNC_GITHUB_TOKEN", "");
    expect(getSponsorSyncDispatchConfig()).toBeNull();
    vi.stubEnv("SPONSOR_SYNC_GITHUB_REPO", "acme/jobpilot");
    expect(getSponsorSyncDispatchConfig()).toBeNull();
  });

  it("rejects a repo that isn't owner/name (it ends up in an API URL)", () => {
    vi.stubEnv("SPONSOR_SYNC_GITHUB_TOKEN", "t");
    for (const repo of ["acme", "acme/jobpilot/extra", "acme/../x", "https://github.com/acme/jobpilot"]) {
      vi.stubEnv("SPONSOR_SYNC_GITHUB_REPO", repo);
      expect(getSponsorSyncDispatchConfig(), repo).toBeNull();
    }
  });

  it("defaults the ref to main", () => {
    vi.stubEnv("SPONSOR_SYNC_GITHUB_REPO", "acme/jobpilot");
    vi.stubEnv("SPONSOR_SYNC_GITHUB_TOKEN", "t");
    vi.stubEnv("SPONSOR_SYNC_GITHUB_REF", "");
    expect(getSponsorSyncDispatchConfig()).toEqual({ repo: "acme/jobpilot", token: "t", ref: "main" });
    vi.stubEnv("SPONSOR_SYNC_GITHUB_REF", "release");
    expect(getSponsorSyncDispatchConfig()?.ref).toBe("release");
  });
});
