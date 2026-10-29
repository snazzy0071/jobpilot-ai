import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowRightIcon, type LucideIcon } from "lucide-react"

import { AnimatedGradient } from "@/components/motion/animated-gradient"
import { cn } from "@/lib/utils"

// Every hover/lift/glow below is plain CSS (`hover:` + `transition`),
// not Framer Motion — Card is rendered from Server Components all over
// the app, and wrapping each one in a client-side motion component just
// to lift 4px would be pure overhead. Transform/opacity/box-shadow
// transitions are compositor-friendly, and the app's global
// prefers-reduced-motion rule (globals.css) already collapses every
// `transition-duration` to ~0, so reduced-motion needs no per-variant
// handling either.
//
// `plain` is byte-for-byte the classes Card always had (it's the
// default, so every existing <Card> with no `variant` prop is
// untouched). Everything else is opt-in:
//   feature — icon-led marketing cards: lift + border glow + faint wash
//   tool    — bigger, product-y cards (tool grids/showcases): stronger lift
//   metric  — stat tiles: brand hairline on top, calm hover
//   action  — panels holding buttons: soft gradient, no lift (they aren't links)
//   admin   — data-dense admin sections: readable, tinted border on hover only
//   pricing — plan cards: roomier radius, big lift
const WASH =
  "isolate relative before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[image:var(--gradient-card-wash)] before:opacity-0 before:transition-opacity before:duration-300 hover:before:opacity-100"

const cardVariants = cva(
  "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-2xl border py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-2xl *:[img:last-child]:rounded-b-2xl",
  {
    variants: {
      variant: {
        // genesis-DESIGN.md says cards rest flat and only pick up a shadow on hover — tried literally (shadow-none at rest)
        // first, but on this palette bg-card (#FFFFFF) sits at only ~1:1 contrast against --background (#FAFAFA) and
        // --border is deliberately near-invisible too (see its own comment in globals.css), so a truly shadow-less card
        // had no visual presence at all against the page. Keeping shadow-card at rest, same as every other variant below,
        // and reserving the stronger shadow for hover instead.
        plain:
          "border-border/80 bg-card shadow-card transition-all duration-300 ease-out hover:shadow-elevated",
        feature: `${WASH} border-border bg-card shadow-card transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-pop`,
        tool: `${WASH} border-border bg-card shadow-elevated transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-floating`,
        metric:
          "relative isolate border-border bg-card shadow-card transition-shadow duration-300 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-[image:var(--gradient-brand)] before:opacity-60 hover:shadow-elevated",
        action:
          "border-border bg-linear-to-b from-card to-muted/40 shadow-card transition-colors duration-200 hover:border-primary/30",
        admin:
          "border-border bg-linear-to-br from-card to-muted/25 shadow-card transition-colors duration-200 hover:border-primary/25",
        pricing: `${WASH} rounded-2xl border-border bg-card shadow-elevated transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-floating`,
      },
    },
    defaultVariants: { variant: "plain" },
  }
)

type CardProps = React.ComponentProps<"div"> &
  VariantProps<typeof cardVariants> & {
    size?: "default" | "sm"
    /** A thin, slowly-panning brand-gradient hairline along the top edge (AnimatedGradient — pure CSS, no client JS). Opt-in: for the one card in a set that deserves a little extra attention (a highlighted plan, a flagship tool). */
    animatedAccent?: boolean
  }

function Card({
  className,
  size = "default",
  variant = "plain",
  animatedAccent = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(cardVariants({ variant }), animatedAccent && "relative", className)}
      {...props}
    >
      {animatedAccent && (
        <AnimatedGradient className="absolute inset-x-0 top-0 z-10 h-0.5 opacity-90" />
      )}
      {children}
    </div>
  )
}

/**
 * The contextual icon tile every premium variant shares — tinted
 * square that scales/tilts slightly when its parent Card is hovered
 * (`group-hover/card`, the same group name Card already exposes), so
 * icon movement is consistent everywhere instead of re-invented per
 * component. Takes a component reference, so — same as FeatureCard —
 * only render it from a component that isn't itself receiving `icon`
 * across a Server->Client boundary.
 */
function CardIcon({
  icon: Icon,
  className,
}: {
  icon: LucideIcon
  className?: string
}) {
  return (
    <div
      data-slot="card-icon"
      className={cn(
        "flex size-11 items-center justify-center rounded-2xl bg-linear-to-br from-primary/12 to-brand-cyan/15 text-primary ring-1 ring-primary/15 transition-transform duration-300 group-hover/card:scale-110 group-hover/card:-rotate-6",
        className
      )}
    >
      <Icon className="size-5" />
    </div>
  )
}

/** The CTA arrow: nudges right when its parent Card is hovered. */
function CardArrow({ className }: { className?: string }) {
  return (
    <ArrowRightIcon
      data-slot="card-arrow"
      aria-hidden="true"
      className={cn(
        "size-4 text-muted-foreground transition-all duration-300 group-hover/card:translate-x-1 group-hover/card:text-primary",
        className
      )}
    />
  )
}

/** The "useful status/value" slot — a small pill (plan tier, sync state, "Not built yet") that sits consistently in a card's corner. */
function CardStatus({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="card-status"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardIcon,
  CardArrow,
  CardStatus,
  cardVariants,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
