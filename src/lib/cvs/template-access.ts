import { CV_TEMPLATE_SLUGS, type CvTemplate } from "@/config/cv-templates";

// The `cv_template_count` entitlement (plans table: Free 3, paid plans 24) is a NUMBER of templates, so which templates a plan gets
// has to be a fixed order. These are the ones a plan with the smallest allowance gets first: one modern, one classic, one graduate
// design (a spread of the styles), then the rest in catalogue order. A plan allowed N templates gets the first N.
export const TEMPLATE_ACCESS_ORDER: readonly CvTemplate[] = [
  "northlight",
  "oxford",
  "campus",
  ...CV_TEMPLATE_SLUGS.filter((slug) => !["northlight", "oxford", "campus"].includes(slug)),
];

/** `limit` is the plan's cv_template_count: a number, or null for "every template". Anything else fails closed to the smallest set. */
export function isTemplateAllowed(slug: string, limit: number | null | undefined): boolean {
  if (limit === null) return true;
  const allowed = typeof limit === "number" && Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  const position = (TEMPLATE_ACCESS_ORDER as readonly string[]).indexOf(slug);
  return position >= 0 && position < allowed;
}

export const TEMPLATE_LOCKED_MESSAGE = "That template is part of a paid plan. Your plan includes the first few designs; upgrade to use all 24.";
