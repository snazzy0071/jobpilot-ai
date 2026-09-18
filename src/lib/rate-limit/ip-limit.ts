import "server-only";
import { getRequestIp } from "@/lib/rate-limit/request-ip";
import { getFixedWindowStart } from "@/lib/rate-limit/windows";
import { consumeAnonymousRateLimit } from "@/lib/rate-limit/store";

/**
 * The common case for a public, unauthenticated surface: "N requests per
 * fixed window, per IP." An IP that can't be determined is let through
 * — same tradeoff src/lib/quick-scan/rate-limit.ts's own
 * consumeQuickScanPdfRateLimit already makes: this is defense in depth,
 * not the only thing standing between the surface and abuse (a real
 * validation/entitlement/secret check still guards the actual work),
 * so failing open on a merely-unknown IP is the right default — failing
 * closed belongs to consumeAnonymousRateLimit's own already-fail-closed
 * behavior when the durable store itself can't be reached.
 */
export async function consumeIpRateLimit(scope: string, options: { windowSeconds: number; maxRequests: number }): Promise<boolean> {
  const ip = await getRequestIp();
  if (!ip) return true;

  const outcome = await consumeAnonymousRateLimit(scope, ip, getFixedWindowStart(options.windowSeconds), options.maxRequests);
  return outcome.allowed;
}

/**
 * For a scheduled/system-triggered surface with no per-caller identity
 * to key off at all (a CRON_SECRET-gated route meant to be hit by one
 * scheduler, not many independent visitors) — `scope` alone is the key,
 * via a fixed sentinel value. Defense in depth against a leaked secret
 * or a misfiring duplicate trigger causing a run-storm, not a
 * replacement for the secret check itself.
 */
export async function consumeSystemRateLimit(scope: string, options: { windowSeconds: number; maxRequests: number }): Promise<boolean> {
  const outcome = await consumeAnonymousRateLimit(scope, "system", getFixedWindowStart(options.windowSeconds), options.maxRequests);
  return outcome.allowed;
}
