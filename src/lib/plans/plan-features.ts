import { TOOL_ENTITLEMENT_CHECKS } from "@/lib/entitlements/tool-checks";

// Everything the public pricing page and the feature pages say about "what each plan includes" is worked out here from the plans
// table's own entitlements (the same values the server enforces), so a marketing page can never promise something the database
// does not grant, or hide something it does.

export type PublicPlan = {
  slug: string;
  name: string;
  tierOrder: number;
  monthlyPence: number;
  annualPence: number;
  entitlements: Record<string, unknown>;
};

export type RowValue = boolean | string;

type Entitlements = Record<string, unknown>;

const perMonth = (value: unknown): RowValue => {
  if (value === null) return "Unlimited";
  if (typeof value === "number") return value <= 0 ? false : `${value} a month`;
  return false;
};

const flag = (value: unknown): RowValue => value === true;

const ats = (e: Entitlements): RowValue => {
  const quick = e.quick_ats_scans_per_month;
  const tailored = e.tailored_ats_scans_per_month;
  if (quick === null && tailored === null) return "Unlimited";
  const parts: string[] = [];
  if (quick === null) parts.push("Unlimited quick scans");
  else if (typeof quick === "number" && quick > 0) parts.push(`${quick} quick scans a month`);
  if (tailored === null) parts.push("Unlimited tailored scans");
  else if (typeof tailored === "number" && tailored > 0) parts.push(`${tailored} tailored scans a month`);
  return parts.length ? parts.join(", ") : false;
};

const cvs = (e: Entitlements): RowValue => {
  const limit = e.cv_limit;
  if (limit === null) return "Unlimited";
  if (typeof limit === "number") return `${limit} CV${limit === 1 ? "" : "s"}`;
  return false;
};

export type FeatureRow = { id: string; label: string; value: (entitlements: Entitlements) => RowValue };

/** The rows of the comparison table, in display order. */
export const FEATURE_ROWS: FeatureRow[] = [
  { id: "cv", label: "CV Builder", value: cvs },
  { id: "ats", label: "ATS Scanner", value: ats },
  { id: "cover-letter", label: "Cover Letter Generator", value: (e) => flag(e.cover_letter_generator) },
  { id: "linkedin", label: "LinkedIn Optimiser", value: (e) => flag(e.linkedin_optimiser) },
  { id: "interview-chat", label: "Interview Coach (text)", value: (e) => perMonth(e.chat_interviews_per_month) },
  { id: "interview-voice", label: "Voice Interview Coach", value: (e) => perMonth(e.voice_interviews_per_month) },
  { id: "jobmatch", label: "Job Match Engine", value: (e) => flag(e.job_match) },
  { id: "gradprep", label: "Grad Scheme Prep", value: (e) => flag(e.grad_scheme_prep) },
  { id: "auto-apply", label: "Assisted Auto-Apply", value: (e) => flag(e.auto_apply) },
  { id: "tracker", label: "Job Tracker", value: (e) => flag(e.job_tracker) },
  { id: "sponsors", label: "UK Visa Sponsor Register", value: (e) => flag(e.visa_sponsor_register) },
  { id: "support", label: "Support", value: (e) => (e.support_tier === "priority" ? "Priority" : "Email") },
];

export function sortPlans(plans: PublicPlan[]): PublicPlan[] {
  return [...plans].sort((a, b) => a.tierOrder - b.tierOrder);
}

/** Comparison-table rows: one value per plan, straight from the entitlements. */
export function comparisonRows(plans: PublicPlan[]): { label: string; values: Record<string, RowValue> }[] {
  return FEATURE_ROWS.map((row) => ({
    label: row.label,
    values: Object.fromEntries(sortPlans(plans).map((plan) => [plan.slug, row.value(plan.entitlements)])),
  }));
}

const describe = (row: FeatureRow, value: RowValue): string => (value === true ? row.label : `${row.label}: ${value}`);

/** What a plan adds over the one below it (rows that turned on, or whose value changed), as short bullet lines. */
export function planBullets(plan: PublicPlan, previous: PublicPlan | null): string[] {
  const lines: string[] = [];
  if (previous) lines.push(`Everything in ${previous.name}`);
  for (const row of FEATURE_ROWS) {
    if (row.id === "support" && plan.entitlements.support_tier !== "priority") continue;
    const now = row.value(plan.entitlements);
    const before = previous ? row.value(previous.entitlements) : false;
    if (now === false) continue;
    if (previous && now === before) continue;
    lines.push(describe(row, now));
  }
  if (plan.entitlements.voice_topups_allowed === true) lines.push("Buy extra voice interviews when you run out");
  return lines;
}

/** Whole months free when paying annually (12 minus annual/monthly), or 0 when there is no saving. */
export function monthsFreeAnnually(plan: Pick<PublicPlan, "monthlyPence" | "annualPence">): number {
  if (plan.monthlyPence <= 0 || plan.annualPence <= 0) return 0;
  return Math.max(0, Math.floor(12 - plan.annualPence / plan.monthlyPence + 1e-9));
}

export function formatPounds(pence: number): string {
  const pounds = pence / 100;
  return `£${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`;
}

/** The cheapest plan that includes a tool, from the tool's own entitlement checks; null if no plan does (or the tool has no checks). */
export function minPlanForTool(toolSlug: string, plans: PublicPlan[]): string | null {
  const checks = TOOL_ENTITLEMENT_CHECKS[toolSlug];
  if (!checks || checks.length === 0) return null;
  for (const plan of sortPlans(plans)) {
    const included = checks.some((check) => {
      const value = plan.entitlements[check.key];
      if (check.kind === "feature") return value === true;
      return value === null || (typeof value === "number" && value > 0);
    });
    if (included) return plan.slug;
  }
  return null;
}
