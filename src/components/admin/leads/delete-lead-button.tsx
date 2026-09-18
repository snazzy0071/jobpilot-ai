"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeleteAction = (prevState: unknown, formData: FormData) => Promise<{ error: string } | undefined | void>;

export function DeleteLeadButton({ id, action, label }: { id: string; action: DeleteAction; label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Delete this ${label}? This can't be undone.`)) return;
    setPending(true);
    const formData = new FormData();
    formData.set("id", id);
    const result = await action(undefined, formData);
    setPending(false);
    if (result && "error" in result) {
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${label}`} onClick={handleClick} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
    </Button>
  );
}
