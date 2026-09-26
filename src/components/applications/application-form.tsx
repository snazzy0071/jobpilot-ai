"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createApplication, updateApplication } from "@/lib/applications/actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus } from "@/lib/applications/types";

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso));
}

const NO_CV = "__no_cv__";
const NO_COVER_LETTER = "__no_cover_letter__";

const SPONSOR_STATUS_LABELS: Record<string, string> = {
  confirmed_sponsor: "Licensed sponsor",
  unconfirmed: "Unconfirmed",
  not_found: "Not on register",
};

/**
 * Shared create/edit form. `sponsorStatus`/`matchScore` are shown as
 * read-only info on the edit form only — they're resolved server-side
 * from the company name and any linked job/CV
 * (src/lib/applications/actions.ts), never typed here, matching the
 * same "never claim sponsorship the app hasn't actually confirmed"
 * rule the job feed's own sponsor badge follows.
 */
export function ApplicationForm({
  application,
  cvs,
  coverLetters,
  submittedCv,
}: {
  application?: Application;
  cvs: { id: string; title: string }[];
  coverLetters: { id: string; companyName: string; jobTitle: string }[];
  submittedCv?: { id: string; cvId: string; label: string | null; createdAt: string } | null;
}) {
  const router = useRouter();
  const isEditing = !!application;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>(application?.status ?? "wishlist");
  const [cvId, setCvId] = useState(application?.cvId ?? NO_CV);
  const [coverLetterId, setCoverLetterId] = useState(application?.coverLetterId ?? NO_COVER_LETTER);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = isEditing
      ? await updateApplication(undefined, formData)
      : await createApplication(formData);

    if (response && "error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push("/dashboard/applications");
    router.refresh();
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isEditing && <input type="hidden" name="id" value={application.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-company">Company</Label>
            <Input id="app-company" name="companyName" defaultValue={application?.companyName} maxLength={300} placeholder="e.g. Deloitte" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-role">Role</Label>
            <Input id="app-role" name="jobTitle" defaultValue={application?.jobTitle} maxLength={300} placeholder="e.g. Software Engineer" required />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-location">Location (optional)</Label>
            <Input id="app-location" name="location" defaultValue={application?.location ?? ""} maxLength={200} placeholder="e.g. London" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-salary">Salary (optional)</Label>
            <Input id="app-salary" name="salary" defaultValue={application?.salary ?? ""} maxLength={200} placeholder="e.g. £45,000–£55,000" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="app-url">Job posting URL (optional)</Label>
          <Input id="app-url" name="url" type="url" defaultValue={application?.url ?? ""} maxLength={2000} placeholder="https://…" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-status">Status</Label>
            <Select name="status" items={APPLICATION_STATUS_LABELS} value={status} onValueChange={(value) => value && setStatus(value as ApplicationStatus)}>
              <SelectTrigger id="app-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {APPLICATION_STATUS_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-deadline">Deadline (optional)</Label>
            <Input id="app-deadline" name="deadline" type="date" defaultValue={application?.deadline ?? ""} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-cv">CV used (optional)</Label>
            <Select name="cvId" items={{ [NO_CV]: "None", ...Object.fromEntries(cvs.map((cv) => [cv.id, cv.title])) }} value={cvId} onValueChange={(value) => value && setCvId(value)}>
              <SelectTrigger id="app-cv" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CV}>None</SelectItem>
                {cvs.map((cv) => (
                  <SelectItem key={cv.id} value={cv.id}>
                    {cv.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="app-cover-letter">Cover letter used (optional)</Label>
            <Select
              name="coverLetterId"
              items={{ [NO_COVER_LETTER]: "None", ...Object.fromEntries(coverLetters.map((letter) => [letter.id, `${letter.companyName} — ${letter.jobTitle}`])) }}
              value={coverLetterId} onValueChange={(value) => value && setCoverLetterId(value)}>
              <SelectTrigger id="app-cover-letter" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COVER_LETTER}>None</SelectItem>
                {coverLetters.map((letter) => (
                  <SelectItem key={letter.id} value={letter.id}>
                    {letter.companyName} — {letter.jobTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="app-notes">Notes (optional)</Label>
          <Textarea id="app-notes" name="notes" rows={4} maxLength={4000} defaultValue={application?.notes ?? ""} placeholder="Anything worth remembering — a contact, an interview note, a follow-up plan" />
        </div>

        {isEditing && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-sm" data-testid="snapshot-panel">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Sponsor state:</span>
              <Badge variant={application.sponsorStatus === "confirmed_sponsor" ? "tinted" : "outline"}>
                {application.sponsorStatus ? SPONSOR_STATUS_LABELS[application.sponsorStatus] : "Not checked yet"}
              </Badge>
              <span className="text-muted-foreground">Match score:</span>
              <span className="font-medium">
                {application.matchScore !== null ? `${application.matchScore}/100` : "Not scored — score this job against your CV in the job feed"}
              </span>
              {application.appliedAt && (
                <>
                  <span className="text-muted-foreground">Applied:</span>
                  <span className="font-medium">{formatDay(application.appliedAt)}</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {application.frozenAt ? (
                <>
                  Frozen when first moved to Applied, on {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(application.frozenAt))}. Editing the company, status or CV now won&apos;t change the sponsor state, match score or submitted CV below.
                </>
              ) : (
                "Not frozen yet — the sponsor state and match score keep following the company and CV above until this application first reaches Applied, when they lock permanently along with a copy of the CV."
              )}
            </p>
            {application.frozenAt && (
              <p className="text-xs">
                <span className="text-muted-foreground">CV submitted: </span>
                {submittedCv ? (
                  <>
                    <span className="font-medium">{submittedCv.label ?? "Saved copy"}</span>{" "}
                    <span className="text-muted-foreground">
                      (copied {formatDay(submittedCv.createdAt)}) —{" "}
                      <a className="underline underline-offset-4" href={`/dashboard/cvs/${submittedCv.cvId}`}>
                        open the CV, then its version history
                      </a>
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">{application.submittedCvVersionId ? "that copy has since been deleted" : "no CV was linked when this was submitted"}</span>
                )}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2Icon className="animate-spin" /> Saving…
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Add application"
            )}
          </Button>
          <Button type="button" variant="outline" render={<a href="/dashboard/applications">Cancel</a>} />
        </div>
      </form>
    </Card>
  );
}
