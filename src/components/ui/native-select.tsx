import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A real, uncontrolled `<select>` — not the Base UI `Select` in ./select.tsx — for the handful of filter forms that are plain
 * `method="GET"` forms on purpose (admin Users/Audit Log/Email Logs, the salary calculator) so filtering works with JavaScript
 * off and the result is a shareable, bookmarkable URL. Styled to match `Input`/`SelectTrigger` (same height, radius, border,
 * focus ring) via `appearance-none` + a drawn-on chevron, rather than left as the browser's own default control, which is the one
 * place a plain `<select>` used to look like a different, older product mid-flow through this app.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-9 pl-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { NativeSelect }
