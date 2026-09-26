import "server-only";

// The daily sync is a GitHub Actions workflow (.github/workflows/sponsors-sync.yml), not an in-app job — a full run
// is ~130k rows across hundreds of batched requests, which suits a CI runner rather than a serverless function's
// time limit. "Run sync now" therefore just asks GitHub to dispatch that same workflow.
export const SPONSOR_SYNC_WORKFLOW_FILE = "sponsors-sync.yml";

export type SponsorSyncDispatchConfig = { repo: string; token: string; ref: string };

/** Null when this deployment hasn't been given a repo + a token allowed to dispatch workflows — the admin page then says so instead of showing a button that can't work. */
export function getSponsorSyncDispatchConfig(): SponsorSyncDispatchConfig | null {
  const repo = process.env.SPONSOR_SYNC_GITHUB_REPO?.trim();
  const token = process.env.SPONSOR_SYNC_GITHUB_TOKEN?.trim();
  if (!repo || !token || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  return { repo, token, ref: process.env.SPONSOR_SYNC_GITHUB_REF?.trim() || "main" };
}
