"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  COMPANY_LINKS,
  FEATURE_LINKS,
  HEADER_PRIMARY_LINKS,
  INSTITUTION_LINKS,
  LEGAL_LINKS,
  VISA_LINKS,
  type NavLink,
} from "@/config/public-nav";

function NavLinkItem({
  href,
  label,
  onNavigate,
  className,
}: NavLink & { onNavigate?: () => void; className?: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-foreground/70 hover:bg-primary/[0.06] hover:text-foreground",
        className,
      )}
    >
      {label}
    </Link>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const featuresActive = pathname.startsWith("/features");

  return (
    <>
      <nav aria-label="Primary" className="hidden items-center gap-1 rounded-full border border-border/70 bg-white/70 p-1 shadow-card backdrop-blur md:flex">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              featuresActive
                ? "bg-primary/10 text-primary"
                : "text-foreground/70 hover:bg-primary/[0.06] hover:text-foreground",
            )}
          >
            Features
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {FEATURE_LINKS.map((link) => (
              <DropdownMenuItem
                key={link.href}
                render={<Link href={link.href}>{link.label}</Link>}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {HEADER_PRIMARY_LINKS.map((link) => (
          <NavLinkItem key={link.href} {...link} />
        ))}
      </nav>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="right" className="w-80 overflow-y-auto p-6">
          <SheetTitle className="sr-only">Site menu</SheetTitle>
          <div className="mt-8 flex flex-col gap-6">
            <MobileGroup
              title="Features"
              links={FEATURE_LINKS}
              onNavigate={() => setMobileOpen(false)}
            />
            <MobileGroup
              title="Visa & sponsorship"
              links={VISA_LINKS}
              onNavigate={() => setMobileOpen(false)}
            />
            <MobileGroup
              title="Company"
              links={COMPANY_LINKS}
              onNavigate={() => setMobileOpen(false)}
            />
            <MobileGroup
              title="Institutions"
              links={INSTITUTION_LINKS}
              onNavigate={() => setMobileOpen(false)}
            />
            <MobileGroup
              title="Legal"
              links={LEGAL_LINKS}
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="flex flex-col gap-2 border-t pt-4">
              <Button
                variant="outline"
                render={
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Sign in
                  </Link>
                }
              />
              <Button
                render={
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    Get started
                  </Link>
                }
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MobileGroup({
  title,
  links,
  onNavigate,
}: {
  title: string;
  links: NavLink[];
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {links.map((link) => (
        <NavLinkItem
          key={link.href}
          {...link}
          onNavigate={onNavigate}
          className="rounded-md px-1 py-1.5"
        />
      ))}
    </div>
  );
}
