// Single source of truth for public-site navigation — every link the
// header/footer render comes from here, so header, footer, and the
// mobile menu can never drift out of sync with each other.

export type NavLink = { href: string; label: string };

export const FEATURE_LINKS: NavLink[] = [
  { href: "/features/cv", label: "CV Builder" },
  { href: "/features/ats", label: "ATS Scanner" },
  { href: "/features/cover-letter", label: "Cover Letter Generator" },
  { href: "/features/interview", label: "Interview Coach" },
  { href: "/features/tracker", label: "Job Tracker" },
  { href: "/features/linkedin", label: "LinkedIn Optimiser" },
  { href: "/features/jobmatch", label: "Job Match" },
  { href: "/features/gradprep", label: "Grad Scheme Prep" },
];

export const VISA_LINKS: NavLink[] = [
  { href: "/visa-sponsors", label: "Visa Sponsors" },
  { href: "/sponsor-licence-check", label: "Sponsor Licence Check" },
  { href: "/visa-sponsors/statistics", label: "Sponsorship Statistics" },
  { href: "/graduate-visa-sponsorship", label: "Graduate Visa Sponsorship" },
];

export const COMPANY_LINKS: NavLink[] = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/compare", label: "Compare" },
  { href: "/contact", label: "Contact" },
  { href: "/newsletter", label: "Newsletter" },
  { href: "/status", label: "Status" },
  { href: "/partners", label: "Partners" },
];

export const INSTITUTION_LINKS: NavLink[] = [
  { href: "/for-universities", label: "For Universities" },
  { href: "/demo", label: "Request a Demo" },
];

export const LEGAL_LINKS: NavLink[] = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
  { href: "/accessibility", label: "Accessibility" },
];

export const HEADER_PRIMARY_LINKS: NavLink[] = [
  { href: "/pricing", label: "Pricing" },
  { href: "/visa-sponsors", label: "Visa Sponsors" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
];
