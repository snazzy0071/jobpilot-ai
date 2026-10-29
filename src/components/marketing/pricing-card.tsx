import Link from "next/link";
import { ArrowRightIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PricingCard({
  name,
  price,
  period,
  description,
  features,
  popular,
  ctaLabel,
  ctaHref,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <Card
      variant="pricing"
      animatedAccent={popular}
      className={cn("card-ring h-full", popular && "border-animated shadow-pop lg:-translate-y-3 lg:hover:-translate-y-5")}
    >
      {popular && (
        // Inside the card's top-right corner, not straddling its top
        // edge: Card clips overflow (needed for its rounded corners and
        // the animated accent), which cut a half-outside badge in two.
        <Badge className="gradient-brand absolute top-4 right-4 z-20 border-0 text-white shadow-glow">Most popular</Badge>
      )}
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="mt-3 flex items-baseline gap-1">
          <span className={cn("font-heading text-5xl font-bold tracking-tight", popular && "text-gradient")}>{price}</span>
          <span className="text-sm text-muted-foreground">{period}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <ul className="flex flex-1 flex-col gap-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          size="lg"
          variant={popular ? "gradient" : "outline"}
          className={popular ? "btn-shine" : undefined}
          render={
            <Link href={ctaHref}>
              {ctaLabel}
              <ArrowRightIcon className="transition-transform duration-300 group-hover/card:translate-x-1" />
            </Link>
          }
        />
      </CardContent>
    </Card>
  );
}
