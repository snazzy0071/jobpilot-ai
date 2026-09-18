"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CvPersonal, CvSummary, CvExperience, CvEducation, CvTemplate } from "@/lib/cvs/types";

export type CvPreviewData = {
  template: CvTemplate;
  personal: CvPersonal | null;
  summary: CvSummary | null;
  experience: CvExperience[];
  education: CvEducation[];
};

/** A row being actively typed into, keyed by its real id or "new" while adding — not yet saved. */
type LiveRow<T> = { key: string; data: Partial<T> };

type PreviewContextValue = {
  /** The merged view every editor form and the preview panel should read — saved data with any live, unsaved edits overlaid. */
  preview: CvPreviewData;
  setLivePersonal: (data: Partial<CvPersonal> | null) => void;
  setLiveSummary: (content: string | null) => void;
  setLiveExperience: (key: string, data: Partial<CvExperience> | null) => void;
  setLiveEducation: (key: string, data: Partial<CvEducation> | null) => void;
  /** Switches the preview's template instantly, before updateCvTemplate's own round trip completes — the "live" in live template switching. */
  setLiveTemplate: (template: CvTemplate | null) => void;
};

const PreviewContext = createContext<PreviewContextValue | null>(null);

/**
 * Holds the "as typed" state that makes the preview update immediately,
 * independent of the save round trip. `saved` is the server's actual
 * data (re-synced whenever the page revalidates after a successful
 * save); each form additionally reports its live, unsaved field values
 * here on every change, cleared once that specific save succeeds or is
 * cancelled — so the preview always shows either what's committed or
 * what's currently being typed, never a stale draft from a different
 * field.
 */
export function CvPreviewProvider({ initial, children }: { initial: CvPreviewData; children: ReactNode }) {
  // React's documented pattern for "reset state when a prop changes"
  // (react.dev/learn/you-might-not-need-an-effect) — adjusting state
  // directly during render, not inside an effect, so a fresh `initial`
  // from the server (after a save triggers revalidatePath) replaces
  // `saved` in the same render pass instead of the effect-based version's
  // extra cascading render.
  const [prevInitial, setPrevInitial] = useState(initial);
  const [saved, setSaved] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setSaved(initial);
  }

  const [livePersonal, setLivePersonalState] = useState<Partial<CvPersonal> | null>(null);
  const [liveSummary, setLiveSummaryState] = useState<string | null>(null);
  const [liveExperience, setLiveExperienceState] = useState<LiveRow<CvExperience> | null>(null);
  const [liveEducation, setLiveEducationState] = useState<LiveRow<CvEducation> | null>(null);
  const [liveTemplate, setLiveTemplateState] = useState<CvTemplate | null>(null);

  const preview = useMemo<CvPreviewData>(() => {
    const personal = livePersonal ? { ...(saved.personal ?? ({} as CvPersonal)), ...livePersonal } : saved.personal;
    const summary = liveSummary !== null ? { id: saved.summary?.id ?? "draft", content: liveSummary } : saved.summary;
    const template = liveTemplate ?? saved.template;

    const experience = saved.experience.map((row) =>
      liveExperience && liveExperience.key === row.id ? { ...row, ...liveExperience.data } : row,
    );
    if (liveExperience && liveExperience.key === "new") {
      experience.push({
        id: "preview-new-experience",
        jobTitle: "",
        employer: "",
        location: null,
        startDate: "",
        endDate: null,
        isCurrent: false,
        description: null,
        displayOrder: experience.length,
        ...liveExperience.data,
      });
    }

    const education = saved.education.map((row) =>
      liveEducation && liveEducation.key === row.id ? { ...row, ...liveEducation.data } : row,
    );
    if (liveEducation && liveEducation.key === "new") {
      education.push({
        id: "preview-new-education",
        institution: "",
        qualification: "",
        fieldOfStudy: null,
        location: null,
        startDate: null,
        endDate: null,
        isCurrent: false,
        grade: null,
        description: null,
        displayOrder: education.length,
        ...liveEducation.data,
      });
    }

    return { template, personal, summary, experience, education };
  }, [saved, livePersonal, liveSummary, liveExperience, liveEducation, liveTemplate]);

  const value: PreviewContextValue = {
    preview,
    setLivePersonal: (data) => setLivePersonalState((prev) => (data === null ? null : { ...prev, ...data })),
    setLiveSummary: setLiveSummaryState,
    setLiveExperience: (key, data) =>
      setLiveExperienceState((prev) =>
        data === null ? null : { key, data: prev && prev.key === key ? { ...prev.data, ...data } : data },
      ),
    setLiveEducation: (key, data) =>
      setLiveEducationState((prev) =>
        data === null ? null : { key, data: prev && prev.key === key ? { ...prev.data, ...data } : data },
      ),
    setLiveTemplate: setLiveTemplateState,
  };

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function useCvPreview(): PreviewContextValue {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("useCvPreview must be used within a CvPreviewProvider");
  return ctx;
}
