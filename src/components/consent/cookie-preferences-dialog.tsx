"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConsent } from "@/lib/consent/use-consent";

/**
 * Self-contained: reads and writes consent itself via useConsent()
 * rather than taking preferences as props, so both the first-visit
 * banner and the standalone "Cookie preferences" link (site footer,
 * Cookie Policy page) can mount this with nothing but `open`/
 * `onOpenChange` and always show the caller's real current choice.
 *
 * `router.refresh()` after saving is what makes the choice actually
 * take effect for any consent-gated Server Component in the current
 * tree (src/lib/consent/server.ts's hasConsent()) — the cookie itself
 * is already updated the instant `save()` runs, but Server Components
 * already rendered on this page won't re-evaluate it without a refresh.
 */
export function CookiePreferencesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { state, save } = useConsent();
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Adjusts the draft toggle state when the dialog transitions to open,
  // so it always starts from the real current choice — done during
  // render (React's own documented pattern for "adjust state when a
  // prop changes"), not in an effect, which would apply the sync one
  // frame late and risk a visible flash of stale toggle positions.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && state) {
      setAnalytics(state.analytics);
      setMarketing(state.marketing);
    }
  }

  function handleSave(next: { analytics: boolean; marketing: boolean }) {
    save(next);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cookie preferences</DialogTitle>
          <DialogDescription>
            Choose which optional cookies we can set. Necessary cookies are always on — the site can&apos;t
            work without them. See the <a href="/cookies" className="underline">Cookie Policy</a> for details.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Necessary</p>
              <p className="text-sm text-muted-foreground">
                Keeps you signed in and remembers this choice. Always active.
              </p>
            </div>
            <Switch checked disabled aria-label="Necessary cookies (always active)" />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="consent-analytics" className="text-sm font-medium">
                Analytics
              </Label>
              <p className="text-sm text-muted-foreground">
                Helps us understand how the site is used, so we can improve it.
              </p>
            </div>
            <Switch id="consent-analytics" checked={analytics} onCheckedChange={setAnalytics} />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="consent-marketing" className="text-sm font-medium">
                Marketing
              </Label>
              <p className="text-sm text-muted-foreground">
                Used to measure and improve marketing, if we ever run any.
              </p>
            </div>
            <Switch id="consent-marketing" checked={marketing} onCheckedChange={setMarketing} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleSave({ analytics: false, marketing: false })}>
            Reject non-essential
          </Button>
          <Button onClick={() => handleSave({ analytics, marketing })}>Save preferences</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
