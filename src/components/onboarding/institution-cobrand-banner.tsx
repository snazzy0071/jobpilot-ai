import type { CurrentInstitutionBranding } from "@/lib/institutions/queries";

const DEFAULT_ACCENT = "#4f46e5";

/**
 * Co-branded onboarding for a student who belongs to an institution —
 * shown alongside JobPilot's own logo, never in place of it. Colour is
 * applied only via this component's own inline `style`, keyed off an
 * institution's own `institutions.primary_color` (migration 0072) —
 * never written to `:root` or any global CSS variable, so it can't
 * leak into the rest of the app's theme or any other user's session.
 * A logo failing to load falls back to the institution's plain name —
 * never a broken-image icon.
 */
export function InstitutionCobrandBanner({ institution }: { institution: CurrentInstitutionBranding }) {
  const accent = institution.primaryColor ?? DEFAULT_ACCENT;

  return (
    <div className="w-full max-w-lg rounded-xl border p-4" style={{ borderColor: accent }}>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>JobPilot AI</span>
        <span aria-hidden="true" style={{ color: accent }}>
          ×
        </span>
        {institution.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- an institution-supplied external logo URL, not a local/optimizable asset.
          <img src={institution.logoUrl} alt={institution.name} className="h-5 w-auto" />
        ) : (
          <span className="font-medium text-foreground">{institution.name}</span>
        )}
      </div>
      {institution.welcomeMessage && <p className="mt-2 text-center text-sm">{institution.welcomeMessage}</p>}
    </div>
  );
}
