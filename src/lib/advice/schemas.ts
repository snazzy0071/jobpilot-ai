import { z } from "zod";
import { ADVICE_CATEGORIES } from "@/lib/advice/categories";
import { slugify } from "@/lib/graduate-schemes/slug";
import { todayInUk } from "@/lib/graduate-schemes/status";
import type { ContentBlock } from "@/lib/content/blocks";

// Write-side validation of a guide. The content is the same typed-block shape the Blog uses (src/lib/content/blocks.ts) — never
// raw HTML — with tighter limits, and heading ids that are guaranteed present and unique so the table of contents always works.

const text = (max: number) => z.string().trim().min(1, "This can't be empty.").max(max);

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: text(5000) }),
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), id: z.string().trim().max(100).default(""), text: text(200) }),
  z.object({ type: z.literal("list"), items: z.array(text(1000)).min(1, "A list needs at least one item.").max(30) }),
  z.object({ type: z.literal("quote"), text: text(1000) }),
]);

/** Fills a missing heading id from its text and makes every id unique (`intro`, `intro-2`, ...), so the table of contents can link to each one. */
export function normaliseHeadingIds(blocks: ContentBlock[]): ContentBlock[] {
  const used = new Set<string>();
  return blocks.map((block) => {
    if (block.type !== "heading") return block;
    const base = slugify(block.id || block.text) || "section";
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return { ...block, id };
  });
}

const contentSchema = z
  .string()
  .transform((value, ctx): ContentBlock[] => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "The content isn't valid — try again." });
      return z.NEVER;
    }
    const result = z.array(blockSchema).min(1, "Add at least one content block.").max(200, "That's too many blocks.").safeParse(parsed);
    if (!result.success) {
      ctx.addIssue({ code: "custom", message: result.error.issues[0].message });
      return z.NEVER;
    }
    return normaliseHeadingIds(result.data as ContentBlock[]);
  });

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .refine((value) => value === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value), "Use lower-case letters, numbers and single hyphens for the URL slug.");

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => (value ? value : null));

/** "2026-09-30T14:30" typed in the admin form, read as UK time (not the server's zone) and returned as an ISO instant; blank -> null. */
export function ukLocalToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  const date = new Date(guess - (shown - guess));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const fields = {
  slug: slugSchema,
  title: text(200),
  summary: text(500),
  category: z.enum(ADVICE_CATEGORIES, "Choose a category."),
  content: contentSchema,
  featuredRank: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 100), "Featured order must be a whole number from 1 to 100 (or blank)."),
  relatedSlugs: z
    .string()
    .optional()
    .transform((value) => [...new Set((value ?? "").split(/[\s,]+/).map((slug) => slug.trim().toLowerCase()).filter(Boolean))])
    .refine((slugs) => slugs.length <= 6, "Pick at most 6 related guides.")
    .refine((slugs) => slugs.every((slug) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)), "Related guides are given by slug, separated by commas."),
  authorName: optionalText(100),
  reviewedOn: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || z.iso.date().safeParse(value).success, "Enter a valid review date.")
    .refine((value) => value === null || value <= todayInUk(), "The review date can't be in the future."),
  // Blank = leave as is / draft; a value schedules (or backdates) the publish time.
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

export const createGuideSchema = z.object(fields);
export const updateGuideSchema = z.object({ id: z.string().uuid(), ...fields });
export const guideIdSchema = z.object({ id: z.string().uuid() });
export const setPublishedSchema = z.object({ id: z.string().uuid(), published: z.boolean() });
export const setFeaturedSchema = z.object({ id: z.string().uuid(), featured: z.boolean() });

export type GuideInput = z.infer<typeof createGuideSchema>;
