"use client";

import { startTransition } from "react";

/**
 * Calls a Server Action outside of a `<form action={...}>` submission
 * (drag-reorder, restore, and autosave all invoke their actions
 * directly). The call itself has to happen inside `startTransition` for
 * the action's `revalidatePath` to actually refresh this route's
 * already-rendered data — a plain awaited call still runs the action
 * and saves correctly, but the rest of the page can keep showing stale
 * server-fetched data without this.
 *
 * A rejected action (network failure, expired session, server error)
 * rejects this promise. It used to be swallowed, leaving the caller
 * awaiting forever with nothing shown.
 */
export function callAction<T>(action: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    startTransition(() => {
      action().then(resolve, reject);
    });
  });
}

export const ACTION_FAILED_MESSAGE =
  "Something went wrong on our side and this didn't finish. Please try again in a moment.";

/**
 * callAction(), but a rejected action (server crash, function timeout,
 * dropped connection) resolves to `{ error }` instead of throwing. Use it
 * wherever the caller shows a spinner: an unhandled rejection skipped the
 * caller's `setLoading(false)` and left buttons on "Scanning…" forever.
 */
export async function callActionOrError<T>(action: () => Promise<T>, message = ACTION_FAILED_MESSAGE): Promise<T | { error: string }> {
  try {
    return await callAction(action);
  } catch (err) {
    console.error("Server action failed:", err);
    return { error: message };
  }
}
