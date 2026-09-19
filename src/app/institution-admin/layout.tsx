import type { Metadata } from "next";
import { requireInstitutionAdmin } from "@/lib/auth/session";
import {
  InstitutionAdminSidebar,
  INSTITUTION_ADMIN_NAV_ITEMS,
} from "@/components/layout/institution-admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { SkipLink } from "@/components/layout/skip-link";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNavTrigger } from "@/components/layout/mobile-nav-trigger";
import { CurrentPageTitle } from "@/components/layout/current-page-title";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ViewPublicSiteLink } from "@/components/layout/view-public-site-link";
import { Logo } from "@/components/layout/logo";

// See src/app/(dashboard)/layout.tsx's own comment on why this is set
// explicitly rather than relying on robots.txt's disallow alone.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function InstitutionAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireInstitutionAdmin();

  return (
    <div className="flex min-h-screen flex-1">
      <SkipLink />
      <div className="hidden md:flex">
        <InstitutionAdminSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b px-4 md:px-6">
          <div className="flex items-center gap-3">
            <MobileNavTrigger>
              <InstitutionAdminSidebar />
            </MobileNavTrigger>
            <div className="md:hidden">
              <Logo />
            </div>
            <div className="hidden md:block">
              <CurrentPageTitle items={INSTITUTION_ADMIN_NAV_ITEMS} fallback="Institution admin" />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="secondary" className="hidden sm:inline-flex">Institution admin</Badge>
            <ViewPublicSiteLink variant="header" />
<ThemeToggle />
            <UserMenu email={user.email ?? null} fullName={profile?.full_name ?? null} />
          </div>
        </header>
        <main id="main-content" className="dashboard-glow flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
