import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getBlogPosts } from "@/lib/blog/queries";
import { SPONSOR_CITIES } from "@/config/sponsor-cities";
import { getGraduateSchemes } from "@/lib/graduate-schemes/queries";
import { cityCounts } from "@/lib/graduate-schemes/cities";
import { getLiveGuides } from "@/lib/advice/queries";
import { getLiveComparisons } from "@/lib/comparisons/queries";

// visa-sponsors/companies/[company] is deliberately excluded: there's no
// real, enumerable set of company slugs yet (no register data connected),
// and listing fabricated ones would put non-existent pages in the
// sitemap. Add it here once real company records exist.

const STATIC_ROUTES: { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/signup", changeFrequency: "monthly", priority: 0.9 },
  { path: "/login", changeFrequency: "monthly", priority: 0.5 },
  { path: "/features/cv", changeFrequency: "weekly", priority: 0.8 },
  { path: "/features/ats", changeFrequency: "weekly", priority: 0.8 },
  { path: "/features/cover-letter", changeFrequency: "weekly", priority: 0.8 },
  { path: "/features/interview", changeFrequency: "weekly", priority: 0.8 },
  { path: "/features/tracker", changeFrequency: "weekly", priority: 0.8 },
  { path: "/features/linkedin", changeFrequency: "weekly", priority: 0.8 },
  { path: "/features/jobmatch", changeFrequency: "weekly", priority: 0.8 },
  { path: "/features/gradprep", changeFrequency: "weekly", priority: 0.8 },
  { path: "/free-ats-checker", changeFrequency: "weekly", priority: 0.8 },
  { path: "/visa-sponsors", changeFrequency: "weekly", priority: 0.8 },
  { path: "/visa-sponsors/cities", changeFrequency: "weekly", priority: 0.6 },
  { path: "/visa-sponsors/statistics", changeFrequency: "weekly", priority: 0.6 },
  { path: "/sponsor-licence-check", changeFrequency: "weekly", priority: 0.7 },
  { path: "/skilled-worker-salary-calculator", changeFrequency: "monthly", priority: 0.7 },
  { path: "/deadlines", changeFrequency: "daily", priority: 0.8 },
  { path: "/graduate-schemes", changeFrequency: "daily", priority: 0.8 },
  { path: "/graduate-schemes/cities", changeFrequency: "weekly", priority: 0.6 },
  { path: "/graduate-visa-sponsorship", changeFrequency: "weekly", priority: 0.7 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.6 },
  { path: "/go", changeFrequency: "monthly", priority: 0.6 },
  { path: "/blog", changeFrequency: "daily", priority: 0.7 },
  { path: "/advice-hub", changeFrequency: "weekly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/newsletter", changeFrequency: "yearly", priority: 0.4 },
  { path: "/status", changeFrequency: "daily", priority: 0.3 },
  { path: "/for-universities", changeFrequency: "monthly", priority: 0.6 },
  { path: "/demo", changeFrequency: "yearly", priority: 0.5 },
  { path: "/partners", changeFrequency: "monthly", priority: 0.5 },
  { path: "/campus-crew", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.2 },
  { path: "/accessibility", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${siteConfig.domain}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const cityEntries: MetadataRoute.Sitemap = SPONSOR_CITIES.map((city) => ({
    url: `${siteConfig.domain}/visa-sponsors/cities/${city.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Degrades to an empty array if the blog migration hasn't been applied
  // yet — getBlogPosts() already treats a missing table as "no data"
  // rather than throwing, so this can't break sitemap generation.
  const posts = await getBlogPosts();
  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteConfig.domain}/blog/${post.slug}`,
    lastModified: post.publishedAt,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  // Only published schemes that really exist — an empty catalogue contributes no URLs.
  const schemes = await getGraduateSchemes();
  const schemeEntries: MetadataRoute.Sitemap = schemes.map((scheme) => ({
    url: `${siteConfig.domain}/graduate-schemes/${scheme.slug}`,
    lastModified: scheme.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // Only places a published scheme names.
  const schemeCityEntries: MetadataRoute.Sitemap = cityCounts(schemes).map((city) => ({
    url: `${siteConfig.domain}/graduate-schemes/cities/${city.slug}`,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // Live guides only (drafts and scheduled ones aren't public).
  const guides = await getLiveGuides().catch(() => []);
  const guideEntries: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${siteConfig.domain}/advice-hub/${guide.slug}`,
    lastModified: guide.updatedAt,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Live comparison pages only.
  const comparisons = await getLiveComparisons().catch(() => []);
  const comparisonEntries: MetadataRoute.Sitemap = comparisons.map((page) => ({
    url: `${siteConfig.domain}/compare/${page.slug}`,
    lastModified: page.updatedOn,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...cityEntries, ...postEntries, ...schemeEntries, ...schemeCityEntries, ...guideEntries, ...comparisonEntries];
}
