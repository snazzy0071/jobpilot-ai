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
      className={cn("card-ring h-full", popular && "border-primary shadow-pop")}
    >
      {popular && (
        // Inside the card's top-right corner, not straddling its top
        // edge: Card clips overflow (needed for its rounded corners and
        // the animated accent), which cut a half-outside badge in two.
        <Badge className="absolute top-4 right-4 z-20">Popular</Badge>
      )}
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="font-heading text-4xl font-semibold tracking-tight">{price}</span>
          <span className="text-sm text-muted-foreground">{period}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-6">
        <ul className="flex flex-1 flex-col gap-2.5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          variant={popular ? "default" : "outline"}
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
