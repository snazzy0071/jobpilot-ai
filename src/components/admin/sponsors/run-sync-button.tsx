"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerSponsorSync } from "@/lib/admin/sponsors/actions";

export function RunSyncButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await triggerSponsorSync();
    setPending(false);
    if ("error" in result) setMessage({ kind: "error", text: result.error });
    else {
      setMessage({ kind: "success", text: result.success });
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-start gap-2">
      <Button type="submit" disabled={pending || disabled}>
        {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
        Run sync now
      </Button>
      <p role="status" aria-live="polite" className="min-h-5 text-sm">
        {message?.kind === "error" && (
          <span className="flex items-center gap-1.5 text-destructive">
            <AlertCircleIcon className="size-4" /> {message.text}
          </span>
        )}
        {message?.kind === "success" && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2Icon className="size-4" /> {message.text}
          </span>
        )}
      </p>
    </form>
  );
}
