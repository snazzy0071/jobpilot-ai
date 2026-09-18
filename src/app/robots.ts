import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Matches proxy.ts's AUTHENTICATED_PREFIXES plus role-gated areas
      // and functional (non-content) auth endpoints — nothing here has
      // SEO value, and some of it errors for a crawler with no session.
      disallow: [
        "/dashboard",
        "/onboarding",
        "/reset-password",
        "/signup/verified",
        "/admin",
        "/institution-admin",
        "/auth/callback",
        "/auth/confirm",
        "/institution-invite",
        // Both auth-gated (requireUser()) and already carry their own
        // per-page noindex — disallowed here too so a crawler never
        // burns budget on a request that only ever redirects to /login.
        "/print",
        // Functional JSON/binary endpoints, never HTML, never meant to
        // be indexed — same reasoning as everything else in this list.
        "/api",
      ],
    },
    sitemap: `${siteConfig.domain}/sitemap.xml`,
  };
}
