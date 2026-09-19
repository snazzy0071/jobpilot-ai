import { EyeIcon } from "lucide-react";

/**
 * Persistent, impossible-to-miss strip shown on every dashboard/
 * onboarding page for the duration of an admin "View as user" session
 * — sticky so it stays visible while scrolling, never just a toast
 * that disappears. The exit form posts to a fixed route handler
 * outside /dashboard (src/app/api/admin/impersonation/exit/route.ts),
 * not a Server Action — see that route's own comment for why.
 */
export function ImpersonationBanner({ targetLabel }: { targetLabel: string }) {
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground">
      <span className="flex items-center gap-2">
        <EyeIcon className="size-4" />
        Viewing as <span className="font-semibold">{targetLabel}</span> — read-only
      </span>
      <form action="/api/admin/impersonation/exit" method="POST">
        <button
          type="submit"
          className="rounded-md border border-current px-3 py-1 text-xs font-semibold transition-colors hover:bg-warning-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning-foreground/50"
        >
          Exit impersonation
        </button>
      </form>
    </div>
  );
}
