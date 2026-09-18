"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelUserSubscriptionByAdmin, deleteUserAccountByAdmin } from "@/lib/admin/users/actions";

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

export function UserDangerActions({ userId, label, hasCancellableSubscription }: { userId: string; label: string; hasCancellableSubscription: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {hasCancellableSubscription && <CancelSubscriptionButton userId={userId} />}
      <DeleteAccountButton userId={userId} label={label} />
    </div>
  );
}
