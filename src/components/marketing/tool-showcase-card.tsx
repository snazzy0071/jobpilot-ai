import Link from "next/link";
import { CheckIcon, type LucideIcon } from "lucide-react";
import {
  Card,
  CardArrow,
  CardContent,
  CardDescription,
  CardHeader,
  CardIcon,
  CardStatus,
  CardTitle,
} from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";

/**
 * A denser tool card than FeatureCard: a scaled-down live preview
 * mockup on top (the same components each feature page's own hero
 * demo uses — reused, not redrawn), then the icon/title/description,
 * then 3 real capability bullets. `preview` stays a Server Component
 * subtree (already-rendered JSX passed in as children), same reason
 * FeatureCard keeps its icon prop server-safe — see that component's
 * own comment on the Server->Client boundary.
 *
 * Styling comes entirely from the shared Card `tool` variant
 * (ui/card.tsx): CSS hover lift/glow, no client HoverLift wrapper.
 */
export function ToolShowcaseCard({
  icon,
  title,
  description,
  href,
  bullets,
  preview,
  planBadge,
  index = 0,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  bullets: string[];
  preview?: React.ReactNode;
  planBadge?: string;
  index?: number;
}) {
  return (
    <Reveal delay={Math.min(index * 0.06, 0.3)} className="h-full">
      <Link href={href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Card variant="tool" animatedAccent={index === 0} className="card-ring h-full gap-0 p-0">
          {preview && (
            <div className="relative h-36 overflow-hidden border-b bg-muted/30">
              {/* origin-top + items-start (not centered): these preview
                  cards run taller than this window even scaled down, so
                  anchoring the crop to the top keeps each card's own
                  header/first section visible and lets the (less
                  important) lower content run off the bottom instead —
                  a centered crop was clipping the top on every card. */}
              <div className="absolute inset-0 flex justify-center overflow-hidden">
                <div className="w-full origin-top scale-[0.62] pt-3 transition-transform duration-500 group-hover/card:scale-[0.66]">{preview}</div>
              </div>
              {planBadge && <CardStatus className="absolute top-2 right-2 bg-card shadow-card">{planBadge}</CardStatus>}
            </div>
          )}
          <CardHeader className="pt-4">
            <div className="mb-1 flex items-start justify-between">
              <CardIcon icon={icon} />
              <CardArrow className="mt-2" />
            </div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 pb-4">
            {bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckIcon className="mt-0.5 size-3 shrink-0 text-primary" />
                <span>{bullet}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </Link>
    </Reveal>
  );
}
