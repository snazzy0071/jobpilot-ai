"use client";

import { useEffect, useState } from "react";
import {
  UserIcon,
  FileTextIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  WrenchIcon,
  FolderKanbanIcon,
  AwardIcon,
  LanguagesIcon,
  LayoutListIcon,
} from "lucide-react";
import { jumpToSection, sectionAnchorId } from "@/components/cvs/editor/jump-to-section";
import { SECTION_LABELS, type SectionKey } from "@/lib/cvs/types";
import { cn } from "@/lib/utils";

// Owned here, not passed in as a prop: a server component can't hand a
// lucide icon (a plain function reference) to this client component
// (RSC only allows passing already-rendered JSX elements or plain data
// across that boundary) — since the mapping is fixed per SectionKey
// anyway, it belongs here rather than being threaded through page.tsx.
const SECTION_ICONS: Partial<Record<SectionKey, typeof UserIcon>> = {
  personal: UserIcon,
  summary: FileTextIcon,
  experience: BriefcaseIcon,
  education: GraduationCapIcon,
  skills: WrenchIcon,
  projects: FolderKanbanIcon,
  certifications: AwardIcon,
  languages: LanguagesIcon,
  customSections: LayoutListIcon,
};

/**
 * reference/auth/create-cv.png's numbered step pills (1 Personal, 2
 * Summary, 3 Experience, ...). Unlike the reference, this isn't a
 * wizard that hides other sections — every section is already visible
 * in one scrollable page (see page.tsx), same as before this task, so
 * clicking a pill just calls the existing `jumpToSection` (expand-if-
 * collapsed + scroll) rather than switching a "current step". The
 * highlighted pill tracks scroll position via IntersectionObserver,
 * matching the reference's "1 Personal" staying highlighted while
 * that section is in view.
 */
export function SectionNav({ sections }: { sections: SectionKey[] }) {
  const [activeKey, setActiveKey] = useState<SectionKey | null>(sections[0] ?? null);

  useEffect(() => {
    const elements = sections
      .map((key) => document.getElementById(sectionAnchorId(key)))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const key = sections.find((k) => sectionAnchorId(k) === topMost.target.id);
        if (key) setActiveKey(key);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="Jump to CV section" className="flex flex-wrap gap-2">
      {sections.map((key, index) => {
        const Icon = SECTION_ICONS[key];
        const active = key === activeKey;
        return (
          <button
            key={key}
            type="button"
            onClick={() => jumpToSection(key)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-card"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                active ? "bg-primary-foreground/20" : "bg-muted",
              )}
            >
              {index + 1}
            </span>
            {Icon && <Icon className="size-3.5" />}
            {SECTION_LABELS[key]}
          </button>
        );
      })}
    </nav>
  );
}
