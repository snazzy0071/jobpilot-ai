// The template-selection state machine, kept free of React so its
// ordering rules can be tested directly (template-saver.test.ts).

type SaveError = { error: string } | null;

/**
 * Optimistic template switching with one authoritative persisted value.
 *
 * - `select()` shows the new template immediately (`onOptimistic`) and
 *   queues a save.
 * - Saves are strictly serialised and coalesced: choosing A → B → C
 *   quickly saves at most A→B then C, never out of order, so the last
 *   choice is always what ends up in the database.
 * - If a save fails, the preview is reverted to the last value that IS
 *   persisted (`onRevert`) and the error surfaced — the preview never
 *   keeps showing a template the database doesn't have.
 * - `whenIdle()` resolves once nothing is queued or in flight (export
 *   waits on this so the PDF can't be generated from a stale template).
 */
export function createTemplateSaver<T extends string>(options: {
  initial: T;
  persist: (template: T) => Promise<SaveError>;
  onOptimistic: (template: T) => void;
  onRevert: (template: T, message: string) => void;
  onStatus?: (status: "saving" | "saved" | "error", message: string | null) => void;
}) {
  let persisted = options.initial;
  let requested = options.initial;
  let draining: Promise<SaveError> | null = null;

  async function drain(): Promise<SaveError> {
    let failure: SaveError = null;
    while (persisted !== requested) {
      const target = requested;
      options.onStatus?.("saving", null);
      let result: SaveError;
      try {
        result = await options.persist(target);
      } catch (error) {
        result = { error: error instanceof Error ? error.message : "Couldn't save the template." };
      }
      if (result && requested !== target) {
        // A newer choice arrived while this one was being saved (or failing): that newer one is what the user
        // actually wants, so carry on with it rather than reverting to a state nobody asked for.
        continue;
      }
      if (result) {
        failure = result;
        requested = persisted;
        options.onRevert(persisted, result.error);
        options.onStatus?.("error", result.error);
        break;
      }
      persisted = target;
    }
    if (!failure) options.onStatus?.("saved", null);
    return failure;
  }

  return {
    select(template: T) {
      requested = template;
      options.onOptimistic(template);
      if (!draining) {
        draining = drain().finally(() => {
          draining = null;
        });
      }
    },
    /** The server rendered a newer persisted template (after a revalidation) — adopt it unless a save is mid-flight. */
    adopt(template: T) {
      if (!draining && persisted === requested) {
        persisted = template;
        requested = template;
      }
    },
    persisted: () => persisted,
    async whenIdle(): Promise<SaveError> {
      let last: SaveError = null;
      while (draining) last = await draining;
      return last;
    },
  };
}
