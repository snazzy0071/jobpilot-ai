import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { siteConfig } from "@/config/site";

export type BreadcrumbItem = {
  label: string;
  /** Omit on the final (current-page) item — it renders as plain text with aria-current, not a link. */
  href?: string;
};

/**
 * A real nav landmark plus schema.org BreadcrumbList JSON-LD (same
 * dangerouslySetInnerHTML + `<` escaping pattern as
 * src/components/seo/organization-schema.tsx and the blog post page) —
 * for the sponsor register's search/city/company pages, which otherwise
 * have no way back up the hierarchy other than the main nav.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${siteConfig.domain}${item.href}` } : {}),
    })),
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
              {isLast || !item.href ? (
                <span aria-current={isLast ? "page" : undefined} className="font-medium text-foreground">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-foreground hover:underline">
                  {item.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
