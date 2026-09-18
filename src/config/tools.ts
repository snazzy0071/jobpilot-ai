import {
  FileText,
  ScanSearch,
  Mail,
  MessagesSquare,
  Kanban,
  IdCard,
  Target,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import type { PlanTier } from "@/config/plans";

// Single source of truth for the 8 FeaturePage-backed tools — the
// homepage's tool grid and every feature page's "related tools" section
// both read from here instead of keeping their own copies.
export type Tool = {
  slug: string;
  href: string;
  icon: LucideIcon;
  title: string;
  shortDescription: string;
  plan: PlanTier;
  /** Real in-app destination once this tool has an actual dashboard page — undefined until then. */
  appHref?: string;
};

export const TOOLS: Tool[] = [
  {
    slug: "cv",
    href: "/features/cv",
    icon: FileText,
    title: "CV Builder",
    shortDescription: "UK-standard templates by sector and experience level.",
    plan: "free",
    appHref: "/dashboard/cvs",
  },
  {
    slug: "ats",
    href: "/features/ats",
    icon: ScanSearch,
    title: "ATS Scanner",
    shortDescription: "See how your CV reads before a human does.",
    plan: "free",
    appHref: "/dashboard/ats-scanner",
  },
  {
    slug: "cover-letter",
    href: "/features/cover-letter",
    icon: Mail,
    title: "Cover Letter Generator",
    shortDescription: "A tailored draft from your CV and the job details.",
    plan: "pro",
    appHref: "/dashboard/cover-letters",
  },
  {
    slug: "interview",
    href: "/features/interview",
    icon: MessagesSquare,
    title: "Interview Coach",
    shortDescription: "Practise competency-style questions and get feedback.",
    plan: "premium",
    appHref: "/dashboard/interview",
  },
  {
    slug: "tracker",
    href: "/features/tracker",
    icon: Kanban,
    title: "Job Tracker",
    shortDescription: "Every application from wishlist to offer, in one board.",
    plan: "free",
  },
  {
    slug: "linkedin",
    href: "/features/linkedin",
    icon: IdCard,
    title: "LinkedIn Optimiser",
    shortDescription: "Rewrites that match how UK recruiters actually search.",
    plan: "pro",
    appHref: "/dashboard/linkedin",
  },
  {
    slug: "jobmatch",
    href: "/features/jobmatch",
    icon: Target,
    title: "Job Match",
    shortDescription: "Live UK listings scored against your CV.",
    plan: "premium",
  },
  {
    slug: "gradprep",
    href: "/features/gradprep",
    icon: GraduationCap,
    title: "Grad Scheme Prep",
    shortDescription: "Aptitude test practice in real formats.",
    plan: "premium",
  },
];

export function getRelatedTools(currentSlug: string, count = 3): Tool[] {
  return TOOLS.filter((tool) => tool.slug !== currentSlug).slice(0, count);
}
