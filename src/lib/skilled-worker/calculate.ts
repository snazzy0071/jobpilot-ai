import { RATE_RULES, type RateCategory } from "@/config/skilled-worker";

export type SalaryCheckInput = {
  /** Gross annual salary offered, in pounds. */
  salary: number;
  /** The going rate for the job's occupation code (from the official table), per year, in pounds. Null when the person has not looked it up. */
  goingRate: number | null;
  category: RateCategory;
};

export type SalaryCheck = {
  /** Whether the salary reaches the minimum that applies. Null when the going rate is unknown and the salary is above the floor, so it cannot be confirmed. */
  meets: boolean | null;
  /** The minimum that applies, per year. When the going rate is unknown this is only the floor, and `goingRateNeeded` says so. */
  required: number;
  floor: number;
  /** The going-rate part of the minimum (the share of the going rate), or null when the going rate is unknown. */
  fromGoingRate: number | null;
  goingRateNeeded: boolean;
  /** How far the salary is below the minimum (0 when it is not). */
  shortfall: number;
};

export function checkSalary({ salary, goingRate, category }: SalaryCheckInput): SalaryCheck {
  const rule = RATE_RULES[category];
  const fromGoingRate = goingRate === null ? null : Math.round(goingRate * rule.goingRateShare);
  const required = Math.max(rule.floor, fromGoingRate ?? 0);
  const shortfall = Math.max(0, required - salary);

  // Below the floor is a "no" whatever the going rate is. At or above it, we can only say yes once the going rate is known.
  let meets: boolean | null;
  if (salary < rule.floor) meets = false;
  else if (fromGoingRate === null) meets = null;
  else meets = salary >= required;

  return { meets, required, floor: rule.floor, fromGoingRate, goingRateNeeded: goingRate === null, shortfall };
}

/** Parses a pounds amount typed by a person: "£41,700", "41700", "41,700.50". Returns null for anything that is not a positive amount. */
export function parsePounds(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  return amount > 0 && amount <= 10_000_000 ? amount : null;
}

export function formatPounds(amount: number): string {
  return amount.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
}
