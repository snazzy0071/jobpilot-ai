"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { updateCvTemplate } from "@/lib/cvs/actions";
import { CvSaveProvider, useCvSaves } from "@/components/cvs/editor/save-coordinator";
import { createTemplateSaver } from "@/components/cvs/editor/template-saver";
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
  /**
   * A row that was being added ("new") has just been saved and now has a real id. The live edit is handed over to
   * that id, so the preview shows the one row — not the saved row plus a second, live copy of it.
   */
  rekeyLiveExperience: (from: string, to: string) => void;
  rekeyLiveEducation: (from: string, to: string) => void;
  /**
   * The one way to change the template: the preview switches instantly, then it is saved to the database.
   * Saves are serialised (the last choice always wins), and if the database rejects one the preview is
   * reverted to the template that IS saved and the error is shown — the preview can never keep showing a
   * template the database doesn't have.
   */
  selectTemplate: (template: CvTemplate) => void;
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
export function CvPreviewProvider({
  cvId,
  versionId,
  initial,
  children,
}: {
  cvId: string;
  /** The version being edited. Live edits belong to it: when it changes (a restore), they are dropped. */
  versionId: string;
  initial: CvPreviewData;
  children: ReactNode;
}) {
  return (
    <CvSaveProvider>
      <PreviewState cvId={cvId} versionId={versionId} initial={initial}>
        {children}
      </PreviewState>
    </CvSaveProvider>
  );
}

function PreviewState({ cvId, versionId, initial, children }: { cvId: string; versionId: string; initial: CvPreviewData; children: ReactNode }) {
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

  // The live edits were typed into one version. When a different one becomes current (restoring from the version
  // history), they would otherwise sit on top of it — the preview would show the old name/headline/summary over the
  // restored CV. Dropped in the same render pass, like `saved` above, so there is never a frame with the two mixed.
  // (The template belongs to the CV, not the version, so its overlay is left alone.)
  const [prevVersionId, setPrevVersionId] = useState(versionId);
  if (versionId !== prevVersionId) {
    setPrevVersionId(versionId);
    setLivePersonalState(null);
    setLiveSummaryState(null);
    setLiveExperienceState(null);
    setLiveEducationState(null);
  }

  // The database is the source of truth for the template. `liveTemplate` is only an optimistic overlay while a
  // save is in flight; the saver reverts it on failure and adopts whatever the server renders after a refresh.
  const { track, register: registerFlush } = useCvSaves(); // both are stable for the provider's lifetime
  const [templateSaver] = useState(() =>
    createTemplateSaver<CvTemplate>({
      initial: initial.template,
      persist: async (template) => {
        const formData = new FormData();
        formData.set("cvId", cvId);
        formData.set("template", template);
        const result = await track("template", () => updateCvTemplate(undefined, formData));
        return result && typeof result === "object" && "error" in result ? { error: result.error } : null;
      },
      onOptimistic: (template) => setLiveTemplateState(template),
      onRevert: (persisted) => setLiveTemplateState(persisted),
    }),
  );
  useEffect(
    () =>
      registerFlush("template", async () => {
        const failure = await templateSaver.whenIdle();
        return failure ?? undefined;
      }),
    [registerFlush, templateSaver],
  );
  useEffect(() => {
    templateSaver.adopt(saved.template);
  }, [templateSaver, saved.template]);

  const preview = useMemo<CvPreviewData>(() => {
    const personal = livePersonal ? { ...(saved.personal ?? ({} as CvPersonal)), ...livePersonal } : saved.personal;
    const summary = liveSummary !== null ? { id: saved.summary?.id ?? "draft", content: liveSummary } : saved.summary;
    const template = liveTemplate ?? saved.template;

    const experience = saved.experience.map((row) =>
      liveExperience && liveExperience.key === row.id ? { ...row, ...liveExperience.data } : row,
    );
    if (liveExperience && !saved.experience.some((row) => row.id === liveExperience.key)) {
      experience.push({
        id: liveExperience.key === "new" ? "preview-new-experience" : liveExperience.key,
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
    if (liveEducation && !saved.education.some((row) => row.id === liveEducation.key)) {
      education.push({
        id: liveEducation.key === "new" ? "preview-new-education" : liveEducation.key,
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
    rekeyLiveExperience: (from, to) => setLiveExperienceState((prev) => (prev && prev.key === from ? { ...prev, key: to } : prev)),
    rekeyLiveEducation: (from, to) => setLiveEducationState((prev) => (prev && prev.key === from ? { ...prev, key: to } : prev)),
    selectTemplate: (template) => templateSaver.select(template),
  };

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function useCvPreview(): PreviewContextValue {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("useCvPreview must be used within a CvPreviewProvider");
  return ctx;
}
