import type { ContentBlock } from "@/lib/content/blocks";
import { siteConfig } from "@/config/site";

export type LegalDocument = {
  slug: string;
  title: string;
  lastUpdated: string;
  intro: string;
  content: ContentBlock[];
};

// Editable source of truth for every legal page — edit the prose here,
// not in the page components. Written to describe what this app actually
// does today (checked against the real schema, RLS policies, and shipped
// features), not generic template boilerplate — a policy that doesn't
// match real practice is a compliance problem, not just a content one.
// This is a starting point for an early-stage product, not a substitute
// for review by qualified counsel before real users rely on it.

const LAST_UPDATED = "2026-09-05";
// Cookie Policy and Privacy Policy each have their own date, separate
// from the shared constant above (still accurate for Terms and the
// Accessibility Statement, neither of which has changed since) — each
// only updates when its own content actually changes, so one document's
// edit never falsely implies the others changed on the same day too.
const COOKIE_POLICY_LAST_UPDATED = "2026-09-17";
const PRIVACY_POLICY_LAST_UPDATED = "2026-09-17";

export const privacyPolicy: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  lastUpdated: PRIVACY_POLICY_LAST_UPDATED,
  intro:
    "This describes what we collect, why, and what rights you have over it. If anything here is unclear, get in touch and we'll explain it properly.",
  content: [
    { type: "heading", level: 2, id: "who-we-are", text: "Who we are" },
    {
      type: "paragraph",
      text: `${siteConfig.name} is operated by ${siteConfig.company}, a UK company building a career toolkit for people applying for work in the UK. This policy covers the public website and the product itself.`,
    },

    { type: "heading", level: 2, id: "what-we-collect", text: "What we collect" },
    { type: "paragraph", text: "We collect different information depending on how you use the site:" },
    {
      type: "list",
      items: [
        "Account information — full name, email address, date of birth, and password, given when you create an account.",
        "Career preferences — career stage, target roles, industries, location, graduation year, and visa sponsorship preference, given during onboarding or in your settings.",
        "Newsletter sign-ups — just an email address, if you subscribe without creating an account.",
        "Messages you send us — name, email, and message content, if you use the contact form.",
        "Institution and partnership inquiries — organisation name, contact name, email, and message, if you request a demo or submit a partnership inquiry.",
      ],
    },

    { type: "heading", level: 2, id: "what-we-dont-collect", text: "What we don't collect" },
    {
      type: "paragraph",
      text: "We don't run advertising trackers, sell your data to third parties, or share it with data brokers. See the Cookie Policy for the specifics on cookies.",
    },

    { type: "heading", level: 2, id: "how-we-use-it", text: "How we use it" },
    {
      type: "list",
      items: [
        "To provide the account and features you sign up for.",
        "To respond to messages you send through the contact form.",
        "To send newsletter emails, only if you've opted in — you can ask us to stop at any time.",
        "To follow up on institution or partnership inquiries.",
      ],
    },

    { type: "heading", level: 2, id: "who-we-share-it-with", text: "Who we share it with" },
    {
      type: "paragraph",
      text: "Our infrastructure provider, Supabase, hosts our database and handles authentication — they process data on our behalf to run the service, not for their own purposes. We don't sell data or share it with advertisers. As the product grows, any new processor (for example, a future email or payments provider) will be added here before it's used.",
    },

    { type: "heading", level: 2, id: "your-rights", text: "Your rights" },
    {
      type: "paragraph",
      text: "If you have an account, you can access and export your data, or delete your account entirely, from your account settings — both take effect immediately, not on request. If you don't have an account (for example, you only subscribed to the newsletter or sent a message), email us and we'll handle it manually.",
    },
    {
      type: "list",
      items: [
        "Access and export — download a copy of your account data from Settings.",
        "Correction — update your details directly in Settings.",
        "Deletion — delete your account and its data from Settings, at any time.",
        "Objection to marketing — email us to unsubscribe from newsletter emails.",
      ],
    },

    { type: "heading", level: 2, id: "cookies", text: "Cookies" },
    {
      type: "paragraph",
      text: "We use a small number of essential cookies to keep you signed in. See the Cookie Policy for the full list and why each one exists.",
    },

    { type: "heading", level: 2, id: "data-retention", text: "Data retention" },
    {
      type: "paragraph",
      text: "We keep account data for as long as your account is active, and delete it when you delete your account. Messages sent through the contact form, and demo or partnership inquiries, are kept only as long as needed to respond to them and for a reasonable period afterwards for our own records. If you use the free ATS checker without an account, your result is automatically deleted after 90 days — the CV and job description you paste in are never stored at all, even temporarily.",
    },

    { type: "heading", level: 2, id: "children", text: "Children" },
    {
      type: "paragraph",
      text: "You must be at least 13 years old to create an account — this is enforced at signup, not just stated here.",
    },

    { type: "heading", level: 2, id: "international-transfers", text: "International transfers" },
    {
      type: "paragraph",
      text: "Our infrastructure provider may process data outside the UK. Where that happens, we rely on providers who offer appropriate legal safeguards for the transfer.",
    },

    { type: "heading", level: 2, id: "changes", text: "Changes to this policy" },
    {
      type: "paragraph",
      text: "If we make a material change to this policy, we'll update the date at the top of this page. Continuing to use the service after a change means you accept the updated policy.",
    },

    { type: "heading", level: 2, id: "contact", text: "Contact us" },
    {
      type: "paragraph",
      text: `Questions about this policy or your data — email us at ${siteConfig.supportEmail}.`,
    },
  ],
};

