import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type { CvPersonal, SectionKey } from "@/lib/cvs/types";

/**
 * Every filtered/derived view a template needs, computed once. Experience/
 * education require a real title before counting as "present" (an
 * in-progress "Add role" draft with nothing typed yet shouldn't render a
 * blank entry); the other five respect `isVisible`.
 */
export function getVisibleContent(data: CvTemplateContentData) {
  return {
    experience: data.experience.filter((row) => row.jobTitle.trim() || row.employer.trim()),
    education: data.education.filter((row) => row.institution.trim() || row.qualification.trim()),
    skills: data.skills.filter((row) => row.isVisible),
    projects: data.projects.filter((row) => row.isVisible),
    certifications: data.certifications.filter((row) => row.isVisible),
    languages: data.languages.filter((row) => row.isVisible),
    customSections: data.customSections.filter((row) => row.isVisible),
  };
}

/** Whether a section would render anything — frames use it so spacing is only ever added *between* real sections. */
export function sectionHasContent(key: SectionKey, data: CvTemplateContentData): boolean {
  const visible = getVisibleContent(data);
  switch (key) {
    case "summary":
      return Boolean(data.summary?.content?.trim());
    case "experience":
      return visible.experience.length > 0;
    case "education":
      return visible.education.length > 0;
    case "skills":
      return visible.skills.length > 0;
    case "projects":
      return visible.projects.length > 0;
    case "certifications":
      return visible.certifications.length > 0;
    case "languages":
      return visible.languages.length > 0;
    case "customSections":
      return visible.customSections.length > 0;
    default:
      return false;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2022-03-01" → "Mar 2022" (UK CV convention); anything that isn't an ISO date passes through untouched. */
export function formatMonth(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return value;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return match[1];
  return `${MONTHS[month - 1]} ${match[1]}`;
}

export function formatDateRange(start: string | null, end: string | null, isCurrent: boolean): string | null {
  const from = formatMonth(start);
  const to = isCurrent ? "Present" : formatMonth(end);
  if (from && to) return `${from} – ${to}`;
  return from ?? to;
}

export type DescriptionBlock = { kind: "paragraph"; text: string } | { kind: "bullets"; items: string[] };

const BULLET_PREFIX = /^(?:[-•*–—·▪◦]|\d{1,2}[.)])\s+/;

/**
 * Free text → paragraphs and bullet groups. A line starting with a bullet
 * character (or "1." / "1)") is a bullet; consecutive bullets form one
 * list; any other non-empty line is its own paragraph. Blank lines drop
 * out. The raw text is never altered beyond stripping the bullet marker.
 */
export function parseDescription(text: string | null | undefined): DescriptionBlock[] {
  if (!text) return [];
  const blocks: DescriptionBlock[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (BULLET_PREFIX.test(line)) {
      const item = line.replace(BULLET_PREFIX, "").trim();
      if (!item) continue;
      const last = blocks[blocks.length - 1];
      if (last?.kind === "bullets") last.items.push(item);
      else blocks.push({ kind: "bullets", items: [item] });
    } else {
      blocks.push({ kind: "paragraph", text: line });
    }
  }
  return blocks;
}

export type ContactItem = { key: string; text: string; href?: string };

function withScheme(url: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** Email, phone, location, then links — the order UK recruiters scan a CV header in. */
export function getContactItems(personal: CvPersonal | null): ContactItem[] {
  if (!personal) return [];
  const items: ContactItem[] = [];
  if (personal.email) items.push({ key: "email", text: personal.email, href: `mailto:${personal.email}` });
  if (personal.phone) items.push({ key: "phone", text: personal.phone, href: `tel:${personal.phone.replace(/[^\d+]/g, "")}` });
  if (personal.location) items.push({ key: "location", text: personal.location });
  if (personal.linkedinUrl) items.push({ key: "linkedin", text: displayUrl(personal.linkedinUrl), href: withScheme(personal.linkedinUrl) });
  if (personal.websiteUrl) items.push({ key: "website", text: displayUrl(personal.websiteUrl), href: withScheme(personal.websiteUrl) });
  if (personal.portfolioUrl) items.push({ key: "portfolio", text: displayUrl(personal.portfolioUrl), href: withScheme(personal.portfolioUrl) });
  return items;
}
