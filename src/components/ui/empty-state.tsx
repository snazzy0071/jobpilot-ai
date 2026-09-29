import type { LucideIcon } from "lucide-react"
import { Card, CardIcon } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * The shared "nothing here yet" panel — an icon tile (the same `CardIcon` premium feature/tool cards already use, so an empty
 * state reads as part of the same design language, not a plain leftover box), a short title, a description and an optional row
 * of actions. Centralizes a shape that had been hand-rolled slightly differently in ~30 places across the app (a bare `<Card>`
 * with just a paragraph or two, no icon, a lot of dead space below it on any but the shortest viewports) — swap in here rather
 * than reintroducing another one-off version.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
  ...props
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
} & Omit<React.ComponentProps<typeof Card>, "children">) {
  return (
    <Card className={cn("items-center gap-3 p-10 text-center", className)} {...props}>
      <CardIcon icon={Icon} />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {actions && <div className="flex flex-wrap justify-center gap-2 pt-1">{actions}</div>}
    </Card>
  )
}

export { EmptyState }
