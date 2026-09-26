import { computeFormatIssues } from "@/lib/cvs/ats-format-checks";
import type { CvEditorData, CvAtsFormatIssue, SectionKey } from "@/lib/cvs/types";
import { CV_READY_PERCENT } from "@/lib/graduate-schemes/preparation/progress";

export type ReadinessCheck = { key: string; label: string; ok: boolean; sectionKey: SectionKey };

export type CvReadiness = {
  /** 0-100: the share of the five essentials the CV has. */
  percent: number;
  checks: ReadinessCheck[];
  /** The deterministic format problems (src/lib/cvs/ats-format-checks.ts) still open. */
  issues: CvAtsFormatIssue[];
  /** Enough of the essentials are there AND no warning-level problems remain. */
  ready: boolean;
};

/**
 * "Is this CV ready to send?" — plain facts about what's in it (name + email, summary, a role, education, skills) plus the
 * same deterministic format checks the CV editor shows. No AI, so it is never wrong about what the CV actually contains.
 */
export function computeCvReadiness(cv: CvEditorData): CvReadiness {
  const checks: ReadinessCheck[] = [
    { key: "contact", label: "Name and email", ok: Boolean(cv.personal?.fullName?.trim() && cv.personal?.email?.trim()), sectionKey: "personal" },
    { key: "summary", label: "Professional summary", ok: Boolean(cv.summary?.content?.trim()), sectionKey: "summary" },
    { key: "experience", label: "At least one role", ok: cv.experience.length > 0, sectionKey: "experience" },
    { key: "education", label: "Education", ok: cv.education.length > 0, sectionKey: "education" },
    { key: "skills", label: "Skills", ok: cv.skills.length > 0, sectionKey: "skills" },
  ];
  const percent = Math.round((checks.filter((check) => check.ok).length / checks.length) * 100);
  const issues = computeFormatIssues(cv);
  return { percent, checks, issues, ready: percent >= CV_READY_PERCENT && !issues.some((issue) => issue.severity === "warning") };
}
