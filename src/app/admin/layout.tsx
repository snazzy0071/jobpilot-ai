import { ScrollReset } from "@/components/layout/scroll-reset";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getGrantedPermissions } from "@/lib/admin/permissions";
import { AdminSidebar, ADMIN_NAV_ITEMS, ADMIN_UNLISTED_PAGES } from "@/components/layout/admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { SkipLink } from "@/components/layout/skip-link";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNavTrigger } from "@/components/layout/mobile-nav-trigger";
import { CurrentPageTitle } from "@/components/layout/current-page-title";
import { ViewPublicSiteLink } from "@/components/layout/view-public-site-link";
import { Logo } from "@/components/layout/logo";

// See src/app/(dashboard)/layout.tsx's own comment on why this is set
// explicitly rather than relying on robots.txt's disallow alone.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireAdmin();
  const permissions = await getGrantedPermissions(user.id);

  // Desktop (md+): the shell is exactly one viewport tall and never scrolls itself. The sidebar fills that height and
  // stays put; only <main> below scrolls, with the header pinned above it — so there is a single scrollbar, at the
  // right-hand edge of the content, and nothing scrolls the sidebar away. Below md the page scrolls normally and the
  // sidebar is the drawer, exactly as before.
  //
  // At md+, the content column is a distinct rounded, bordered, shadowed panel inset from the sidebar and the window
  // edges (bg-sidebar showing through the gap) rather than flush against the sidebar with just a hairline border — the
  // sidebar stays flush against the true left edge (bg-sidebar bleeds to it), so only the panel side gets the gap.
  return (
    <div className="flex min-h-screen flex-1 bg-sidebar md:h-dvh md:min-h-0 md:flex-none md:gap-3 md:overflow-hidden md:py-3 md:pr-3">
      <SkipLink />
      <div className="hidden md:flex md:h-full md:shrink-0">
        <AdminSidebar permissions={permissions} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col bg-background md:min-h-0 md:overflow-hidden md:rounded-3xl md:border md:border-border/70 md:shadow-elevated">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-white/70 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <MobileNavTrigger>
              <AdminSidebar permissions={permissions} />
            </MobileNavTrigger>
            <div className="md:hidden">
              <Logo />
            </div>
            <div className="hidden md:block">
              <CurrentPageTitle items={[...ADMIN_NAV_ITEMS, ...ADMIN_UNLISTED_PAGES]} fallback="Admin" />
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge variant="secondary" className="hidden sm:inline-flex">Admin</Badge>
            <ViewPublicSiteLink />
            <UserMenu email={user.email ?? null} fullName={profile?.full_name ?? null} />
          </div>
        </header>
        <main id="main-content" className="dashboard-glow flex-1 p-6 md:min-h-0 md:scroll-pt-6 md:overflow-y-auto">
          <ScrollReset />
          {children}
        </main>
      </div>
    </div>
  );
}
