// Pure helpers behind the editor's save indicator and autosave. No React,
// no server code: shared by the client hooks and covered by
// save-status.test.ts.

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type SourceState = { status: SaveStatus; message: string | null };

/**
 * One status for the whole editor from every save source (each section
 * form's autosave, the template save, reorders...). Anything still
 * saving wins over an old error (the retry might be about to fix it), an
 * error wins over "saved" (a failure is never hidden behind a later
 * success elsewhere), and "saved" only shows once something has actually
 * been saved.
 */
export function deriveOverallStatus(sources: Iterable<SourceState>): SourceState {
  let saving = false;
  let saved = false;
  let error: string | null = null;
  for (const source of sources) {
    if (source.status === "saving") saving = true;
    else if (source.status === "error") error = error ?? source.message ?? "Couldn't save your changes.";
    else if (source.status === "saved") saved = true;
  }
  if (saving) return { status: "saving", message: null };
  if (error) return { status: "error", message: error };
  if (saved) return { status: "saved", message: null };
  return { status: "idle", message: null };
}

/**
 * A brand-new row is inserted by its first save; the row's real id only
 * comes back in that save's result. Any edit typed while that insert was
 * still in flight was snapshotted *without* an id, and sending it as-is
 * would insert a second, duplicate row. This stamps the known id onto a
 * pending snapshot that lacks one, so it becomes an update of the row
 * the first save created.
 */
export function carryRowId(formData: FormData, savedId: string | null): FormData {
  if (savedId && !formData.get("id")) formData.set("id", savedId);
  return formData;
}

/**
 * A role/course/project that is current (or ongoing) has no end date, and the
 * server rejects the combination. Ticking the box fires two handlers — the
 * checkbox's own, and the form-level change handler, which re-reads the DOM
 * where the end-date field is still mounted for one more render — so a
 * snapshot could carry both a ticked box and the old end date, fail
 * validation, and the tick would never save. Every snapshot goes through
 * this, so however it was built it can't hold both.
 */
export function dropEndDateWhenOngoing(formData: FormData, flag: "isCurrent" | "isOngoing"): FormData {
  if (formData.get(flag) === "on") formData.delete("endDate");
  return formData;
}
