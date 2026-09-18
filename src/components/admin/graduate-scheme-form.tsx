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
  type GraduateScheme,
  type GraduateSchemeSector,
  type GraduateSchemeSponsorshipStatus,
} from "@/lib/graduate-schemes/types";

/**
 * Shared create/edit form — every sponsorship claim on the public page
 * traces back to a row created or edited here, so source URL and
 * source date are required fields, not optional metadata (matching
 * migration 0056's own not-null constraints).
 */
export function GraduateSchemeForm({ scheme }: { scheme?: GraduateScheme }) {
  const router = useRouter();
  const isEditing = !!scheme;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sector, setSector] = useState<GraduateSchemeSector>(scheme?.sector ?? GRADUATE_SCHEME_SECTORS[0]);
  const [status, setStatus] = useState<GraduateSchemeSponsorshipStatus>(
    scheme?.sponsorshipStatus ?? "not_published",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = isEditing
      ? await updateGraduateScheme(undefined, formData)
      : await createGraduateScheme(formData);

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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isEditing && <input type="hidden" name="id" value={scheme.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-employer">Employer</Label>
            <Input id="gs-employer" name="employer" defaultValue={scheme?.employer} maxLength={300} placeholder="e.g. Deloitte" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-scheme-name">Scheme name</Label>
            <Input
              id="gs-scheme-name"
              name="schemeName"
              defaultValue={scheme?.schemeName}
              maxLength={300}
              placeholder="e.g. Technology Consulting Graduate Programme"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-sector">Sector</Label>
            <Select name="sector" value={sector} onValueChange={(value) => value && setSector(value as GraduateSchemeSector)}>
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
            <Select
              name="sponsorshipStatus"
              value={status}
              onValueChange={(value) => value && setStatus(value as GraduateSchemeSponsorshipStatus)}
            >
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-salary">Salary (optional)</Label>
            <Input id="gs-salary" name="salary" defaultValue={scheme?.salary ?? ""} maxLength={200} placeholder="e.g. £32,000–£38,000" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gs-locations">Locations (optional)</Label>
            <Input
              id="gs-locations"
              name="locations"
              defaultValue={scheme?.locations.join(", ") ?? ""}
              maxLength={2000}
              placeholder="e.g. London, Manchester, Remote"
            />
            <p className="text-xs text-muted-foreground">Comma-separated.</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gs-notes">Notes (optional)</Label>
          <Textarea
            id="gs-notes"
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={scheme?.notes ?? ""}
            placeholder="What the evidence actually said, or why the status is marked as it is"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gs-source-url">Source URL</Label>
          <Input
            id="gs-source-url"
            name="sourceUrl"
            type="url"
            defaultValue={scheme?.sourceUrl}
            maxLength={2000}
            placeholder="https://…"
            required
          />
          <p className="text-xs text-muted-foreground">
            The page this status is checked against — the employer&apos;s own guidance, or the Home Office register.
          </p>
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
            <p className="text-xs text-muted-foreground">The date this app last rechecked the source.</p>
          </div>
        </div>

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
