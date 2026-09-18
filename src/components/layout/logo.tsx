import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * A monogram tile (brand gradient, CSS-only — no image asset needed)
 * plus the text wordmark; swap the tile for an
 * <Image src={siteConfig.logo.src} /> here once a real logo asset
 * exists — every layout already renders this component instead of the
 * brand name directly.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="gradient-brand flex size-7 shrink-0 items-center justify-center rounded-md font-heading text-sm font-bold text-white"
      >
        {siteConfig.name.charAt(0)}
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight">{siteConfig.name}</span>
    </Link>
  );
}
