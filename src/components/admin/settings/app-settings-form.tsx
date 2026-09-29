"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateAppSettings } from "@/lib/admin/settings/actions";
import type { AppSettings } from "@/lib/admin/settings/types";

export function AppSettingsForm({ settings }: { settings: AppSettings }) {
  const router = useRouter();
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode);
  const [announcementActive, setAnnouncementActive] = useState(settings.announcementActive);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const formData = new FormData(event.currentTarget);
    const result = await updateAppSettings(undefined, formData);
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="p-6 shadow-elevated">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* One form, two labelled sections: the left-hand nav jumps between them, and a single Save covers both. */}
        <section id="settings-signups" aria-labelledby="settings-signups-heading" className="flex scroll-mt-6 flex-col gap-4">
          <h2 id="settings-signups-heading" className="font-heading text-base font-semibold">
            Sign-ups
          </h2>
          <div className="flex items-center gap-2">
            <Checkbox id="maintenance-mode" name="maintenanceMode" value="on" checked={maintenanceMode} onCheckedChange={(checked) => setMaintenanceMode(checked === true)} />
            <div>
              <Label htmlFor="maintenance-mode" className="font-normal">
                Maintenance mode
              </Label>
              <p className="text-xs text-muted-foreground">Pauses new signups with a friendly message. Existing sessions are unaffected.</p>
            </div>
          </div>
        </section>

        <section id="settings-announcement" aria-labelledby="settings-announcement-heading" className="flex scroll-mt-6 flex-col gap-4 border-t pt-6">
          <h2 id="settings-announcement-heading" className="font-heading text-base font-semibold">
            Announcement
          </h2>
          <div className="flex items-center gap-2">
            <Checkbox
              id="announcement-active"
              name="announcementActive"
              value="on"
              checked={announcementActive}
              onCheckedChange={(checked) => setAnnouncementActive(checked === true)}
            />
            <Label htmlFor="announcement-active" className="font-normal">
              Show announcement banner
            </Label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="announcement-message">Announcement message</Label>
            <Textarea id="announcement-message" name="announcementMessage" defaultValue={settings.announcementMessage ?? ""} maxLength={500} rows={2} placeholder="Shown to every signed-in user when active." />
          </div>
        </section>

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
            "Save settings"
          )}
        </Button>
      </form>
    </Card>
  );
}
