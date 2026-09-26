"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createGraduateScheme, updateGraduateScheme } from "@/lib/graduate-schemes/actions";
import {
  GRADUATE_SCHEME_SECTORS,
  GRADUATE_SCHEME_SECTOR_LABELS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUSES,
  GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS,
  STUDY_STAGES,
  STUDY_STAGE_LABELS,
  type GraduateScheme,
  type GraduateSchemeSector,
  type GraduateSchemeSponsorshipStatus,
} from "@/lib/graduate-schemes/types";

const SECTOR_ITEMS = GRADUATE_SCHEME_SECTOR_LABELS as Record<string, string>;
const STATUS_ITEMS = GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS as Record<string, string>;

function CheckGroup({ legend, name, options, labels, selected }: { legend: string; name: string; options: readonly string[]; labels: Record<string, string>; selected: string[] }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={option} defaultChecked={selected.includes(option)} className="size-4 accent-primary" />
            {labels[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Shared create/edit form. Every claim on the public pages traces back to a row created or edited here, so the source URL
 * and the source and verified dates are required (matching migration 0056's not-null constraints). Dates the employer
 * hasn't published are left blank — the public page then says "not published" rather than guessing.
 */
export function GraduateSchemeForm({ scheme }: { scheme?: GraduateScheme }) {
  const router = useRouter();
  const isEditing = !!scheme;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState<GraduateSchemeSector>(scheme?.sector ?? GRADUATE_SCHEME_SECTORS[0]);
  const [status, setStatus] = useState<GraduateSchemeSponsorshipStatus>(scheme?.sponsorshipStatus ?? "not_published");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = isEditing ? await updateGraduateScheme(undefined, formData) : await createGraduateScheme(formData);

    if (response && "error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push("/admin/graduate-schemes");
    router.refresh();
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {isEditing && <input type="hidden" name="id" value={scheme.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-employer">Employer</Label>
            <Input id="gs-employer" name="employer" defaultValue={scheme?.employer} maxLength={300} placeholder="e.g. Example Employer" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-scheme-name">Programme name</Label>
            <Input id="gs-scheme-name" name="schemeName" defaultValue={scheme?.schemeName} maxLength={300} placeholder="e.g. Technology Graduate Programme" required />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gs-slug">URL slug (optional)</Label>
          <Input id="gs-slug" name="slug" defaultValue={scheme?.slug} maxLength={200} placeholder="generated from the employer and programme name" />
          <p className="text-xs text-muted-foreground">Public address: /graduate-schemes/&lt;slug&gt;. Changing it later breaks existing links, so leave it once published.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-sector">Sector</Label>
            <Select name="sector" items={SECTOR_ITEMS} value={sector} onValueChange={(value) => value && setSector(value as GraduateSchemeSector)}>
              <SelectTrigger id="gs-sector" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADUATE_SCHEME_SECTORS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {GRADUATE_SCHEME_SECTOR_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-status">Sponsorship status</Label>
            <Select name="sponsorshipStatus" items={STATUS_ITEMS} value={status} onValueChange={(value) => value && setStatus(value as GraduateSchemeSponsorshipStatus)}>
              <SelectTrigger id="gs-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADUATE_SCHEME_SPONSORSHIP_STATUSES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gs-description">Description (optional)</Label>
          <Textarea id="gs-description" name="description" rows={4} maxLength={4000} defaultValue={scheme?.description ?? ""} placeholder="A short factual summary, in your own words, of what the programme is" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-salary">Salary as published (optional)</Label>
            <Input id="gs-salary" name="salary" defaultValue={scheme?.salary ?? ""} maxLength={200} placeholder="e.g. £32,000–£38,000" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-salary-min">Minimum salary, £ (optional)</Label>
            <Input id="gs-salary-min" name="salaryMin" inputMode="numeric" defaultValue={scheme?.salaryMin ?? ""} placeholder="32000" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-salary-max">Maximum salary, £ (optional)</Label>
            <Input id="gs-salary-max" name="salaryMax" inputMode="numeric" defaultValue={scheme?.salaryMax ?? ""} placeholder="38000" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gs-locations">Locations (optional)</Label>
          <Input id="gs-locations" name="locations" defaultValue={scheme?.locations.join(", ") ?? ""} maxLength={2000} placeholder="e.g. London, Manchester, Remote" />
          <p className="text-xs text-muted-foreground">Comma-separated.</p>
        </div>

        <CheckGroup legend="Open to (study stage)" name="studyStages" options={STUDY_STAGES} labels={STUDY_STAGE_LABELS} selected={scheme?.studyStages ?? []} />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-opens">Opening date (optional)</Label>
            <Input id="gs-opens" name="opensOn" type="date" defaultValue={scheme?.opensOn ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-deadline">Deadline (optional)</Label>
            <Input id="gs-deadline" name="deadlineOn" type="date" defaultValue={scheme?.deadlineOn ?? ""} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="isRolling" defaultChecked={scheme?.isRolling ?? false} className="size-4 accent-primary" />
            Rolling applications
          </label>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">Leave a date blank if the employer hasn&apos;t published it — the page will say so instead of guessing.</p>

        <p className="text-xs text-muted-foreground">Which assessments a scheme uses — each with its own source — is managed in the &ldquo;Assessments &amp; evidence&rdquo; section after the scheme is created.</p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gs-assessment-notes">General assessment notes (optional)</Label>
          <Textarea id="gs-assessment-notes" name="assessmentNotes" rows={2} maxLength={2000} defaultValue={scheme?.assessmentNotes ?? ""} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gs-apply-url">Application link (optional)</Label>
          <Input id="gs-apply-url" name="applicationUrl" type="url" defaultValue={scheme?.applicationUrl ?? ""} maxLength={2000} placeholder="https://…" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gs-notes">Notes on the evidence (optional)</Label>
          <Textarea id="gs-notes" name="notes" rows={3} maxLength={2000} defaultValue={scheme?.notes ?? ""} placeholder="What the source actually said, or why the sponsorship status is marked as it is" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gs-source-url">Source URL</Label>
          <Input id="gs-source-url" name="sourceUrl" type="url" defaultValue={scheme?.sourceUrl} maxLength={2000} placeholder="https://…" required />
          <p className="text-xs text-muted-foreground">The page these details are checked against — the employer&apos;s own graduate page, or the Home Office register.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-source-date">Source date</Label>
            <Input id="gs-source-date" name="sourceDate" type="date" defaultValue={scheme?.sourceDate} required />
            <p className="text-xs text-muted-foreground">The date the source itself reflects.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-verified-at">Verified date</Label>
            <Input id="gs-verified-at" name="verifiedAt" type="date" defaultValue={scheme?.verifiedAt} required />
            <p className="text-xs text-muted-foreground">The date someone last checked the source. Can&apos;t be in the future.</p>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPublished" defaultChecked={scheme?.isPublished ?? true} className="size-4 accent-primary" />
          Published (visible on the public site; untick to keep it as a draft)
        </label>

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
              "Create scheme"
            )}
          </Button>
          <Button type="button" variant="outline" render={<a href="/admin/graduate-schemes">Cancel</a>} />
        </div>
      </form>
    </Card>
  );
}
