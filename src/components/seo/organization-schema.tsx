import { siteConfig } from "@/config/site";

// Basic sitewide structured data — rendered once from the public route
// group's layout, not per-page. The logo is the real asset at
// siteConfig.logo.src (public/logo.svg). No `potentialAction` SearchAction
// either — there's no site search feature to back it.
export function OrganizationSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.domain}/#organization`,
        name: siteConfig.name,
        url: siteConfig.domain,
        logo: `${siteConfig.domain}${siteConfig.logo.src}`,
        sameAs: Object.values(siteConfig.social),
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.domain}/#website`,
        name: siteConfig.name,
        url: siteConfig.domain,
        publisher: { "@id": `${siteConfig.domain}/#organization` },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
