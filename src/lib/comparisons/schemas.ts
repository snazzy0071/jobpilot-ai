import { z } from "zod";
import { JOBPILOT_LEVELS, SUPPORT_LEVELS } from "@/lib/comparisons/types";
import { todayInUk } from "@/lib/graduate-schemes/status";
import { ukLocalToIso } from "@/lib/advice/schemas";

// Write-side validation. The rule that matters: nothing about a competitor is accepted without where it came from and when it was
// checked. Sources must be http(s) links (never javascript:/data:), and dates can't be in the future.

const text = (max: number, message = "This can't be empty.") => z.string().trim().min(1, message).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish().transform((value) => (value ? value : null));

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Sources must be web links starting with http:// or https://.");

const pastDate = z
  .string()
  .trim()
  .refine((value) => z.iso.date().safeParse(value).success, "Enter a valid date.")
  .refine((value) => value <= todayInUk(), "A check date can't be in the future.");

const evidence = { sourceUrl: httpUrl, sourceDate: pastDate };

export const featureSchema = z
  .object({
    label: text(120, "Every feature needs a name."),
    competitor: z.enum(SUPPORT_LEVELS),
    competitorNote: optionalText(300),
    jobpilot: z.enum(JOBPILOT_LEVELS),
    jobpilotNote: optionalText(300),
    sourceUrl: z.string().trim().nullish().transform((value) => (value ? value : null)),
    sourceDate: z.string().trim().nullish().transform((value) => (value ? value : null)),
  })
  .superRefine((feature, ctx) => {
    if (feature.competitor === "unknown") {
      // Not confirmed: nothing to cite. (A stray source on an unconfirmed row would look like evidence for nothing.)
      if (feature.sourceUrl || feature.sourceDate) ctx.addIssue({ code: "custom", message: `"${feature.label}" is marked Not confirmed, so it shouldn't carry a source.`, path: ["sourceUrl"] });
      return;
    }
    const url = httpUrl.safeParse(feature.sourceUrl ?? "");
    if (!url.success) ctx.addIssue({ code: "custom", message: `"${feature.label}" needs a source link — ${feature.sourceUrl ? url.error.issues[0].message : "say where you checked it."}`, path: ["sourceUrl"] });
    const date = pastDate.safeParse(feature.sourceDate ?? "");
    if (!date.success) ctx.addIssue({ code: "custom", message: `"${feature.label}" needs the date you checked its source (not in the future).`, path: ["sourceDate"] });
  });

export const pricingSchema = z.object({ plan: text(100, "Every pricing note needs a plan name."), price: text(100, "Enter the price as the competitor publishes it."), notes: optionalText(300), ...evidence });

export const differenceSchema = z.object({ title: text(120, "Every difference needs a title."), competitor: text(500, "Say what the competitor does."), jobpilot: text(500, "Say what JobPilot AI does."), ...evidence });

export const faqSchema = z
  .object({
    question: text(200, "Every FAQ needs a question."),
    answer: text(1000, "Every FAQ needs an answer."),
    sourceUrl: z.string().trim().nullish().transform((value) => (value ? value : null)),
    sourceDate: z.string().trim().nullish().transform((value) => (value ? value : null)),
  })
  .superRefine((faq, ctx) => {
    if (!faq.sourceUrl && !faq.sourceDate) return; // an FAQ about JobPilot itself needs no competitor source
    if (!httpUrl.safeParse(faq.sourceUrl ?? "").success) ctx.addIssue({ code: "custom", message: `FAQ "${faq.question}": the source must be a web link.`, path: ["sourceUrl"] });
    if (!pastDate.safeParse(faq.sourceDate ?? "").success) ctx.addIssue({ code: "custom", message: `FAQ "${faq.question}": add the date you checked that source.`, path: ["sourceDate"] });
  });

/** A JSON list field from the form: parsed, then each item validated with its own message. */
function jsonList<T extends z.ZodTypeAny>(label: string, item: T, max: number) {
  return z
    .string()
    .optional()
    .transform((value, ctx): z.output<T>[] => {
      if (!value) return [];
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: `${label} couldn't be read — try again.` });
        return z.NEVER;
      }
      const result = z.array(item).max(max, `Too many ${label.toLowerCase()} (${max} at most).`).safeParse(parsed);
      if (!result.success) {
        ctx.addIssue({ code: "custom", message: result.error.issues[0].message });
        return z.NEVER;
      }
      return result.data;
    });
}

const fields = {
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a URL slug, e.g. jobscan.")
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case letters, numbers and single hyphens for the URL slug."),
  competitorName: text(100, "Enter the competitor's name."),
  competitorWebsite: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || httpUrl.safeParse(value).success, "The website must be a web link starting with http:// or https://."),
  intro: optionalText(1500),
  features: jsonList("Features", featureSchema, 40),
  pricing: jsonList("Pricing notes", pricingSchema, 12),
  differences: jsonList("Differences", differenceSchema, 12),
  faqs: jsonList("FAQs", faqSchema, 20),
  updatedOn: pastDate,
  publishAt: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const iso = ukLocalToIso(value);
      if (!iso) ctx.addIssue({ code: "custom", message: "Enter a valid publish date and time." });
      return iso;
    }),
};

export const createComparisonSchema = z.object(fields);
export const updateComparisonSchema = z.object({ id: z.string().uuid(), ...fields });
export const comparisonIdSchema = z.object({ id: z.string().uuid() });
export const setPublishedSchema = z.object({ id: z.string().uuid(), published: z.boolean() });
export type ComparisonInput = z.infer<typeof createComparisonSchema>;
