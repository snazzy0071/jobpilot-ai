"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { CopyIcon, ArchiveIcon, ArchiveRestoreIcon, Trash2Icon, PencilIcon } from "lucide-react";
import { renameCv, duplicateCv, archiveCv, unarchiveCv, deleteCv, type CvActionResult } from "@/lib/cvs/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { CvFormMessage } from "@/components/cvs/form-message";
import { CvThumbnail } from "@/components/cvs/cv-thumbnail";
import { getCvTemplate } from "@/config/cv-templates";
import { scoreTone } from "@/lib/quick-scan/score-tone";
import type { CvListItemWithPreview } from "@/lib/cvs/queries";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return `Updated ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function RenameDialog({
  cv,
  open,
  onOpenChange,
}: {
  cv: CvListItemWithPreview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<CvActionResult, FormData>(renameCv, undefined);

  useEffect(() => {
    if (state && "success" in state) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename CV</DialogTitle>
          <DialogDescription>Give this CV a new name.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="cvId" value={cv.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`title-${cv.id}`}>Title</Label>
            <Input id={`title-${cv.id}`} name="title" required maxLength={200} defaultValue={cv.title} autoFocus />
          </div>
          <CvFormMessage state={state} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAlert({
  cv,
  open,
  onOpenChange,
}: {
  cv: CvListItemWithPreview;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState<CvActionResult, FormData>(deleteCv, undefined);

  useEffect(() => {
    if (state && "success" in state) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{cv.title}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes this CV and every version of it. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <CvFormMessage state={state} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="cvId" value={cv.id} />
            <AlertDialogAction type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * reference/auth/cv-builder.png's card: a real thumbnail of the CV
 * itself (CvThumbnail — the user's actual saved content, not a stock
 * image) with a compact icon-action strip above it, then title/updated-
 * at/badges below. The reference also shows a "Set as primary" action
 * and "Imported"/"Primary" badges — dropped here since neither a
 * primary-CV concept nor a resume-import-to-CV feature exists in this
 * app yet; adding real icon buttons for the CRUD this app does have
 * (rename/duplicate/archive/delete) instead of inventing controls for
 * features that aren't built, per this project's no-fake-buttons rule.
 */
export function CvCard({ cv }: { cv: CvListItemWithPreview }) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateState, duplicateAction, duplicatePending] = useActionState<CvActionResult, FormData>(
    duplicateCv,
    undefined,
  );
  const [archiveState, archiveAction, archivePending] = useActionState<CvActionResult, FormData>(
    cv.isArchived ? unarchiveCv : archiveCv,
    undefined,
  );

  const errorMessage =
    (duplicateState && "error" in duplicateState && duplicateState.error) ||
    (archiveState && "error" in archiveState && archiveState.error) ||
    null;

  return (
    <Card variant="feature" className="gap-3 overflow-hidden p-0" size="sm">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        {cv.isArchived ? (
          <Badge variant="outline" className="text-[10px]">
            Archived
          </Badge>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Rename CV" onClick={() => setRenameOpen(true)}>
            <PencilIcon />
          </Button>

          <form action={duplicateAction}>
            <input type="hidden" name="cvId" value={cv.id} />
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Duplicate CV" disabled={duplicatePending}>
              <CopyIcon />
            </Button>
          </form>

          <form action={archiveAction}>
            <input type="hidden" name="cvId" value={cv.id} />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label={cv.isArchived ? "Restore CV" : "Archive CV"}
              disabled={archivePending}
            >
              {cv.isArchived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
            </Button>
          </form>

          <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete CV" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon className="text-destructive" />
          </Button>
        </div>
      </div>

      <Link href={`/dashboard/cvs/${cv.id}`} className="block px-3">
        <CvThumbnail template={cv.template} data={cv.previewData} />
      </Link>

      <div className="flex flex-col gap-1 px-3 pb-3">
        <Link href={`/dashboard/cvs/${cv.id}`} className="line-clamp-1 font-heading text-sm font-semibold hover:underline">
          {cv.title}
        </Link>
        <p className="text-xs text-muted-foreground">{formatUpdatedAt(cv.updatedAt)}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="secondary" className="text-[10px]">
            {getCvTemplate(cv.template).name}
          </Badge>
          {cv.atsScore !== null && (
            <Badge variant="outline" className={`text-[10px] font-semibold ${scoreTone(cv.atsScore)}`}>
              {cv.atsScore}/100
            </Badge>
          )}
        </div>
      </div>

      {errorMessage && <p className="px-3 pb-3 text-sm text-destructive">{errorMessage}</p>}

      <RenameDialog cv={cv} open={renameOpen} onOpenChange={setRenameOpen} />
      <DeleteAlert cv={cv} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </Card>
  );
}