export const termsOfService: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  lastUpdated: LAST_UPDATED,
  intro: `These are the terms for using ${siteConfig.name}. By creating an account or using the site, you're agreeing to them.`,
  content: [
    { type: "heading", level: 2, id: "acceptance", text: "Acceptance of these terms" },
    {
      type: "paragraph",
      text: `By accessing or using ${siteConfig.name}, you agree to these terms. If you don't agree, please don't use the service.`,
    },

    { type: "heading", level: 2, id: "who-can-use-it", text: "Who can use this" },
    {
      type: "paragraph",
      text: "You must be at least 13 years old to create an account. Some features work without an account (for example, the free ATS checker) — everything else needs one.",
    },

    { type: "heading", level: 2, id: "your-account", text: "Your account" },
    {
      type: "paragraph",
      text: "You're responsible for keeping your login details secure and for anything that happens under your account. One account per person — please don't create accounts for other people without their knowledge.",
    },

    { type: "heading", level: 2, id: "free-and-paid-plans", text: "Free and paid plans" },
    {
      type: "paragraph",
      text: "Every account today is on the Free plan. The paid plans shown on our pricing page are a preview of what's launching — nothing is billed yet, and we'll always ask before taking payment once billing goes live.",
    },

    { type: "heading", level: 2, id: "acceptable-use", text: "Acceptable use" },
    {
      type: "paragraph",
      text: "Please don't use the service to:",
    },
    {
      type: "list",
      items: [
        "Scrape, reverse-engineer, or systematically extract data from the site.",
        "Impersonate someone else or misrepresent your affiliation with any person or organisation.",
        "Resell or sublicense access to the service without our agreement.",
        "Attempt to disrupt or gain unauthorised access to the service.",
      ],
    },

    { type: "heading", level: 2, id: "your-content", text: "Your content" },
    {
      type: "paragraph",
      text: "Anything you create with the toolkit — CVs, cover letters, and the rest — is yours. We don't claim ownership of it, and we only use it to provide the service back to you.",
    },

    { type: "heading", level: 2, id: "visa-and-sponsor-data", text: "Visa sponsor and graduate scheme data" },
    {
      type: "paragraph",
      text: "Sponsor licence information is sourced from the UK Home Office's public register. Graduate scheme sponsorship status is cross-checked against public sources where available. None of this is immigration advice, and a listed sponsor licence doesn't guarantee sponsorship for a specific role — always verify directly with the employer or gov.uk before relying on it.",
    },

    { type: "heading", level: 2, id: "no-guarantee-of-outcomes", text: "No guarantee of outcomes" },
    {
      type: "paragraph",
      text: "We built this to genuinely help your job search, but we can't guarantee interviews, offers, or visa outcomes — those depend on far more than any single tool.",
    },

    { type: "heading", level: 2, id: "termination", text: "Termination" },
    {
      type: "paragraph",
      text: "You can delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms, particularly the acceptable use section above.",
    },

    { type: "heading", level: 2, id: "disclaimers", text: "Disclaimers and limitation of liability" },
    {
      type: "paragraph",
      text: "The service is provided \"as is\", without warranties of any kind. To the extent permitted by law, we aren't liable for indirect or consequential losses arising from your use of the service.",
    },

    { type: "heading", level: 2, id: "changes-to-terms", text: "Changes to these terms" },
    {
      type: "paragraph",
      text: "If we make a material change, we'll update the date at the top of this page. Continuing to use the service after a change means you accept the updated terms.",
    },

    { type: "heading", level: 2, id: "governing-law", text: "Governing law" },
    { type: "paragraph", text: "These terms are governed by the law of England and Wales." },

    { type: "heading", level: 2, id: "contact-terms", text: "Contact us" },
    { type: "paragraph", text: `Questions about these terms — email us at ${siteConfig.supportEmail}.` },
  ],
};

