"use client";

import { EyeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { CvPreviewTabs } from "@/components/cvs/editor/cv-preview-tabs";
import type { CvSkill, CvProject, CvCertification, CvLanguage, CvCustomSection, SectionKey } from "@/lib/cvs/types";

type CvPreviewProps = {
  cvId: string;
  sectionOrder: SectionKey[];
  skills: CvSkill[];
  projects: CvProject[];
  certifications: CvCertification[];
  languages: CvLanguage[];
  customSections: CvCustomSection[];
};

/**
 * The mobile equivalent of the desktop split-view — used with
 * `lg:hidden` wherever it's rendered. A permanent second column doesn't
 * fit at phone widths, and the alternative (the preview just sitting at
 * the bottom of a single long stack of every section's form) isn't
 * "usable" in any real sense — you'd scroll past the whole CV to see
 * it. This is an on-demand, near-full-height bottom sheet instead: one
 * tap to check the live preview, one tap to dismiss and keep editing.
 * Renders the identical `CvPreview` the desktop column uses, so mobile
 * and desktop can never show a different preview by accident.
 */
export function MobilePreviewTrigger({ cvId, ...props }: CvPreviewProps) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" className="fixed right-4 bottom-4 z-40 shadow-floating">
            <EyeIcon /> Preview
          </Button>
        }
      />
      {/*
        `height` is set inline, not via a Tailwind class: SheetContent's
        own base classes include `data-[side=bottom]:h-auto`, and a
        plain `h-[92vh]` utility class isn't guaranteed to win that
        cascade fight (Tailwind orders utilities in the generated
        stylesheet by internal category, not by where a class appears in
        the `className` string, so a variant-scoped utility can still
        beat a later, unscoped one). An inline style always wins
        regardless — real bug, caught in this task's own browser
        verification: without it, the sheet grows to its full unclamped
        content height instead of being capped with internal scrolling,
        pushing its own close button off-screen above the viewport.
      */}
      <SheetContent side="bottom" className="flex flex-col" style={{ height: "92vh" }}>
        <SheetHeader>
          <SheetTitle>Live preview</SheetTitle>
          <SheetDescription>Updates as you edit — scroll to see the full CV.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <CvPreviewTabs cvId={cvId} {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
