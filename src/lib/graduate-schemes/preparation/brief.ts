import { ASSESSMENT_LABELS, GRADUATE_SCHEME_SECTOR_LABELS, STUDY_STAGE_LABELS, type GraduateScheme } from "@/lib/graduate-schemes/types";

/**
 * A plain-text description of the scheme built ONLY from fields the record has — the starting point for the ATS check and the
 * mock interview when the user hasn't pasted the employer's own posting. It says nothing the employer's page didn't: absent
 * fields are left out, never guessed. A scan against this is only as informative as the record, and the journey says so.
 */
export function buildSchemeBrief(scheme: Pick<GraduateScheme, "employer" | "schemeName" | "sector" | "description" | "studyStages" | "locations" | "salary" | "assessments">): string {
  const lines = [`${scheme.schemeName} at ${scheme.employer}.`, `Sector: ${GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}.`];
  if (scheme.description) lines.push(scheme.description);
  if (scheme.studyStages.length > 0) lines.push(`Open to: ${scheme.studyStages.map((stage) => STUDY_STAGE_LABELS[stage]).join(", ")}.`);
  if (scheme.locations.length > 0) lines.push(`Locations: ${scheme.locations.join(", ")}.`);
  if (scheme.salary) lines.push(`Salary: ${scheme.salary}.`);
  const required = scheme.assessments.filter((assessment) => assessment.isRequired);
  if (required.length > 0) lines.push(`Selection process: ${required.map((assessment) => assessment.label ?? ASSESSMENT_LABELS[assessment.type]).join(", ")}.`);
  return lines.join("\n");
}
