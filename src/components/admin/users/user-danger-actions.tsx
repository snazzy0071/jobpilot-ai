"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function DeleteAccountButton({ userId, label }: { userId: string; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Permanently delete ${label}'s account? This can't be undone.`)) return;
    setPending(true);
    const formData = new FormData();
    formData.set("userId", userId);
    const result = await deleteUserAccountByAdmin(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.push("/admin/users");
    router.refresh();
  }

  return (
    <Button variant="destructive" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
      Delete account
    </Button>
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
