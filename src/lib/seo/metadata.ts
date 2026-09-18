import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

// Single place that shapes canonical/OG/Twitter metadata consistently —
// pages pass a page-specific title segment and description, this fills
// in everything that would otherwise be copy-pasted boilerplate on every
// route. `title` is just the segment (e.g. "Pricing"); the root layout's
// `title.template` appends " | JobPilot AI" automatically, so this only needs
// to build the same combined string for openGraph/twitter, which don't
// inherit the template.
//
// The `images` arrays point at the real, dynamically-rendered
// /opengraph-image and /twitter-image routes explicitly, rather than
// relying on Next's automatic opengraph-image.tsx file-convention
// injection — a page that defines its own `openGraph`/`twitter` object
// (as every page using this helper does) doesn't reliably inherit that
// auto-injected image, so it's set here instead.

const OG_IMAGE_PATH = "/opengraph-image";
const TWITTER_IMAGE_PATH = "/twitter-image";

export function buildMetadata(options: {
  title?: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteConfig.domain}${options.path}`;
  const fullTitle = options.title ? `${options.title} | ${siteConfig.name}` : siteConfig.name;

  return {
    // Omitting the key entirely (rather than setting it to `undefined`)
    // matters: Next's metadata merge treats a present-but-undefined
    // `title` as "this segment defines an empty title", which blocks
    // inheriting the root layout's `title.default`.
    ...(options.title ? { title: options.title } : {}),
    description: options.description,
    alternates: { canonical: url },
    ...(options.noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: fullTitle,
      description: options.description,
      url,
      siteName: siteConfig.name,
      type: "website",
      images: [{ url: OG_IMAGE_PATH }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: options.description,
      images: [TWITTER_IMAGE_PATH],
    },
  };
}

// Blog posts need OpenGraph's `article` type (publishedTime/authors) —
// a distinct helper instead of overloading buildMetadata avoids fighting
// Next's discriminated OpenGraph union type.
export function buildArticleMetadata(options: {
  title: string;
  description: string;
  path: string;
  publishedTime: string;
  authors: string[];
}): Metadata {
  const url = `${siteConfig.domain}${options.path}`;
  const fullTitle = `${options.title} | ${siteConfig.name}`;

  return {
    title: options.title,
    description: options.description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description: options.description,
      url,
      siteName: siteConfig.name,
      type: "article",
      publishedTime: options.publishedTime,
      authors: options.authors,
      images: [{ url: OG_IMAGE_PATH }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: options.description,
      images: [TWITTER_IMAGE_PATH],
    },
  };
}
