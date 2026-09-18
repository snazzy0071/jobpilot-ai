// A sponsorship status is only as good as the last time someone
// actually rechecked it (migration 0056/0057's verified_at column) —
// this is the one shared threshold that decides when that recheck is
// old enough to flag, so the public page, the admin list, and the
// import summary can't quietly disagree with each other about what
// "stale" means.
export const STALE_AFTER_DAYS = 180;

export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isStale(verifiedAt: string): boolean {
  return daysSince(verifiedAt) > STALE_AFTER_DAYS;
}
