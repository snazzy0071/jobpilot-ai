/**
 * Skilled Worker visa salary rules used by the salary calculator. Every figure below was read from the Home Office's own GOV.UK
 * guidance (the two pages in `SOURCES`) on `VERIFIED_ON`; nothing here is estimated. The rules change, so the calculator shows this
 * date, links the sources, and the page says plainly it is a guide, not immigration advice. When GOV.UK changes, change the figures
 * and the date here, and nowhere else.
 */
export const VERIFIED_ON = "2026-09-26";

export const SOURCES = [
  { label: "GOV.UK: Skilled Worker visa, your job", href: "https://www.gov.uk/skilled-worker-visa/your-job" },
  { label: "GOV.UK: Skilled Worker visa, when you can be paid less", href: "https://www.gov.uk/skilled-worker-visa/when-you-can-be-paid-less" },
] as const;

export const GOING_RATES_URL = "https://www.gov.uk/government/publications/skilled-worker-visa-going-rates-for-eligible-occupations";

/** The general minimum salary a Skilled Worker must be paid, per year. */
export const GENERAL_THRESHOLD = 41_700;

export type RateCategory = "standard" | "new_entrant" | "phd_stem" | "phd_non_stem" | "postdoctoral";

export type RateRule = {
  label: string;
  /** The part of the occupation's going rate that has to be paid (1 = all of it). */
  goingRateShare: number;
  /** The lowest salary that can ever be enough, per year. */
  floor: number;
  /** Who this applies to, in the plain words GOV.UK uses. */
  who: string;
};

export const RATE_RULES: Record<RateCategory, RateRule> = {
  standard: {
    label: "Standard",
    goingRateShare: 1,
    floor: GENERAL_THRESHOLD,
    who: "Most Skilled Worker applicants: the higher of the general threshold and the full going rate for the job.",
  },
  new_entrant: {
    label: "New entrant",
    goingRateShare: 0.7,
    floor: 33_400,
    who: "Under 26 on the date you apply; currently or recently on a Student visa (bachelor's level or above) or a Graduate visa; or working towards a recognised qualification or chartered status in a UK regulated profession. Total stay is limited to 4 years.",
  },
  phd_stem: {
    label: "PhD (STEM)",
    goingRateShare: 0.8,
    floor: 33_400,
    who: "A UK PhD, or an equivalent overseas doctorate, in a STEM subject relevant to the job.",
  },
  phd_non_stem: {
    label: "PhD (non-STEM)",
    goingRateShare: 0.9,
    floor: 37_500,
    who: "A UK PhD, or an equivalent overseas doctorate, in a non-STEM subject relevant to the job.",
  },
  postdoctoral: {
    label: "Postdoctoral position",
    goingRateShare: 0.7,
    floor: 33_400,
    who: "A postdoctoral role in occupation codes 2111 to 2115, 2119, 2162 or 2311. Total stay is limited to 4 years.",
  },
};

export const RATE_CATEGORIES = Object.keys(RATE_RULES) as RateCategory[];
