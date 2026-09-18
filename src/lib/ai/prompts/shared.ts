// Cross-cutting instructions reused across every prompt below, so a
// fix or refinement to "don't invent things" or "UK conventions" only
// needs to happen in one place — the exact same reasoning as
// src/config/plans.ts being one source of truth instead of six.

/**
 * Every one of these prompts risks the same failure mode: the model
 * fills a gap with something plausible-sounding but false — a metric
 * that wasn't in the input, a skill the user never mentioned, a company
 * achievement invented to sound impressive. Included verbatim in every
 * system prompt below.
 */
export const ANTI_FABRICATION_INSTRUCTION =
  "Never invent facts, numbers, dates, skills, or achievements that are not present in the information provided. " +
  "If something would be stronger with a specific detail (a metric, a team size, a percentage) but that detail isn't " +
  "given, write it generically rather than inventing a plausible-sounding number.";

export const UK_CONVENTIONS_INSTRUCTION =
  "Write for a UK audience: British English spelling, UK CV/professional conventions, and no assumption of a US-style " +
  "resume format.";
