import type { AdapterOutcome, ApplyAdapter, ApplyPackage } from "@/lib/auto-apply/adapters/types";

/**
 * The fallback for every destination: JobPilot prepares the application (the CV and cover letter the user chose, the link) and the
 * USER applies on the employer's own site. It submits nothing and touches no site — which is why it is safe for any URL — and the
 * user's confirmation ("I've applied") is what logs it to the tracker.
 */
export const assistedAdapter: ApplyAdapter = {
  id: "assisted",
  label: "Assisted (you apply on the employer's site)",
  canSubmit: false,
  supports: () => true,
  async apply(pkg: ApplyPackage): Promise<AdapterOutcome> {
    void pkg;
    return { kind: "manual_required", reason: "Open the employer's page and apply yourself — your CV and cover letter choices are ready." };
  },
};
