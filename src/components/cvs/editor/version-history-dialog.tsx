"use client";

import { useState, useTransition } from "react";
import { HistoryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

export type VersionHistoryEntry = {
  id: string;
  versionNumber: number;
  label: string | null;
  isCurrent: boolean;
  createdAt: string;
};

type RestoreResult = { error: string } | { success: string } | void;
type RestoreAction = (prevState: RestoreResult, formData: FormData) => Promise<RestoreResult>;

function formatVersionDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function RestoreButton({
  versionId,
  restore,
  containerIdField,
  containerId,
  onRestored,
}: {
  versionId: string;
  restore: RestoreAction;
  containerIdField: string;
  containerId: string;
  onRestored: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRestore() {
    const formData = new FormData();
    formData.set(containerIdField, containerId);
    formData.set("versionId", versionId);
    startTransition(async () => {
      const result = await restore(undefined, formData);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      onRestored();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={handleRestore}>
        {pending ? "Restoring..." : "Restore"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * The "recover" half of recoverable version history — reused by both
 * the CV editor and the cover letter editor. Lists every version
 * (including the automatic snapshots each editor's own
 * ensureHistorySnapshot-style helper creates as edits are autosaved) and
 * lets the user restore an older one. Restoring makes it current again;
 * nothing here ever deletes a version.
 *
 * `restore` must be the real Server Action reference (e.g.
 * `restoreVersion`/`restoreCoverLetterVersion`), not a closure defined
 * in the calling Server Component — a plain function can't cross the
 * server/client boundary, only a real "use server" reference can.
 * `containerIdField`/`containerId` (e.g. "cvId"/data.cvId or
 * "coverLetterId"/data.coverLetterId) are passed separately so this
 * component stays agnostic to which schema a caller's versions live in.
 */
export function VersionHistoryDialog({
  versions,
  restore,
  containerIdField,
  containerId,
}: {
  versions: VersionHistoryEntry[];
  restore: RestoreAction;
  containerIdField: string;
  containerId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <HistoryIcon /> Version history
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Snapshots are taken automatically as you edit. Restoring makes an older version current again — nothing is
            deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {versions.map((version) => (
            <div key={version.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{version.label ?? `Version ${version.versionNumber}`}</p>
                  {version.isCurrent && (
                    <Badge variant="secondary" className="text-xs font-normal">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatVersionDate(version.createdAt)}</p>
              </div>
              {!version.isCurrent && (
                <RestoreButton
                  versionId={version.id}
                  restore={restore}
                  containerIdField={containerIdField}
                  containerId={containerId}
                  onRestored={() => setOpen(false)}
                />
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
