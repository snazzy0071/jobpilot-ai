"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateInstitutionBranding } from "@/lib/institutions/admin/actions";
import type { InstitutionOverview } from "@/lib/institutions/admin/types";

const DEFAULT_COLOR = "#4f46e5";

/**
 * Everything here is scoped to this one institution's own row
 * (institutions.logo_url/primary_color/welcome_message, migration
 * 0072) — it never touches globals.css or any `:root` CSS variable, so
 * saving it can't affect any other institution's branding or the
 * app's own default theme. What actually *renders* it co-branded —
 * the onboarding banner — reads these same values and applies the
 * colour via an inline style scoped to itself, same reasoning.
 */
export function BrandingForm({ institution }: { institution: InstitutionOverview["institution"] }) {
  const router = useRouter();
  const [primaryColor, setPrimaryColor] = useState(institution.primaryColor ?? DEFAULT_COLOR);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const formData = new FormData(event.currentTarget);
    const result = await updateInstitutionBranding(undefined, formData);
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-name">Institution name</Label>
          <Input id="brand-name" name="name" defaultValue={institution.name} maxLength={200} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-logo">Logo URL</Label>
          <Input id="brand-logo" name="logoUrl" type="url" defaultValue={institution.logoUrl ?? ""} placeholder="https://…" maxLength={2048} />
          <p className="text-xs text-muted-foreground">Shown alongside the JobPilot logo on your students&apos; onboarding.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-color">Accent colour</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              className="size-9 shrink-0 cursor-pointer rounded-md border border-input"
              aria-label="Accent colour picker"
            />
            <Input
              id="brand-color"
              name="primaryColor"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              maxLength={7}
              className="max-w-32"
            />
          </div>
          <p className="text-xs text-muted-foreground">Used to highlight your institution&apos;s onboarding banner — never changes JobPilot&apos;s own theme.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-welcome">Welcome message</Label>
          <Textarea
            id="brand-welcome"
            name="welcomeMessage"
            defaultValue={institution.welcomeMessage ?? ""}
            maxLength={2000}
            rows={3}
            placeholder="A short note shown to new students when they join."
          />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}
        {saved && !error && (
          <p className="flex items-center gap-1.5 text-sm text-primary">
            <CheckCircle2Icon className="size-4 shrink-0" /> Saved.
          </p>
        )}

        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save branding"
          )}
        </Button>
      </form>
    </Card>
  );
}
