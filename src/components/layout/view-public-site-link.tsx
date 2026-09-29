import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one "View Public Website" action shared by every signed-in shell's
 * header (dashboard, admin, institution-admin) — opens "/" in a new tab
 * so the workspace (and any active admin "View as user" session) is
 * never navigated away from. A plain <a>, not next/link: it's an
 * intentional new-tab jump, and the ExternalLink icon says so visually
 * while the sr-only text says so to assistive tech. Icon-only below
 * `sm`, icon + label from `sm` up, so it's visible on mobile without
 * opening the nav menu and never crowds the user menu next to it. (Not
 * duplicated in the sidebar itself — one copy, in the header, reachable
 * from every breakpoint.)
 */
export function ViewPublicSiteLink({ className }: { className?: string }) {
  const link = (
    <a href="/" target="_blank" rel="noopener">
      <ExternalLinkIcon className="size-4" />
      <span className="sr-only sm:not-sr-only">View Public Website</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );

  return <Button variant="outline" size="sm" className={cn("gap-1.5", className)} render={link} />;
}
