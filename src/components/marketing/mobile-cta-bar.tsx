"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";

// Pages where a persistent "start free" prompt helps a visitor who has read a while. Deliberately not shown on forms, legal pages,
// data tables or anywhere that already ends in its own conversion step.
const SHOW_ON = [/^\/$/, /^\/features\//, /^\/pricing$/, /^\/about$/, /^\/for-universities$/, /^\/graduate-visa-sponsorship$/, /^\/compare(\/|$)/];

/**
 * Phone-only sticky call to action. Appears after the visitor has scrolled past the first screen, slides away again near the
 * very bottom (where the page's own closing CTA is), and never renders at md and up. Real links, no popups.
 */
export function MobileCtaBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const enabled = SHOW_ON.some((pattern) => pattern.test(pathname));

  useEffect(() => {
    if (!enabled) return;
    function update() {
      const scrolled = window.scrollY;
      const remaining = document.documentElement.scrollHeight - (scrolled + window.innerHeight);
      setVisible(scrolled > 700 && remaining > 900);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [enabled, pathname]);

  if (!enabled) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-pop backdrop-blur transition-transform duration-300 md:hidden ${visible ? "translate-y-0" : "translate-y-full"}`}
      aria-hidden={!visible}
      data-testid="mobile-cta-bar"
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
          <span className="block text-sm font-semibold text-foreground">Free to start</span>
          No card required
        </p>
        <Link href="/free-ats-checker" tabIndex={visible ? 0 : -1} className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
          Score my CV
        </Link>
        <Link
          href="/signup"
          tabIndex={visible ? 0 : -1}
          className="gradient-brand btn-shine inline-flex shrink-0 items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-card"
        >
          Get started <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
