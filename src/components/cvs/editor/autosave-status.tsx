import { Loader2Icon, CheckIcon, AlertCircleIcon } from "lucide-react";
import type { AutosaveStatus as Status } from "@/components/cvs/editor/use-autosave";

export function AutosaveStatus({ status, errorMessage }: { status: Status; errorMessage: string | null }) {
  if (status === "idle") return null;

  if (status === "saving") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <Loader2Icon className="size-3.5 animate-spin" /> Saving…
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
        <AlertCircleIcon className="size-3.5" /> {errorMessage ?? "Couldn't save — try again."}
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
      <CheckIcon className="size-3.5 text-success" /> Saved
    </p>
  );
}
