import "server-only";
import { headers } from "next/headers";

/**
 * `x-forwarded-for`'s first entry is the original client per the usual
 * reverse-proxy convention; null if neither header is present (some
 * local/dev setups) rather than guessing. Shared by every IP-keyed rate
 * limit in this app (previously duplicated only in
 * src/lib/quick-scan/rate-limit.ts; now the one implementation).
 */
export async function getRequestIp(): Promise<string | null> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headerList.get("x-real-ip")?.trim();
  return realIp || null;
}
