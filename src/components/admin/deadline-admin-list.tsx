"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCheck, Loader2Icon, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSchemeDates, verifySchemeDates } from "@/lib/graduate-schemes/actions";
import { APPLICATION_STATUS_LABELS, applicationStatus, todayInUk } from "@/lib/graduate-schemes/status";
import { isStale, STALE_AFTER_DAYS } from "@/lib/graduate-schemes/staleness";
import type { GraduateScheme } from "@/lib/graduate-schemes/types";

function fmt(iso: string | null): string {
  return iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "Not published";
}

function EditDates({ scheme, onDone, onError }: { scheme: GraduateScheme; onDone: () => void; onError: (message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const id = scheme.id;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    onError("");
    const result = await updateSchemeDates({
      id: scheme.id,
      opensOn: String(form.get("opensOn") ?? ""),
      deadlineOn: String(form.get("deadlineOn") ?? ""),
      isRolling: form.get("isRolling") === "on",
      sourceUrl: String(form.get("sourceUrl") ?? ""),
      sourceDate: String(form.get("sourceDate") ?? ""),
      verifiedAt: String(form.get("verifiedAt") ?? ""),
    });
    setSaving(false);
    if (result && "error" in result) {
      onError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3" aria-label={`Edit dates for ${scheme.schemeName}`}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`opens-${id}`}>Opening date</Label>
        <Input id={`opens-${id}`} name="opensOn" type="date" defaultValue={scheme.opensOn ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`deadline-${id}`}>Deadline</Label>
        <Input id={`deadline-${id}`} name="deadlineOn" type="date" defaultValue={scheme.deadlineOn ?? ""} />
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="checkbox" name="isRolling" defaultChecked={scheme.isRolling} className="size-4 accent-primary" />
        Rolling applications
      </label>
      <div className="flex flex-col gap-1.5 sm:col-span-3">
        <Label htmlFor={`source-${id}`}>Source these dates were checked against</Label>
        <Input id={`source-${id}`} name="sourceUrl" type="url" defaultValue={scheme.sourceUrl} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`sdate-${id}`}>Source date</Label>
        <Input id={`sdate-${id}`} name="sourceDate" type="date" defaultValue={scheme.sourceDate} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`vdate-${id}`}>Verified date</Label>
        <Input id={`vdate-${id}`} name="verifiedAt" type="date" defaultValue={todayInUk()} required />
      </div>
      <div className="flex items-end gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2Icon className="animate-spin" /> : null} Save dates
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-3">Leave a date blank if the employer hasn&apos;t published it. Saving records who changed what in the audit log.</p>
    </form>
  );
}

/** Every scheme's dates and how recently they were checked, oldest check first — the admin's re-verification queue. */
export function DeadlineAdminList({ schemes }: { schemes: GraduateScheme[] }) {
  const router = useRouter();
  const [onlyStale, setOnlyStale] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const rows = useMemo(() => [...schemes].sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt) || a.employer.localeCompare(b.employer)).filter((s) => !onlyStale || isStale(s.verifiedAt)), [schemes, onlyStale]);
  const staleCount = schemes.filter((s) => isStale(s.verifiedAt)).length;

  async function verify(scheme: GraduateScheme) {
    setBusy(scheme.id);
    setError("");
    const result = await verifySchemeDates({ id: scheme.id });
    setBusy(null);
    setConfirming(null);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    setNotice(`Verified ${scheme.schemeName}.`);
    router.refresh();
  }

  if (schemes.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No graduate schemes yet</p>
        <p className="text-sm text-muted-foreground">Dates come from schemes you add under Graduate Schemes, each with its source.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyStale} onChange={(e) => setOnlyStale(e.target.checked)} className="size-4 accent-primary" />
        Only show dates not verified in the last {STALE_AFTER_DAYS} days ({staleCount})
      </label>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((scheme) => {
          const stale = isStale(scheme.verifiedAt);
          return (
            <li key={scheme.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4" data-testid="deadline-admin-row">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    <Link href={`/graduate-schemes/${scheme.slug}`} className="hover:underline">
                      {scheme.schemeName}
                    </Link>
                    {!scheme.isPublished && (
                      <Badge variant="outline" className="ml-2">
                        Draft
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{scheme.employer}</p>
                </div>
                <Badge variant="outline">{APPLICATION_STATUS_LABELS[applicationStatus(scheme)]}</Badge>
              </div>

              <dl className="grid gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Opens</dt>
                  <dd data-testid="opens">{fmt(scheme.opensOn)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Deadline</dt>
                  <dd data-testid="deadline">{scheme.deadlineOn ? fmt(scheme.deadlineOn) : scheme.isRolling ? "Rolling — none" : "Not published"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Source dated</dt>
                  <dd>{fmt(scheme.sourceDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Verified</dt>
                  <dd className="flex items-center gap-1.5" data-testid="verified">
                    {fmt(scheme.verifiedAt)}
                    {stale && (
                      <span className="inline-flex items-center gap-1 text-warning" title={`Not rechecked in over ${STALE_AFTER_DAYS} days`}>
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        <span className="text-xs">Needs verification</span>
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              {editing === scheme.id ? (
                <EditDates
                  scheme={scheme}
                  onError={setError}
                  onDone={() => {
                    setEditing(null);
                    router.refresh();
                  }}
                />
              ) : confirming === scheme.id ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 text-sm" role="alertdialog" aria-label={`Confirm verification of ${scheme.schemeName}`}>
                  <span>
                    Confirm you re-checked <a href={scheme.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">the source</a> today and these dates are still right.
                  </span>
                  <Button size="sm" disabled={busy === scheme.id} onClick={() => void verify(scheme)}>
                    {busy === scheme.id ? <Loader2Icon className="animate-spin" /> : null} Yes, verified today
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setConfirming(scheme.id)} aria-label={`Mark ${scheme.schemeName} verified`}>
                    <CheckCheck /> Mark verified
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(scheme.id)} aria-label={`Edit dates for ${scheme.schemeName}`}>
                    <Pencil /> Edit dates
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
