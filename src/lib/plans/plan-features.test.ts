import { describe, expect, it } from "vitest";
import { comparisonRows, formatPounds, minPlanForTool, monthsFreeAnnually, planBullets, type PublicPlan } from "@/lib/plans/plan-features";

const plan = (slug: string, tierOrder: number, monthly: number, annual: number, entitlements: Record<string, unknown>): PublicPlan => ({ slug, name: slug[0].toUpperCase() + slug.slice(1), tierOrder, monthlyPence: monthly, annualPence: annual, entitlements });

const base = { cv_limit: 1, job_match: false, auto_apply: false, job_tracker: true, support_tier: "email", grad_scheme_prep: false, linkedin_optimiser: false, voice_topups_allowed: false, visa_sponsor_register: true, cover_letter_generator: false, chat_interviews_per_month: 0, quick_ats_scans_per_month: 2, voice_interviews_per_month: 0, tailored_ats_scans_per_month: 0 };
const free = plan("free", 0, 0, 0, base);
const pro = plan("pro", 1, 600, 6000, { ...base, cv_limit: null, job_match: true, linkedin_optimiser: true, chat_interviews_per_month: 2, quick_ats_scans_per_month: null, tailored_ats_scans_per_month: null });
const premium = plan("premium", 2, 1500, 15000, { ...pro.entitlements, auto_apply: true, grad_scheme_prep: true, cover_letter_generator: true, chat_interviews_per_month: 8, voice_interviews_per_month: 4 });
const elite = plan("elite", 3, 2500, 25000, { ...premium.entitlements, chat_interviews_per_month: null, voice_interviews_per_month: 10, voice_topups_allowed: true, support_tier: "priority" });
const plans = [elite, free, premium, pro];

describe("comparisonRows: values come straight from the entitlements", () => {
  const rows = Object.fromEntries(comparisonRows(plans).map((row) => [row.label, row.values]));
  it("states limits exactly", () => {
    expect(rows["CV Builder"]).toEqual({ free: "1 CV", pro: "Unlimited", premium: "Unlimited", elite: "Unlimited" });
    expect(rows["ATS Scanner"].free).toBe("2 quick scans a month");
    expect(rows["ATS Scanner"].pro).toBe("Unlimited");
    expect(rows["Voice Interview Coach"]).toEqual({ free: false, pro: false, premium: "4 a month", elite: "10 a month" });
    expect(rows["Interview Coach (text)"]).toEqual({ free: false, pro: "2 a month", premium: "8 a month", elite: "Unlimited" });
  });
  it("shows booleans as included or not, never the other way round", () => {
    expect(rows["Cover Letter Generator"]).toEqual({ free: false, pro: false, premium: true, elite: true });
    expect(rows["Job Match Engine"]).toEqual({ free: false, pro: true, premium: true, elite: true });
    expect(rows["Assisted Auto-Apply"]).toEqual({ free: false, pro: false, premium: true, elite: true });
    expect(rows["Support"]).toEqual({ free: "Email", pro: "Email", premium: "Email", elite: "Priority" });
  });
  it("orders plans by tier regardless of input order", () => {
    expect(Object.keys(comparisonRows(plans)[0].values)).toEqual(["free", "pro", "premium", "elite"]);
  });
});

describe("planBullets", () => {
  it("lists what a tier adds over the one below, and nothing it already had", () => {
    const bullets = planBullets(premium, pro);
    expect(bullets[0]).toBe("Everything in Pro");
    expect(bullets).toContain("Cover Letter Generator");
    expect(bullets).toContain("Assisted Auto-Apply");
    expect(bullets).toContain("Voice Interview Coach: 4 a month");
    expect(bullets).not.toContain("LinkedIn Optimiser");
    expect(bullets).not.toContain("Job Match Engine");
  });
  it("mentions priority support and top-ups only where they are granted", () => {
    expect(planBullets(elite, premium)).toEqual(expect.arrayContaining(["Support: Priority", "Buy extra voice interviews when you run out"]));
    expect(planBullets(premium, pro).join()).not.toMatch(/Priority|extra voice/);
  });
  it("describes the free plan on its own terms", () => {
    expect(planBullets(free, null)).toEqual(["CV Builder: 1 CV", "ATS Scanner: 2 quick scans a month", "Job Tracker", "UK Visa Sponsor Register"]);
  });
});

describe("prices and availability", () => {
  it("works out the annual saving instead of asserting one", () => {
    expect(monthsFreeAnnually(pro)).toBe(2);
    expect(monthsFreeAnnually({ monthlyPence: 1000, annualPence: 12000 })).toBe(0);
    expect(monthsFreeAnnually(free)).toBe(0);
    expect(formatPounds(600)).toBe("£6");
    expect(formatPounds(1250)).toBe("£12.50");
  });
  it("finds the cheapest plan that includes each tool", () => {
    expect(minPlanForTool("cv", plans)).toBe("free");
    expect(minPlanForTool("ats", plans)).toBe("free");
    expect(minPlanForTool("cover-letter", plans)).toBe("premium");
    expect(minPlanForTool("linkedin", plans)).toBe("pro");
    expect(minPlanForTool("jobmatch", plans)).toBe("pro");
    expect(minPlanForTool("interview", plans)).toBe("pro");
    expect(minPlanForTool("gradprep", plans)).toBe("premium");
    expect(minPlanForTool("nonsense", plans)).toBeNull();
  });
});
