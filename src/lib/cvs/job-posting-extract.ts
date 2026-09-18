import "server-only";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export type ExtractedJobPosting = {
  description: string;
  title: string | null;
  company: string | null;
};

export type ExtractJobPostingResult = { error: string } | { posting: ExtractedJobPosting };

// Matches runAtsScanSchema's jobDescription cap (src/lib/cvs/schemas.ts)
// — extraction produces something that fits straight into the same
// field a pasted job description would.
const MAX_DESCRIPTION_LENGTH = 20000;
// Below this, treat extraction as having failed rather than pass a
// scan/keyword-gap check a near-empty, useless "job description".
const MIN_DESCRIPTION_LENGTH = 100;

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * schema.org JobPosting structured data (`<script type="application/
 * ld+json">`) — real job boards (LinkedIn, Indeed, Greenhouse, Lever,
 * and most ATS-hosted listings) publish this for their own SEO, and
 * it's a far cleaner source than scraping visible text: an explicit
 * `description` field, not "whatever text happens to be on the page."
 * Tried first; extractFromVisibleText below is the fallback when a page
 * doesn't have it.
 */
function extractFromJsonLd($: CheerioAPI): ExtractedJobPosting | null {
  const scripts = $('script[type="application/ld+json"]').toArray();

  for (const el of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse($(el).text());
    } catch {
      continue;
    }

    const topLevel = Array.isArray(parsed) ? parsed : [parsed];
    const candidates = topLevel.flatMap((item) => {
      const graph = isRecord(item) ? item["@graph"] : undefined;
      return Array.isArray(graph) ? graph : [item];
    });

    for (const item of candidates) {
      if (!isRecord(item)) continue;
      const type = item["@type"];
      const isJobPosting = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      if (!isJobPosting) continue;

      const rawDescription = item.description;
      if (typeof rawDescription !== "string" || !rawDescription.trim()) continue;

      // The description field is itself often small HTML fragments
      // ("<p>...</p><ul><li>...") — strip it down to plain text the same
      // way the visible-text fallback does.
      const description = collapseWhitespace(cheerio.load(rawDescription).text()).slice(0, MAX_DESCRIPTION_LENGTH);
      if (description.length < MIN_DESCRIPTION_LENGTH) continue;

      const title = typeof item.title === "string" ? item.title.trim() : null;
      const org = item.hiringOrganization;
      const company = isRecord(org) && typeof org.name === "string" ? org.name.trim() : null;

      return { description, title, company };
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Tried, in order, before falling back to the whole <body> — a real job
// page's main content usually lives in one of these; falling back
// straight to <body> mixes in nav/footer/cookie-banner noise.
const CONTENT_SELECTORS = ['[class*="job-description" i]', '[id*="job-description" i]', "article", "main"];

function extractFromVisibleText($: CheerioAPI): string {
  $("script, style, nav, header, footer, noscript, svg, iframe").remove();

  for (const selector of CONTENT_SELECTORS) {
    const text = collapseWhitespace($(selector).first().text());
    if (text.length >= MIN_DESCRIPTION_LENGTH) return text.slice(0, MAX_DESCRIPTION_LENGTH);
  }

  return collapseWhitespace($("body").text()).slice(0, MAX_DESCRIPTION_LENGTH);
}

function extractTitle($: CheerioAPI): string | null {
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) return ogTitle;
  const titleTag = $("title").first().text().trim();
  return titleTag || null;
}

/**
 * Structured data first, a visible-text heuristic second — never AI, this
 * is real content that either is or isn't on the page. Never throws:
 * malformed HTML/JSON-LD is swallowed and falls through to the next
 * strategy rather than failing the whole extraction.
 */
export function extractJobPosting(html: string): ExtractJobPostingResult {
  let $: CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch (err) {
    console.error("extractJobPosting: failed to parse HTML:", err);
    return { error: "Couldn't read that page's content." };
  }

  const structured = extractFromJsonLd($);
  if (structured) return { posting: structured };

  const title = extractTitle($);
  const description = extractFromVisibleText($);
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    return { error: "Couldn't find enough readable job description text on that page — try pasting it instead." };
  }

  return { posting: { description, title, company: null } };
}
