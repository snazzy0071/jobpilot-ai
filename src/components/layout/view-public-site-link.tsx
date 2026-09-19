import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one "View Public Website" action shared by every signed-in shell
 * (dashboard, admin, institution-admin) — opens "/" in a new tab so the
 * workspace (and any active admin "View as user" session) is never
 * navigated away from. A plain <a>, not next/link: it's an intentional
 * new-tab jump, and the ExternalLink icon says so visually while the
 * sr-only text says so to assistive tech.
 *
 * `sidebar` is the full-width, prominent (gradient) button used inside
 * SidebarShell — which is also what renders inside the mobile menu
 * sheet, so mobile gets it there. `header` is the compact variant for
 * the top bar: icon-only below `sm`, icon + label from `sm` up, so it's
 * visible on mobile without opening the menu and never crowds the
 * theme toggle / user menu next to it.
 */
export function ViewPublicSiteLink({
  variant = "sidebar",
  className,
}: {
  variant?: "sidebar" | "header";
  className?: string;
}) {
  const link = (
    <a href="/" target="_blank" rel="noopener">
      <ExternalLinkIcon className="size-4" />
      <span className={variant === "header" ? "sr-only sm:not-sr-only" : undefined}>View Public Website</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );

  if (variant === "header") {
    return <Button variant="outline" size="sm" className={cn("gap-1.5", className)} render={link} />;
  }

  return <Button variant="gradient" size="lg" className={cn("w-full justify-center gap-2", className)} render={link} />;
}
