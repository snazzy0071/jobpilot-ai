"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { saveAutoApplySettings } from "@/lib/auto-apply/actions";
import { CONSENT_VERSION, LIMITS, type AutoApplySettings } from "@/lib/auto-apply/types";

type Doc = { id: string; label: string };

const fieldClass = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function AutoApplySettingsForm({ settings, cvs, coverLetters }: { settings: AutoApplySettings; cvs: Doc[]; coverLetters: Doc[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const consentCurrent = settings.consentAt !== null && settings.consentVersion === CONSENT_VERSION;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const result = await saveAutoApplySettings(formData);
      setMessage("error" in result ? { kind: "error", text: result.error } : { kind: "ok", text: "Settings saved." });
    });
  }

  return (
    <Card className="p-5" data-testid="auto-apply-settings">
      <form onSubmit={submit} className="flex flex-col gap-5" aria-label="Auto-Apply settings">
        <h2 className="font-heading text-lg font-semibold">Your rules</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="aa-cv" label="CV to apply with" hint="Match scores are read from this CV.">
            <select id="aa-cv" name="cvId" defaultValue={settings.cvId ?? ""} className={fieldClass} aria-describedby="aa-cv-hint">
              <option value="">Choose a CV…</option>
              {cvs.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="aa-letter" label="Cover letter (optional)" hint="You can change it for each application when you review it.">
            <select id="aa-letter" name="coverLetterId" defaultValue={settings.coverLetterId ?? ""} className={fieldClass} aria-describedby="aa-letter-hint">
              <option value="">No cover letter</option>
              {coverLetters.map((letter) => (
                <option key={letter.id} value={letter.id}>
                  {letter.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="aa-score" label="Minimum match score" hint={`Only jobs you've already scored at or above this (${LIMITS.minScore}–${LIMITS.maxScore}).`}>
            <input id="aa-score" name="minMatchScore" type="number" min={LIMITS.minScore} max={LIMITS.maxScore} defaultValue={settings.minMatchScore} className={fieldClass} aria-describedby="aa-score-hint" required />
          </Field>
          <Field id="aa-daily" label="Daily limit" hint={`Applications you can approve per day, 1–${LIMITS.maxDaily}. Resets at midnight UK time.`}>
            <input id="aa-daily" name="dailyLimit" type="number" min={1} max={LIMITS.maxDaily} defaultValue={settings.dailyLimit} className={fieldClass} aria-describedby="aa-daily-hint" required />
          </Field>
          <Field id="aa-roles" label="Role keywords" hint={`Comma-separated, up to ${LIMITS.maxKeywords}. A job's title must contain one. Leave empty for any role.`}>
            <input id="aa-roles" name="roleKeywords" type="text" defaultValue={settings.roleKeywords.join(", ")} className={fieldClass} aria-describedby="aa-roles-hint" placeholder="analyst, graduate engineer" />
          </Field>
          <Field id="aa-locations" label="Locations" hint={`Comma-separated, up to ${LIMITS.maxLocations}. Leave empty for anywhere.`}>
            <input id="aa-locations" name="locations" type="text" defaultValue={settings.locations.join(", ")} className={fieldClass} aria-describedby="aa-locations-hint" placeholder="London, Manchester" />
          </Field>
          <Field id="aa-salary" label="Minimum salary (£ a year)" hint="Job listings don't publish a structured salary, so this can only be applied when a listing states one. Otherwise see the option below.">
            <input id="aa-salary" name="minSalary" type="text" inputMode="numeric" defaultValue={settings.minSalary ?? ""} className={fieldClass} aria-describedby="aa-salary-hint" placeholder="e.g. 30000" />
          </Field>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="includeUnknownSalary" defaultChecked={settings.includeUnknownSalary} className="mt-0.5 size-4" />
            <span>Include jobs that don&apos;t state a salary</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="sponsorOnly" defaultChecked={settings.sponsorOnly} className="mt-0.5 size-4" />
            <span>Only employers confirmed on the UK sponsor register</span>
          </label>
        </div>

        <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
          <legend className="px-1 text-sm font-medium">Turn on Auto-Apply</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-0.5 size-4" />
            <span>Auto-Apply is on</span>
          </label>
          {consentCurrent ? (
            <p className="text-xs text-muted-foreground">You confirmed how Auto-Apply works on {new Date(settings.consentAt as string).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.</p>
          ) : (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="consent" className="mt-0.5 size-4" />
              <span>
                I understand that JobPilot only prepares applications for me to review. Nothing is sent until I approve that application, employers&apos; sites may need me to apply myself, and I&apos;m responsible for what I submit.
              </span>
            </label>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
          <p role={message?.kind === "error" ? "alert" : "status"} aria-live="polite" className={message?.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {message?.text}
          </p>
        </div>
      </form>
    </Card>
  );
}
