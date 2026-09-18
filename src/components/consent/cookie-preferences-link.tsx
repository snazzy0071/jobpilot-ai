"use client";

import { useState } from "react";
import { CookiePreferencesDialog } from "@/components/consent/cookie-preferences-dialog";

/** Lets a visitor reopen the preferences dialog after their first decision — the banner itself only ever shows once. */
export function CookiePreferencesLink({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Cookie preferences
      </button>
      <CookiePreferencesDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
