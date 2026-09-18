type ActionResult = { error: string } | { success: string } | void;

/** Shared by every CV list/editor form — all of them return the same {error}|{success}|void shape. */
export function CvFormMessage({ state }: { state: ActionResult | undefined }) {
  if (!state) return null;
  // role="alert" announces this to a screen reader — see
  // src/components/settings/form-message.tsx's identical fix for the
  // full reasoning.
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
