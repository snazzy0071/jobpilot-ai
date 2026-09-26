"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Loader2Icon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteSchemeAssessment, saveSchemeAssessment } from "@/lib/graduate-schemes/assessment-actions";
import { ASSESSMENT_LABELS, ASSESSMENT_TYPES, type AssessmentType, type SchemeAssessment } from "@/lib/graduate-schemes/types";
import { isStale, STALE_AFTER_DAYS } from "@/lib/graduate-schemes/staleness";
import { todayInUk } from "@/lib/graduate-schemes/status";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

function AssessmentForm({ schemeId, existing, defaultSource, onDone, onCancel }: { schemeId: string; existing?: SchemeAssessment; defaultSource?: string; onDone: () => void; onCancel: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<AssessmentType>(existing?.type ?? "sjt");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    const result = await saveSchemeAssessment({
      id: existing?.id,
      schemeId,
      type,
      label: String(form.get("label") ?? ""),
      provider: String(form.get("provider") ?? ""),
      notes: String(form.get("notes") ?? ""),
      isRequired: form.get("isRequired") === "on",
      displayOrder: String(form.get("displayOrder") ?? "0"),
      sourceUrl: String(form.get("sourceUrl") ?? ""),
      sourceDate: String(form.get("sourceDate") ?? ""),
      verifiedAt: String(form.get("verifiedAt") ?? ""),
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} aria-label={existing ? "Edit assessment" : "Add assessment"} className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="as-type">Assessment type</Label>
        <select id="as-type" value={type} onChange={(e) => setType(e.target.value as AssessmentType)} className={SELECT_CLASS}>
          {ASSESSMENT_TYPES.map((option) => (
            <option key={option} value={option}>
              {ASSESSMENT_LABELS[option]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="as-label">{type === "other" ? "What is it called?" : "Name (optional)"}</Label>
        <Input id="as-label" name="label" defaultValue={existing?.label ?? ""} maxLength={100} required={type === "other"} placeholder={type === "other" ? "e.g. Group exercise" : "only if the source gives one"} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="as-provider">Provider or platform named by the source (optional)</Label>
        <Input id="as-provider" name="provider" defaultValue={existing?.provider ?? ""} maxLength={100} placeholder="leave blank unless the source names one" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="as-order">Display order</Label>
        <Input id="as-order" name="displayOrder" type="number" min={0} defaultValue={existing?.displayOrder ?? 0} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isRequired" defaultChecked={existing?.isRequired ?? true} className="size-4 accent-primary" />
        Required for every applicant (untick if the source says it &ldquo;may&rdquo; be used or only for some routes)
      </label>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="as-notes">Notes (optional)</Label>
        <Textarea id="as-notes" name="notes" rows={2} maxLength={1000} defaultValue={existing?.notes ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="as-source">Source for this assessment</Label>
        <Input id="as-source" name="sourceUrl" type="url" defaultValue={existing?.sourceUrl ?? defaultSource ?? ""} required maxLength={2000} placeholder="https://…" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="as-sdate">Source date</Label>
        <Input id="as-sdate" name="sourceDate" type="date" defaultValue={existing?.sourceDate ?? ""} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="as-vdate">Verified date</Label>
        <Input id="as-vdate" name="verifiedAt" type="date" defaultValue={existing?.verifiedAt ?? todayInUk()} required />
      </div>
      {error && (
        <p className="text-sm text-destructive sm:col-span-2" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : null} {existing ? "Save assessment" : "Add assessment"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * The assessments a scheme uses, each with its own source. Adding one asks for the source and dates in the same step, so
 * "this scheme uses X" can't be recorded without saying where that was checked.
 */
export function AssessmentManager({ schemeId, assessments, schemeSourceUrl }: { schemeId: string; assessments: SchemeAssessment[]; schemeSourceUrl: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "add" | string>("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(item: SchemeAssessment) {
    if (!window.confirm(`Remove "${item.label ?? ASSESSMENT_LABELS[item.type]}" from this scheme?`)) return;
    setBusy(item.id);
    setError("");
    const result = await deleteSchemeAssessment({ id: item.id });
    setBusy(null);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  const done = () => {
    setMode("idle");
    router.refresh();
  };

  return (
    <Card className="gap-4 p-6" data-testid="assessment-manager">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Assessments &amp; evidence</h2>
          <p className="text-sm text-muted-foreground">What applicants have to complete, each with the page that says so. Shown on the scheme&apos;s public page with matching JobPilot practice.</p>
        </div>
        {mode === "idle" && <Button onClick={() => setMode("add")}>Add assessment</Button>}
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {assessments.length === 0 && mode !== "add" && <p className="text-sm text-muted-foreground" data-testid="no-assessments">No assessments recorded. Only add one you have a source for.</p>}

      <ul className="flex flex-col gap-3">
        {assessments.map((item) =>
          mode === item.id ? (
            <li key={item.id}>
              <AssessmentForm schemeId={schemeId} existing={item} onDone={done} onCancel={() => setMode("idle")} />
            </li>
          ) : (
            <li key={item.id} className="flex flex-col gap-2 rounded-lg border p-3" data-testid="assessment-item">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {ASSESSMENT_LABELS[item.type]}
                    {item.label && <span className="font-normal text-muted-foreground"> — {item.label}</span>}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant={item.isRequired ? "default" : "outline"}>{item.isRequired ? "Required" : "May be used"}</Badge>
                    {item.provider && <span>Provider: {item.provider}</span>}
                  </p>
                  {item.notes && <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label={`Edit ${item.label ?? ASSESSMENT_LABELS[item.type]}`} onClick={() => setMode(item.id)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.label ?? ASSESSMENT_LABELS[item.type]}`} disabled={busy === item.id} onClick={() => void remove(item)}>
                    {busy === item.id ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </Button>
                </div>
              </div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                  Source <ExternalLink className="size-3" aria-hidden="true" />
                </a>
                <span>Source dated {fmt(item.sourceDate)}</span>
                <span>Verified {fmt(item.verifiedAt)}</span>
                {isStale(item.verifiedAt) && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <AlertTriangle className="size-3" aria-hidden="true" /> Not rechecked in over {STALE_AFTER_DAYS} days
                  </span>
                )}
              </p>
            </li>
          ),
        )}
      </ul>

      {mode === "add" && <AssessmentForm schemeId={schemeId} defaultSource={schemeSourceUrl} onDone={done} onCancel={() => setMode("idle")} />}
    </Card>
  );
}
