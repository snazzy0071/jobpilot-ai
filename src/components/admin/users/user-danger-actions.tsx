"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { cancelUserSubscriptionByAdmin, deleteUserAccountByAdmin } from "@/lib/admin/users/actions";
import { startImpersonation } from "@/lib/admin/impersonation/actions";

/**
 * Redirects to /dashboard on success (startImpersonation() itself
 * calls redirect()), so there's no success case to handle here beyond
 * letting the browser navigate — only the error path needs a manual
 * result check, same shape as the other buttons in this file.
 */
function ViewAsUserButton({ userId, label }: { userId: string; label: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`View the dashboard as ${label}? You won't need their password, and this is fully logged.`)) return;
    setPending(true);
    const formData = new FormData();
    formData.set("targetUserId", userId);
    const result = await startImpersonation(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : <EyeIcon className="size-4" />}
      View as user
    </Button>
  );
}

function CancelSubscriptionButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm("Cancel this subscription at period end? This calls Stripe directly — the same cancellation the user could trigger themselves.")) return;
    setPending(true);
    const formData = new FormData();
    formData.set("userId", userId);
    const result = await cancelUserSubscriptionByAdmin(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      Cancel subscription at period end
    </Button>
  );
}

/**
 * Split from its trigger (DeleteAccountButton below) so the completion effect calls `onOpenChange` — a prop, not
 * the local `useState` setter directly — the same separation CvCard's DeleteAlert uses and for the same reason
 * (react-hooks/set-state-in-effect only flags a component calling a `useState` setter it owns itself inside an
 * effect, not calling a callback prop).
 */
function DeleteAccountDialog({ userId, label, open, onOpenChange }: { userId: string; label: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteUserAccountByAdmin, undefined);

  useEffect(() => {
    if (state === undefined) return; // initial state, not a completed submit
    if (state && "error" in state) return; // stays open, error shown inline below
    onOpenChange(false);
    router.push("/admin/users");
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}&rsquo;s account?</AlertDialogTitle>
          <AlertDialogDescription>This permanently deletes the account and everything in it. This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        {state && "error" in state && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="userId" value={userId} />
            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** A real styled AlertDialog, not a native window.confirm() — the account's most destructive action gets the most deliberate confirmation. */
function DeleteAccountButton({ userId, label }: { userId: string; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      <DeleteAccountDialog userId={userId} label={label} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function UserDangerActions({
  userId,
  label,
  role,
  hasCancellableSubscription,
}: {
  userId: string;
  label: string;
  role: string;
  hasCancellableSubscription: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Only ever offered for a plain 'user' account — an admin or
          institution_admin target is rejected server-side regardless
          (startImpersonationSession, plus the database trigger from
          migration 0087), but there's no reason to show a button that
          would just error for those roles. */}
      {role === "user" && <ViewAsUserButton userId={userId} label={label} />}
      {hasCancellableSubscription && <CancelSubscriptionButton userId={userId} />}
      <DeleteAccountButton userId={userId} label={label} />
    </div>
  );
}
