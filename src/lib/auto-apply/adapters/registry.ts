import { assistedAdapter } from "@/lib/auto-apply/adapters/assisted";
import type { ApplyAdapter } from "@/lib/auto-apply/adapters/types";

/**
 * The adapters JobPilot really ships. Today that is only the assisted fallback: none of the job sources the feed uses (Adzuna, Reed)
 * offers an application API, and automating employers' own forms would mean getting around their protections, which this feature
 * never does. Every application therefore ends with the user applying on the employer's site. A submitting adapter is added here
 * — and only here — once a destination offers a sanctioned way to receive applications.
 */
export const PRODUCTION_ADAPTERS: readonly ApplyAdapter[] = [assistedAdapter];

/** The first submitting adapter that supports the destination, else the assisted fallback. `adapters` is injectable for tests. */
export function resolveAdapter(applyUrl: string, adapters: readonly ApplyAdapter[] = PRODUCTION_ADAPTERS): ApplyAdapter {
  return adapters.find((adapter) => adapter.canSubmit && adapter.supports(applyUrl)) ?? assistedAdapter;
}
