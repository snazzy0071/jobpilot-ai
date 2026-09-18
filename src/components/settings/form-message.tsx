import type { SettingsResult } from "@/lib/settings/actions";

export function FormMessage({ state }: { state: SettingsResult | undefined }) {
  if (!state) return null;
  // role="alert" is what actually announces this to a screen reader —
  // without it, the DOM changes silently on submit (WCAG 4.1.3, and
  // the exact gap a real audit found here: every other error/success
  // message pattern in the app already does this).
  if ("error" in state) return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  if ("success" in state) {
    return (
      <p role="status" aria-live="polite" className="text-sm text-success">
        {state.success}
      </p>
    );
  }
  return null;
}
