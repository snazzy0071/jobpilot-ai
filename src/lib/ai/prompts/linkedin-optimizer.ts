import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";
import { LINKEDIN_TARGET_SENIORITY_LABELS, type LinkedinTargetSeniority } from "@/lib/linkedin/types";

/**
 * No LinkedIn API/OAuth integration exists anywhere in this app (this
 * feature's own "without LinkedIn credentials" scope) — every field here
 * is text the user pasted in by hand, not anything read from a real
 * profile. `currentHeadline`/`currentAbout` are optional (both are
 * optional on LinkedIn itself); `currentExperience` is the one thing
 * there's nothing useful to rewrite without.
 */
export type LinkedinOptimizerInput = {
  currentHeadline: string;
  currentAbout: string;
  currentExperience: string;
  targetRole: string;
  targetSeniority: LinkedinTargetSeniority;
};

const headlineVariantField = (style: string) =>
  z
    .string()
    .min(1)
    .max(220)
    .describe(`A ${style} rewritten LinkedIn headline (LinkedIn's own limit is 220 characters).`);

export const linkedinHeadlineVariantsSchema = z.object({
  concise: headlineVariantField("short, punchy"),
  narrative: headlineVariantField("fuller, story-driven — reads like a sentence, not a keyword list"),
  keywordDense: headlineVariantField("keyword-dense, optimised for recruiter search"),
});
export type LinkedinHeadlineVariants = z.infer<typeof linkedinHeadlineVariantsSchema>;

const linkedinKeywordImportanceSchema = z
  .enum(["high", "medium", "low"])
  .describe("high = a term recruiters searching this role/seniority almost always use; low = relevant but niche or occasional.");

export const linkedinKeywordTermSchema = z.object({
  term: z.string().min(1).max(60),
  importance: linkedinKeywordImportanceSchema,
  suggestedPlacement: z
    .enum(["headline", "about", "experience"])
    .describe("Which profile section this kind of term most naturally belongs in — not conditioned on whether it's currently present or missing."),
});

export type LinkedinKeywordTermOutput = z.infer<typeof linkedinKeywordTermSchema>;

export const linkedinOptimizerSchema = z.object({
  headlineVariants: linkedinHeadlineVariantsSchema.describe(
    "Three distinct headline rewrites of the same underlying facts — concise, narrative, and keyword-dense — not three phrasings of one idea.",
  ),
  about: z.string().min(1).max(2600).describe("Rewritten LinkedIn About section (LinkedIn's own limit is 2,600 characters)."),
  experienceBullets: z
    .array(z.string().min(1).max(300))
    .min(1)
    .max(12)
    .describe(
      "Rewritten first-person Experience bullet points, one per achievement/responsibility — do not merge distinct roles from the pasted Experience section into a single bullet.",
    ),
  suggestedSkills: z.array(z.string().min(1).max(60)).min(3).max(15),
  notes: z.array(z.string().min(1).max(240)).max(5).describe("Any other concrete profile suggestions, e.g. featured section ideas."),
  keywordCoverageTerms: z
    .array(linkedinKeywordTermSchema)
    .min(8)
    .max(20)
    .describe(
      "The terms a recruiter would actually type into LinkedIn's search to find someone for this target role/seniority — real recruiter search behaviour (skills, tools, certifications, job-title synonyms), not a generic keyword-stuffing list. Independent of what the candidate has pasted — whether each one is actually present gets checked separately, deterministically, against the current profile text.",
    ),
});

export type LinkedinOptimizerOutput = z.infer<typeof linkedinOptimizerSchema>;

export const linkedinOptimizerPrompt: PromptDefinition<LinkedinOptimizerInput, LinkedinOptimizerOutput> = {
  id: "linkedin_optimizer",
  version: "4.0.0",
  operation: "linkedin_optimizer",
  schema: linkedinOptimizerSchema,
  buildSystem: () =>
    [
      "You are a LinkedIn profile optimisation assistant helping a candidate improve their own profile text — you " +
        "have no access to their real LinkedIn profile, only the headline/About/Experience text they pasted in " +
        "directly, so never assume anything about their profile beyond what's given.",
      "Rewrite a headline (as three genuinely distinct variants — concise, narrative, and keyword-dense, not the " +
        "same sentence three ways), an About section, and Experience bullet points that are keyword-rich for " +
        "recruiter search, specific about real experience, and written in a natural first-person voice (About " +
        "sections and Experience bullets on LinkedIn are first person, unlike CV bullets).",
      "Respect LinkedIn's real character limits: headline 220 characters, About 2,600 characters.",
      "experienceBullets must rewrite what the user actually pasted about their experience into distinct, punchy, " +
        "first-person bullet points — do not merge separate roles or achievements into one bullet, and do not " +
        "invent roles, employers, or achievements not present in the pasted text.",
      "suggestedSkills must be skills genuinely evidenced by the pasted headline/About/Experience content, not " +
        "generic skills for the target role that aren't backed by the person's actual background.",
      "keywordCoverageTerms is a different judgment from suggestedSkills — it's the vocabulary a recruiter actually " +
        "searches with for this target role and seniority in general, drawn from how LinkedIn recruiter search " +
        "really works, not filtered by what the candidate happens to have pasted. Whether each term is present in " +
        "the candidate's own text is checked separately and exactly by the application, not by you — just name the " +
        "real terms and, for each, the one profile section (headline/about/experience) that kind of term most " +
        "naturally belongs in.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      `Target role: ${input.targetRole}`,
      `Target seniority: ${LINKEDIN_TARGET_SENIORITY_LABELS[input.targetSeniority]}`,
      "",
      input.currentHeadline ? `Current headline: ${input.currentHeadline}` : "Current headline: (none provided)",
      "",
      input.currentAbout ? `Current About section: ${input.currentAbout}` : "Current About section: (none provided)",
      "",
      "Current Experience section, as pasted:",
      input.currentExperience,
      "",
      "Rewrite the headline, About section, and Experience bullets for this target role and seniority, and list " +
        "the real recruiter-search keywords for this target role and seniority.",
    ].join("\n"),
};
