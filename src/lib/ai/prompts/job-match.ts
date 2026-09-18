import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";

export type JobMatchInput = {
  cvText: string;
  jobTitle: string;
  jobDescription: string;
};

// One score + a one-line reason why, for each of the four dimensions —
// this is what makes the persisted match "transparent" rather than a
// single opaque number: src/lib/jobs/matching/actions.ts stores every
// field here as its own column pair on job_matches (migration 0061),
// not just matchScore.
const jobMatchComponentSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(240),
});

export type JobMatchComponent = z.infer<typeof jobMatchComponentSchema>;

export const jobMatchSchema = z.object({
  // The headline number — a holistic read, not a mechanical average of
  // the four components below (same "don't let a high score on one
  // prop up another, but don't force a rigid formula either" philosophy
  // src/lib/ai/prompts/ats-scan.ts's own `overall` field already uses:
  // one genuine dealbreaker should be able to sink this even if every
  // individual component looks reasonable in isolation).
  matchScore: z.number().int().min(0).max(100),
  coreSkills: jobMatchComponentSchema.describe(
    "How well the CV evidences the specific, named skills and requirements this job listing calls essential — not just presence, but real depth of experience with them.",
  ),
  techFunctionalSkills: jobMatchComponentSchema.describe(
    "How well the CV evidences the specific tools, technologies, platforms, and functional working methods (e.g. Agile delivery, financial modelling, clinical trial management) the role calls for.",
  ),
  domainFit: jobMatchComponentSchema.describe(
    "How closely the candidate's industry/sector background matches this role's domain — genuinely transferable experience in the same or an adjacent field, not just general competence.",
  ),
  seniority: jobMatchComponentSchema.describe(
    "Whether the candidate's evidenced level of responsibility and experience (years, scope of past roles, title progression) matches what this role expects — too junior and too senior both score low here.",
  ),
  reasons: z.array(z.string().min(1).max(240)).min(1).max(5).describe("Concrete reasons behind the overall assessment."),
  gaps: z.array(z.string().min(1).max(240)).max(5).describe("Genuine gaps between the CV and this role's requirements."),
});

export type JobMatchOutput = z.infer<typeof jobMatchSchema>;

export const jobMatchPrompt: PromptDefinition<JobMatchInput, JobMatchOutput> = {
  id: "job_match",
  version: "2.0.0",
  operation: "job_match",
  schema: jobMatchSchema,
  buildSystem: () =>
    [
      "You are a job-matching assistant helping a candidate decide whether a specific job listing is worth applying " +
        "to, given their CV.",
      "Score matchScore and all four components independently, each 0-100 — coreSkills, techFunctionalSkills, " +
        "domainFit, and seniority. matchScore is your holistic overall read, not a mechanical average of the other " +
        "four: a single fundamental mismatch (wrong field entirely, or a hard requirement the CV shows no evidence " +
        "of at all) should be able to sink matchScore even if some individual components still look reasonable.",
      "Each component needs a one-line `summary` explaining specifically why it scored where it did, referencing " +
        "the CV and job description actually given — never a generic statement that could apply to any candidate " +
        "or any role.",
      "reasons and gaps must be concrete and specific for the same reason — reference real evidence from the texts " +
        "given, not assumptions about the role or the candidate.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      `Job title: ${input.jobTitle}`,
      "",
      "Job description:",
      input.jobDescription,
      "",
      "Candidate's CV:",
      input.cvText,
      "",
      "Assess this match across matchScore and all four components.",
    ].join("\n"),
};