export const cookiePolicy: LegalDocument = {
  slug: "cookies",
  title: "Cookie Policy",
  lastUpdated: COOKIE_POLICY_LAST_UPDATED,
  intro: "What we set, why, and how you control it.",
  content: [
    { type: "heading", level: 2, id: "what-cookies-are", text: "What cookies are" },
    {
      type: "paragraph",
      text: "Cookies are small pieces of data a website stores in your browser, typically to remember who you are — or your preferences — between visits.",
    },

    { type: "heading", level: 2, id: "the-three-categories", text: "The three categories" },
    {
      type: "paragraph",
      text: "Every cookie we could ever set falls into one of three categories. You choose which of the last two, if any, to allow — from the banner on your first visit, or any time afterwards from \"Cookie preferences\" in the site footer.",
    },
    {
      type: "list",
      items: [
        "Necessary — required for the site to work at all. Always on; there's no opt-out, because there'd be nothing left to opt into.",
        "Analytics — would help us understand how the site is used, so we can improve it. Off unless you turn it on.",
        "Marketing — would help us measure and improve any marketing we run. Off unless you turn it on.",
      ],
    },

    { type: "heading", level: 2, id: "cookies-we-use-today", text: "Cookies we use today" },
    {
      type: "paragraph",
      text: "Right now, every cookie we set is necessary — we don't use analytics, advertising, or third-party tracking cookies of any kind, regardless of what you choose in the preference centre. Your choice is still saved (in its own necessary cookie) and honoured immediately if that ever changes: an analytics or marketing cookie will never be set before you've actively turned that category on.",
    },
    {
      type: "list",
      items: [
        "Session cookies — keep you signed in and identify your account on each request.",
        "A cookie recording your cookie preferences — so we don't ask you again on every visit.",
        "No advertising or marketing cookies.",
        "No third-party analytics cookies.",
      ],
    },

    { type: "heading", level: 2, id: "managing-cookies", text: "Managing cookies" },
    {
      type: "paragraph",
      text: "Change your analytics/marketing choice at any time from \"Cookie preferences\" in the site footer. You can also block or delete cookies entirely through your browser's settings — since our only cookies today are necessary ones, blocking them means you'll be signed out and asked for your cookie choice again on every visit.",
    },

    { type: "heading", level: 2, id: "cookie-policy-changes", text: "Changes to this policy" },
    {
      type: "paragraph",
      text: "If what we set changes, we'll update this page and the date above.",
    },

    { type: "heading", level: 2, id: "cookie-policy-contact", text: "Contact us" },
    { type: "paragraph", text: `Questions about cookies — email us at ${siteConfig.supportEmail}.` },
  ],
};

export const accessibilityStatement: LegalDocument = {
  slug: "accessibility",
  title: "Accessibility Statement",
  lastUpdated: LAST_UPDATED,
  intro:
    "We're aiming for WCAG 2.1 AA across the site. Here's what that means in practice, what we've done, and where we still have work to do.",
  content: [
    { type: "heading", level: 2, id: "our-commitment", text: "Our commitment" },
    {
      type: "paragraph",
      text: "We build every page to meet WCAG 2.1 AA as a baseline — proper labels, visible focus states, sufficient colour contrast, and full keyboard navigation — rather than treating accessibility as an afterthought.",
    },

    { type: "heading", level: 2, id: "what-weve-done", text: "What we've done so far" },
    {
      type: "list",
      items: [
        "Skip-to-content links on every major section of the site, so keyboard users don't have to tab through the full navigation on every page.",
        "Semantic heading structure throughout, including on components that render as cards rather than plain text.",
        "Accessible names on icon-only controls, like the account menu, so screen readers announce what they do.",
        "Visible focus states and full keyboard operability on menus, forms, and interactive components.",
        "A colour system checked for sufficient contrast in both light and dark themes.",
        "Responsive layouts checked at both desktop and mobile widths, not just designed for one and hoped for the other.",
      ],
    },

    { type: "heading", level: 2, id: "known-limitations", text: "Known limitations" },
    {
      type: "paragraph",
      text: "Not every page has been through a full, formal accessibility audit yet, and we haven't tested against every screen reader and browser combination. If you hit something that's hard to use, that's genuinely useful for us to know about — see below.",
    },

    { type: "heading", level: 2, id: "compatibility", text: "Compatibility" },
    {
      type: "paragraph",
      text: "The site is built to work with current versions of major browsers and their built-in accessibility tooling, and with common screen readers on both desktop and mobile.",
    },

    { type: "heading", level: 2, id: "feedback", text: "Feedback" },
    {
      type: "paragraph",
      text: `If anything on the site is hard to use, tell us — email ${siteConfig.supportEmail} or use the contact form, and we'll look into it.`,
    },
  ],
};

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  privacyPolicy,
  termsOfService,
  cookiePolicy,
  accessibilityStatement,
];
