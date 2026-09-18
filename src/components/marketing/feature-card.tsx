import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { HoverLift } from "@/components/motion/hover-lift";
import { cn } from "@/lib/utils";

// Stays a Server Component: `icon` is a component reference (a
// function), which can't cross the Server->Client boundary as a prop
// (only serializable data/already-rendered JSX can) — passing this
// through a "use client" FeatureCard broke the build on every page that
// renders it from server code (`for-universities`, `compare`, etc.).
// The motion pieces are isolated into small client wrappers
// (Reveal/HoverLift) that only ever receive already-rendered children.
export function FeatureCard({
  icon: Icon,
  title,
  description,
  href,
  index = 0,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  /** Position within a mapped grid — staggers this card's entrance slightly behind the ones before it. */
  index?: number;
}) {
  const card = (
    <HoverLift enabled={Boolean(href)}>
      <Card
        className={cn(href && "h-full transition-colors hover:border-primary/40 hover:bg-muted/30")}
      >
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </HoverLift>
  );

  const linked = href ? (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  ) : (
    card
  );

  return (
    <Reveal className="h-full" delay={Math.min(index * 0.06, 0.3)}>
      {linked}
    </Reveal>
  );
}
