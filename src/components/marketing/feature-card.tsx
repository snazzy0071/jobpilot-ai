import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardArrow, CardHeader, CardIcon, CardTitle, CardDescription } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";

// Stays a Server Component: `icon` is a component reference (a
// function), which can't cross the Server->Client boundary as a prop
// (only serializable data/already-rendered JSX can) — passing this
// through a "use client" FeatureCard broke the build on every page that
// renders it from server code (`for-universities`, `compare`, etc.).
// The entrance motion stays isolated in the small Reveal client
// wrapper; the hover lift/glow/icon movement is now plain CSS on the
// shared Card `feature` variant (ui/card.tsx), so this no longer needs
// the HoverLift client wrapper it used to.
export function FeatureCard({
  icon,
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
    <Card variant={href ? "feature" : "plain"} className={href ? "card-ring h-full" : "h-full"}>
      <CardHeader>
        <div className="mb-2 flex items-start justify-between">
          <CardIcon icon={icon} />
          {href && <CardArrow className="mt-1" />}
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
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
