"use client";

import { EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { CoverLetterPreview } from "@/components/cover-letters/cover-letter-preview";

/**
 * Mobile equivalent of the desktop sticky preview column — same pattern
 * as the CV editor's `MobilePreviewTrigger`. Below `lg` the preview
 * column isn't hidden, but it still just sits at the bottom of a single
 * stacked layout (see the editor page's `lg:grid-cols-[...]` collapsing
 * to one column), which means scrolling past the whole paragraph editor
 * to see it — not usable in any real sense. This gives an on-demand,
 * near-full-height bottom sheet instead. Reads from
 * `CoverLetterPreviewProvider` via `CoverLetterPreview` itself, so no
 * props to drill and no risk of mobile/desktop ever showing different
 * data.
 */
export function CoverLetterMobilePreviewTrigger() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" className="fixed right-4 bottom-4 z-40 shadow-floating">
            <EyeIcon /> Preview
          </Button>
        }
      />
      <SheetContent side="bottom" className="flex flex-col" style={{ height: "92vh" }}>
        <SheetHeader>
          <SheetTitle>Live preview</SheetTitle>
          <SheetDescription>Updates as you edit — scroll to see the full letter.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <CoverLetterPreview />
        </div>
      </SheetContent>
    </Sheet>
  );
}
