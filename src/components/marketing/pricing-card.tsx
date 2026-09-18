import Link from "next/link";
import { Check } from "lucide-react";
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
      className={cn(
        "relative flex h-full flex-col",
        popular && "border-primary shadow-pop",
      )}
    >
      {popular && (
        <Badge className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          Popular
        </Badge>
      )}
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-semibold tracking-tight">{price}</span>
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
          render={<Link href={ctaHref}>{ctaLabel}</Link>}
        />
      </CardContent>
    </Card>
  );
}
