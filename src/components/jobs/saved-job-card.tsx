"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Building2, CheckCircle2Icon, ExternalLink, Loader2Icon, TrashIcon, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JobTrackerButton } from "@/components/jobs/job-tracker-button";
import { removeSavedJob, updateSavedJobNotes } from "@/lib/jobs/wishlist/actions";
import type { SavedJobListItem } from "@/lib/jobs/wishlist/queries";

const SPONSOR_LABELS: Record<SavedJobListItem["sponsorStatus"], string | null> = {
  confirmed_sponsor: "Licensed sponsor when saved",
  unconfirmed: "Sponsor unconfirmed when saved",
  not_found: null,
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

/**
 * One saved job. Everything shown about the job (company, title, link, sponsor status, match score) is the snapshot
 * taken when it was saved, so it stays meaningful after the listing expires; whether the listing is still live is
 * read fresh. The user's own note is the one editable field.
 */
export function SavedJobCard({ item }: { item: SavedJobListItem }) {
  const router = useRouter();
  const [notes, setNotes] = useState(item.notes ?? "");
  const [savedNotes, setSavedNotes] = useState(item.notes ?? "");
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notesError, setNotesError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleSaveNotes() {
    setNotesState("saving");
    setNotesError(null);
    const result = await updateSavedJobNotes({ savedJobId: item.id, notes });
    if ("error" in result) {
      setNotesState("error");
      setNotesError(result.error);
      return;
    }
    setSavedNotes(result.notes ?? "");
    setNotesState("saved");
  }

  async function handleRemove() {
    setRemoving(true);
    setRemoveError(null);
    const result = await removeSavedJob({ savedJobId: item.id });
    if ("error" in result) {
      setRemoving(false);
      setRemoveError(result.error);
      return;
    }
    router.refresh();
  }

  const sponsorLabel = SPONSOR_LABELS[item.sponsorStatus];

  return (
    <Card className="gap-3 p-5" data-testid="saved-job-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <CardHeader className="min-w-0 flex-1 basis-72 p-0">
          <CardTitle className="text-base">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
              {item.jobTitle}
              <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only"> (opens the original posting in a new tab)</span>
            </a>
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3.5" aria-hidden="true" />
              {item.companyName}
            </span>
          </CardDescription>
        </CardHeader>
        <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
          <JobTrackerButton savedJobId={item.id} initialApplicationId={item.trackedApplicationId} />
          <Button type="button" variant="outline" size="sm" onClick={handleRemove} disabled={removing} aria-label={`Remove ${item.jobTitle} from saved jobs`}>
            {removing ? <Loader2Icon className="size-3.5 animate-spin" /> : <TrashIcon className="size-3.5" />}
            Remove
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Saved {formatDate(item.createdAt)}</span>
        <Badge variant="outline" className="text-xs">
          {item.sourceName}
        </Badge>
        {sponsorLabel && <Badge variant="tinted">{sponsorLabel}</Badge>}
        {item.matchScore !== null && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <TrendingUp className="size-3.5 text-primary" aria-hidden="true" />
            {item.matchScore}/100 match when saved
          </span>
        )}
        {!item.listingLive && (
          <Badge variant="secondary" className="text-xs">
            No longer listed
          </Badge>
        )}
      </div>

      {removeError && (
        <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <AlertCircleIcon className="size-3 shrink-0" /> {removeError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={`notes-${item.id}`} className="text-xs text-muted-foreground">
          Your notes
        </Label>
        <Textarea
          id={`notes-${item.id}`}
          value={notes}
          maxLength={2000}
          rows={2}
          onChange={(event) => {
            setNotes(event.target.value);
            setNotesState("idle");
          }}
          placeholder="Why it caught your eye, who you know there…"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" variant="outline" onClick={handleSaveNotes} disabled={notesState === "saving" || notes.trim() === savedNotes.trim()}>
            {notesState === "saving" ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            Save note
          </Button>
          <p role="status" aria-live="polite" className="text-xs">
            {notesState === "saved" && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2Icon className="size-3.5" /> Note saved
              </span>
            )}
            {notesState === "error" && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircleIcon className="size-3.5" /> {notesError}
              </span>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}
