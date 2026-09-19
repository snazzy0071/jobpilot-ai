import type { Metadata } from "next";
import { requireOnboardedUser, getImpersonationStatus } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/admin/settings/queries";
import { DashboardSidebar, DASHBOARD_NAV_ITEMS } from "@/components/layout/dashboard-sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { SkipLink } from "@/components/layout/skip-link";
import { MobileNavTrigger } from "@/components/layout/mobile-nav-trigger";
import { CurrentPageTitle } from "@/components/layout/current-page-title";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ViewPublicSiteLink } from "@/components/layout/view-public-site-link";
import { Logo } from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";

// robots.ts already disallows /dashboard from being *crawled*, but
// disallow alone doesn't stop a URL from being *indexed* if it's
// discovered some other way (an external link, a shared link) — Google's
// own guidance is explicit that noindex, not robots.txt, is what actually
// keeps a page out of the index. Set once here so every dashboard page
// inherits it without needing its own `robots` field (Next's metadata
// merge: a segment that doesn't set `robots` at all inherits the nearest
// ancestor's).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireOnboardedUser();
  const plan = profile?.plan ?? "free";
  const { announcementActive, announcementMessage } = await getAppSettings();
  // See src/lib/auth/impersonation.ts — when active, `user`/`profile`
  // above are already the impersonation TARGET's own (requireOnboardedUser()
  // resolves the effective identity), so the banner just needs to know
  // whether to show at all.
  const impersonation = await getImpersonationStatus();

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      {impersonation && (
        <ImpersonationBanner targetLabel={profile?.full_name ?? user.email ?? "this user"} />
      )}
      <div className="flex flex-1">
        <SkipLink />
        <div className="hidden md:flex">
          <DashboardSidebar plan={plan} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 items-center justify-between gap-4 border-b px-4 md:px-6">
            <div className="flex items-center gap-3">
              <MobileNavTrigger>
                <DashboardSidebar plan={plan} />
              </MobileNavTrigger>
              <div className="md:hidden">
                <Logo />
              </div>
              <div className="hidden md:block">
                <CurrentPageTitle items={DASHBOARD_NAV_ITEMS} fallback="Dashboard" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="hidden capitalize sm:inline-flex">
                {plan} plan
              </Badge>
              <ViewPublicSiteLink variant="header" />
              <ThemeToggle />
              <UserMenu
                email={user.email ?? null}
                fullName={profile?.full_name ?? null}
                settingsHref="/dashboard/settings"
              />
            </div>
          </header>
          {announcementActive && announcementMessage && (
            <div className="bg-primary/10 px-4 py-2 text-center text-sm text-primary md:px-6">{announcementMessage}</div>
          )}
          <main id="main-content" className="dashboard-glow flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
