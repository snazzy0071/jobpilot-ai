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
    <Link href="/" className={cn("group/logo flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="gradient-brand relative flex size-8 shrink-0 items-center justify-center rounded-xl font-heading text-base font-bold text-white shadow-[0_6px_16px_-6px_rgba(51,80,255,0.7)] transition-transform duration-300 group-hover/logo:-rotate-6"
      >
        {siteConfig.name.charAt(0)}
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-brand-coral ring-2 ring-white" />
      </span>
      <span className="font-heading text-lg font-bold tracking-tight">{siteConfig.name}</span>
    </Link>
  );
}
