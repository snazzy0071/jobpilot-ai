"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/lib/consent/use-consent";
import { CookiePreferencesDialog } from "@/components/consent/cookie-preferences-dialog";

/**
 * Shows once, site-wide (mounted from the root layout, so it covers
 * public marketing pages, the dashboard, and auth pages alike — consent
 * applies to every visitor, not just the ones landing on a marketing
 * page first) — only while `state.decidedAt` is still `null`. There's
 * deliberately no plain "dismiss" close button: a visitor either accepts
 * all, rejects non-essential, or opens preferences to choose exactly —
 * closing the tab without deciding is the only way to leave this
 * genuinely undecided, so the banner reappears next visit rather than
 * treating a silent dismissal as consent.
 */
export function CookieConsentBanner() {
  const router = useRouter();
  const { state, save } = useConsent();
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  if (!state || state.decidedAt !== null) return null;

  function handleDecision(next: { analytics: boolean; marketing: boolean }) {
    save(next);
    router.refresh();
  }

  return (
    <>
      {/* print:hidden — the PDF exports render real pages headlessly, where nothing has been consented yet; the banner is
          fixed to the viewport, so without this it is printed onto every page of a CV, cover letter or report. */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background p-4 shadow-floating print:hidden">
        <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            We use necessary cookies to run this site, and optional analytics/marketing cookies only if you
            agree. See our{" "}
            <Link href="/cookies" className="underline hover:text-foreground">
              Cookie Policy
            </Link>{" "}
            for details.
          </p>
          <div className="flex flex-shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleDecision({ analytics: false, marketing: false })}>
              Reject non-essential
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPreferencesOpen(true)}>
              Manage preferences
            </Button>
            <Button size="sm" onClick={() => handleDecision({ analytics: true, marketing: true })}>
              Accept all
            </Button>
          </div>
        </div>
      </div>
      <CookiePreferencesDialog open={preferencesOpen} onOpenChange={setPreferencesOpen} />
    </>
  );
}
