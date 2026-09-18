import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { OrganizationSchema } from "@/components/seo/organization-schema";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrganizationSchema />
      <SkipLink />
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
