import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getGrantedPermissions } from "@/lib/admin/permissions";
import { AdminSidebar, ADMIN_NAV_ITEMS } from "@/components/layout/admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { SkipLink } from "@/components/layout/skip-link";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNavTrigger } from "@/components/layout/mobile-nav-trigger";
import { CurrentPageTitle } from "@/components/layout/current-page-title";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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

  return (
    <div className="flex min-h-screen flex-1">
      <SkipLink />
      <div className="hidden md:flex">
        <AdminSidebar permissions={permissions} />
      </div>
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b px-4 md:px-6">
          <div className="flex items-center gap-3">
            <MobileNavTrigger>
              <AdminSidebar permissions={permissions} />
            </MobileNavTrigger>
            <div className="md:hidden">
              <Logo />
            </div>
            <div className="hidden md:block">
              <CurrentPageTitle items={ADMIN_NAV_ITEMS} fallback="Admin" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">Admin</Badge>
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
