import "server-only";
import { cookies } from "next/headers";
import { CONSENT_COOKIE_NAME, parseConsentCookie } from "@/lib/consent/cookie";
import type { ConsentCategory, ConsentState } from "@/lib/consent/types";

export async function getConsentState(): Promise<ConsentState> {
  const store = await cookies();
  return parseConsentCookie(store.get(CONSENT_COOKIE_NAME)?.value);
}

/**
 * The one gate every optional (non-essential) tracking script must be
 * conditioned on before it's ever rendered — necessary cookies (auth,
 * this consent choice itself) need no gate at all, only `analytics` and
 * `marketing` do. Checking this from a Server Component, and rendering
 * the `<script>`/`<Script>` tag only when it resolves `true`, is what
 * actually satisfies "never load optional tracking before consent": the
 * tag itself never reaches the page's HTML — let alone requests
 * anything — until this returns `true`, rather than being rendered
 * unconditionally and merely suppressed client-side after the fact
 * (which the browser may already have started fetching by then).
 *
 * No analytics or marketing script is wired into this app yet
 * (docs/BUILD_CHECKLIST.md's Cookie Policy is accurate: today's only
 * cookie is this consent choice itself, which is strictly necessary).
 * This exists so that the day one is added, it has a real gate to go
 * through instead of one being bolted on retroactively.
 */
export async function hasConsent(category: ConsentCategory): Promise<boolean> {
  const state = await getConsentState();
  return state[category] === true;
}
