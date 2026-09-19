import { getVisibleContent } from "@/components/cvs/templates/content";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type { CvAtsFormatIssue } from "@/lib/cvs/types";

// Deterministic, code-computed — deliberately not AI. These are real
// facts about what's actually in the CV (a missing field, a short
// description), so there's nothing to "invent": either the data is
// there or it isn't. Pure and framework-agnostic so the exact same
// checks run server-side (initial page load) and client-side (live, on
// every keystroke, via useCvPreview — see AtsPreflightPanel), which is
// what keeps "re-score after edits" free and instant for this half of
// the pre-flight check.
export function computeFormatIssues(data: CvTemplateContentData): CvAtsFormatIssue[] {
  const issues: CvAtsFormatIssue[] = [];
  const visible = getVisibleContent(data);

  if (!data.personal?.fullName.trim()) {
    issues.push({
      id: "personal-name",
      severity: "warning",
      message: "Add your full name — it's the first thing an ATS and a recruiter both look for.",
      sectionKey: "personal",
    });
  }
  if (!data.personal?.email?.trim() && !data.personal?.phone?.trim()) {
    issues.push({
      id: "personal-contact",
      severity: "warning",
      message: "Add an email or phone number so an employer can actually reach you.",
      sectionKey: "personal",
    });
  }

  const summaryText = data.summary?.content.trim() ?? "";
  if (!summaryText) {
    issues.push({
      id: "summary-missing",
      severity: "warning",
      message: "Add a professional summary — most ATS systems and recruiters expect one at the top of the CV.",
      sectionKey: "summary",
    });
  } else if (summaryText.length < 40) {
    issues.push({
      id: "summary-short",
      severity: "info",
      message: "Your summary is quite short — a couple more sentences gives keyword matching more to work with.",
      sectionKey: "summary",
    });
  }

  if (visible.experience.length === 0) {
    issues.push({
      id: "experience-missing",
      severity: "warning",
      message: "Add at least one role — ATS scoring and recruiters both weigh work experience most heavily.",
      sectionKey: "experience",
    });
  }
  for (const row of visible.experience) {
    const label = [row.jobTitle, row.employer].filter((part) => part.trim()).join(" at ") || "This role";
    const description = row.description?.trim() ?? "";
    if (!description) {
      issues.push({
        id: `experience-desc-${row.id}`,
        severity: "warning",
        message: `Add a description for "${label}" — role duties are what most ATS keyword matching actually reads.`,
        sectionKey: "experience",
      });
    } else if (description.length < 40) {
      issues.push({
        id: `experience-thin-${row.id}`,
        severity: "info",
        message: `"${label}"'s description is quite short — a bullet or two on what you actually did gives more for keyword matching to work with.`,
        sectionKey: "experience",
      });
    }
  }

  if (visible.skills.length === 0) {
    issues.push({
      id: "skills-missing",
      severity: "warning",
      message: "Add some skills — ATS keyword matching relies heavily on this section.",
      sectionKey: "skills",
    });
  }

  return issues;
}

const MAX_CV_TEXT_LENGTH = 12000;

/** Plain text of exactly what's visible in the live preview — same `getVisibleContent` filter, so a scan never reads a hidden item the CV itself doesn't show. */
export function buildCvPlainText(data: CvTemplateContentData): string {
  const visible = getVisibleContent(data);
  const lines: string[] = [];

  if (data.personal) {
    lines.push([data.personal.fullName, data.personal.headline].filter(Boolean).join(" — "));
  }

  const summaryText = data.summary?.content.trim();
  if (summaryText) lines.push("", "Summary:", summaryText);

  if (visible.experience.length > 0) {
    lines.push("", "Experience:");
    for (const row of visible.experience) {
      const heading = [row.jobTitle, row.employer].filter((part) => part.trim()).join(" at ");
      lines.push(`- ${heading}${row.description ? `: ${row.description}` : ""}`);
    }
  }

  if (visible.education.length > 0) {
    lines.push("", "Education:");
    for (const row of visible.education) {
      lines.push(`- ${[row.qualification, row.institution].filter((part) => part.trim()).join(", ")}`);
    }
  }

  if (visible.skills.length > 0) {
    lines.push("", "Skills:", visible.skills.map((row) => row.name).join(", "));
  }

  if (visible.projects.length > 0) {
    lines.push("", "Projects:");
    for (const row of visible.projects) {
      lines.push(`- ${row.name}${row.description ? `: ${row.description}` : ""}`);
    }
  }

  if (visible.certifications.length > 0) {
    lines.push("", "Certifications:", visible.certifications.map((row) => row.name).join(", "));
  }

  if (visible.languages.length > 0) {
    lines.push("", "Languages:", visible.languages.map((row) => row.name).join(", "));
  }

  for (const row of visible.customSections) {
    lines.push("", `${row.title}:`, row.content ?? "");
  }

  return lines.join("\n").trim().slice(0, MAX_CV_TEXT_LENGTH);
}

