import { createHash, timingSafeEqual } from "node:crypto";

/** True when `header` is exactly `Bearer <secret>`. Compared in constant time (over fixed-length digests) so the check leaks nothing about how much of a guess was right. */
export function isBearerMatch(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}
